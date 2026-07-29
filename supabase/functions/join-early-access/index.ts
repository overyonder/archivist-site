import { bytea, database, errorMessage } from "../_shared/database.ts";
import { requiredEnv } from "../_shared/config.ts";
import { acceptsHtml, corsHeaders, json, redirect } from "../_shared/http.ts";
import { sendConfirmation } from "../_shared/email.ts";
import { emailDomainStatus } from "../_shared/email-domain.ts";
import {
  actionToken,
  requestFingerprint,
  tokenHash,
} from "../_shared/token.ts";
import { verifyEarlyAccessChallenge } from "../_shared/turnstile.ts";

const genericBody = { accepted: true };

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const contentType = request.headers.get("content-type") ?? "";
  const submission = contentType.includes("application/json")
    ? await request.json().catch(() => null) as Record<string, unknown> | null
    : await request.formData().then((form) => Object.fromEntries(form)).catch(
      () => null,
    );
  const field = (name: string): string | null => {
    const value = submission?.[name];
    return typeof value === "string" ? value : null;
  };
  const clippedField = (name: string, maximum: number): string | null => {
    const value = field(name)?.trim();
    return value ? value.slice(0, maximum) : null;
  };

  const email = field("email")?.trim();
  if (!email) {
    return acceptsHtml(request)
      ? redirect("/early-access/error/")
      : json({ error: "A valid email address is required" }, 400, cors);
  }

  // Supabase's gateway supplies the originating address. It is deliberately
  // used only for a keyed rate-limit fingerprint: Turnstile's optional
  // remoteip check is brittle across proxies and isn't needed to validate the
  // signed token, hostname, and action.
  const sourceAddress = request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const normalizedEmail = email.toLowerCase();
  const challengeToken = field("cf-turnstile-response")?.trim();
  if (
    !challengeToken ||
    !(await verifyEarlyAccessChallenge(challengeToken).catch(
      (error) => {
        console.error("Turnstile validation failed", error);
        return false;
      },
    ))
  ) {
    return acceptsHtml(request)
      ? redirect("/early-access/error/")
      : json({ error: "Human verification failed" }, 400, cors);
  }

  const domainStatus = await emailDomainStatus(normalizedEmail);
  if (domainStatus === "invalid") {
    return acceptsHtml(request)
      ? redirect("/early-access/email-invalid/")
      : json({ error: "A valid email address is required" }, 400, cors);
  }
  if (domainStatus === "unreceivable") {
    return acceptsHtml(request)
      ? redirect("/early-access/email-invalid/")
      : json(
        { error: "That email domain does not receive email" },
        400,
        cors,
      );
  }

  const db = database();
  const tokenId = crypto.randomUUID();
  const token = await actionToken(tokenId);
  const hash = await tokenHash(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();
  const attribution = Object.fromEntries(
    [
      ["source", clippedField("campaign_source", 100)],
      ["medium", clippedField("campaign_medium", 100)],
      ["campaign", clippedField("campaign_name", 100)],
      ["content", clippedField("campaign_content", 100)],
      ["landing_page", clippedField("landing_page", 200)],
    ].filter((entry): entry is [string, string] => entry[1] !== null),
  );
  const attributionSubjectId = clippedField("attribution_subject_id", 36);
  const signupSources = (() => {
    try {
      const value = JSON.parse(field("signup_sources") ?? "");
      return Array.isArray(value) &&
          value.length > 0 &&
          value.length <= 16 &&
          value.every((source) => typeof source === "string")
        ? value
        : null;
    } catch {
      return null;
    }
  })();
  const proFirstFeature = clippedField("pro_first_feature", 64);
  const { data, error } = await db.rpc(
    "request_early_access_with_preferences",
    {
      p_email: email,
      p_token_id: tokenId,
      p_token_hash: bytea(hash),
      p_expires_at: expiresAt,
      p_source: "archivist-site",
      p_form_version: Deno.env.get("EARLY_ACCESS_FORM_VERSION") || "1",
      p_policy_version: requiredEnv("EARLY_ACCESS_POLICY_VERSION"),
      p_request_fingerprint: bytea(
        await requestFingerprint(`ip:${sourceAddress}`),
      ),
      p_email_fingerprint: bytea(
        await requestFingerprint(`email:${normalizedEmail}`),
      ),
      p_product_research: field("product_research") === "yes",
      p_attribution: attribution,
      p_attribution_subject_id: attributionSubjectId,
      p_signup_sources: signupSources,
      p_pro_first_feature: proFirstFeature,
    },
  );

  if (error) {
    console.error("Early-access request failed", error);
    return acceptsHtml(request)
      ? redirect("/early-access/error/")
      : json({ error: "The request could not be processed" }, 500, cors);
  }

  const result = Array.isArray(data) ? data[0] : data;
  if (result?.outcome === "full") {
    return acceptsHtml(request)
      ? redirect("/early-access/full/")
      : json({ accepted: false, status: "full" }, 409, cors);
  }
  if (result?.outcome === "already_confirmed") {
    return acceptsHtml(request)
      ? redirect("/early-access/already-joined/")
      : json(genericBody, 202, cors);
  }
  if (result?.outcome === "confirmation_required") {
    const { data: delivery, error: deliveryError } = await db.from("deliveries")
      .insert({
        kind: "confirmation",
        action_token_id: result.token_id,
        contact_id: result.contact_id,
        status: "sending",
        attempt_count: 1,
        claimed_at: new Date().toISOString(),
        claim_expires_at: new Date(Date.now() + 5 * 60 * 1_000).toISOString(),
        claim_token: crypto.randomUUID(),
        attempted_at: new Date().toISOString(),
      }).select("id").single();

    if (deliveryError) {
      console.error("Could not queue confirmation", deliveryError);
    } else {
      const idempotencyKey = crypto.randomUUID();
      const { error: attemptError } = await db.from("delivery_attempts").insert(
        {
          delivery_id: delivery.id,
          attempt_number: 1,
          idempotency_key: idempotencyKey,
        },
      );

      if (attemptError) {
        console.error("Could not record confirmation attempt", attemptError);
      } else {
        const confirmationUrl = new URL(
          `/functions/v1/confirm-early-access?t=${encodeURIComponent(token)}`,
          requiredEnv("SUPABASE_URL"),
        ).toString();

        try {
          const providerMessageId = await sendConfirmation(
            normalizedEmail,
            confirmationUrl,
            delivery.id,
            idempotencyKey,
          );
          const now = new Date().toISOString();
          const results = await Promise.all([
            db.from("delivery_attempts").update({
              completed_at: now,
              outcome: "accepted",
              provider_message_id: providerMessageId,
            }).eq("idempotency_key", idempotencyKey),
            db.from("deliveries").update({
              status: "accepted",
              provider_message_id: providerMessageId,
              accepted_at: now,
              attempted_at: now,
              attempt_count: 1,
              claimed_at: null,
              claim_expires_at: null,
              claim_token: null,
            }).eq("id", delivery.id),
          ]);
          const persistenceError = results.find((result) => result.error)
            ?.error;
          if (persistenceError) {
            console.error(
              "Could not persist accepted confirmation",
              persistenceError,
            );
          }
        } catch (sendError) {
          console.error("Confirmation email failed", sendError);
          const now = new Date().toISOString();
          const results = await Promise.all([
            db.from("delivery_attempts").update({
              completed_at: now,
              outcome: "transient_failure",
              failure_code: "email_send",
              failure_reason: errorMessage(sendError),
            }).eq("idempotency_key", idempotencyKey),
            db.from("deliveries").update({
              status: "failed",
              attempted_at: now,
              attempt_count: 1,
              next_attempt_at: new Date(Date.now() + 15 * 60 * 1_000)
                .toISOString(),
              failure_class: "transient",
              failure_code: "email_send",
              failure_reason: errorMessage(sendError),
            }).eq("id", delivery.id),
          ]);
          const persistenceError = results.find((result) => result.error)
            ?.error;
          if (persistenceError) {
            console.error(
              "Could not persist failed confirmation",
              persistenceError,
            );
          }
        }
      }
    }
  }

  return acceptsHtml(request)
    ? redirect("/early-access/check-email/")
    : json(genericBody, 202, cors);
});
