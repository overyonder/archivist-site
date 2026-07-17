import { bytea, database, errorMessage } from "../_shared/database.ts";
import { requiredEnv } from "../_shared/config.ts";
import {
  acceptsHtml,
  corsHeaders,
  json,
  redirect,
  requestField,
} from "../_shared/http.ts";
import { sendConfirmation } from "../_shared/ses.ts";
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

  const challengeRequest = request.clone();
  const email = (await requestField(request, "email"))?.trim();
  if (!email) {
    return acceptsHtml(request)
      ? redirect("/early-access/error/")
      : json({ error: "A valid email address is required" }, 400, cors);
  }

  // Supabase documents the first X-Forwarded-For entry as the client address
  // supplied by its gateway. Turnstile is the primary bot check; this value is
  // used only for the secondary request counter and Siteverify context.
  const sourceAddress = request.headers.get("x-forwarded-for")?.split(",")[0]
    ?.trim() || "unknown";
  const normalizedEmail = email.toLowerCase();
  const challengeToken = (await requestField(
    challengeRequest,
    "cf-turnstile-response",
  ))?.trim();
  if (
    !challengeToken ||
    !(await verifyEarlyAccessChallenge(challengeToken, sourceAddress).catch(
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

  const db = database();
  const tokenId = crypto.randomUUID();
  const token = await actionToken(tokenId);
  const hash = await tokenHash(token);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString();
  const { data, error } = await db.rpc("request_early_access", {
    p_email: email,
    p_token_id: tokenId,
    p_token_hash: bytea(hash),
    p_expires_at: expiresAt,
    p_source: "archivist-site",
    p_form_version: Deno.env.get("EARLY_ACCESS_FORM_VERSION") || "1",
    p_policy_version: requiredEnv("EARLY_ACCESS_POLICY_VERSION"),
    p_request_fingerprint: bytea(await requestFingerprint(`ip:${sourceAddress}`)),
    p_email_fingerprint: bytea(await requestFingerprint(`email:${normalizedEmail}`)),
  });

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
          const sesMessageId = await sendConfirmation(
            normalizedEmail,
            confirmationUrl,
            delivery.id,
          );
          const now = new Date().toISOString();
          await Promise.all([
            db.from("delivery_attempts").update({
              completed_at: now,
              outcome: "accepted",
              ses_message_id: sesMessageId,
            }).eq("idempotency_key", idempotencyKey),
            db.from("deliveries").update({
              status: "accepted",
              ses_message_id: sesMessageId,
              accepted_at: now,
              attempted_at: now,
              attempt_count: 1,
              claimed_at: null,
              claim_expires_at: null,
              claim_token: null,
            }).eq("id", delivery.id),
          ]);
        } catch (sendError) {
          console.error("SES confirmation failed", sendError);
          const now = new Date().toISOString();
          await Promise.all([
            db.from("delivery_attempts").update({
              completed_at: now,
              outcome: "transient_failure",
              failure_code: "ses_send",
              failure_reason: errorMessage(sendError),
              claimed_at: null,
              claim_expires_at: null,
              claim_token: null,
            }).eq("idempotency_key", idempotencyKey),
            db.from("deliveries").update({
              status: "failed",
              attempted_at: now,
              attempt_count: 1,
              next_attempt_at: new Date(Date.now() + 15 * 60 * 1_000)
                .toISOString(),
              failure_class: "transient",
              failure_code: "ses_send",
              failure_reason: errorMessage(sendError),
            }).eq("id", delivery.id),
          ]);
        }
      }
    }
  }

  return acceptsHtml(request)
    ? redirect("/early-access/check-email/")
    : json(genericBody, 202, cors);
});
