import { requiredEnv } from "../_shared/config.ts";
import {
  bytea,
  database,
  errorMessage,
  markPreferenceFailed,
  markPreferenceSynchronized,
} from "../_shared/database.ts";
import { authorizedInternalRequest } from "../_shared/internal.ts";
import {
  sendConfirmation,
  sendsProviderPreferences,
  sendUpdate,
  synchronizePreference,
} from "../_shared/email.ts";
import { actionToken, tokenHash } from "../_shared/token.ts";
import { updateEmail } from "../_shared/update-email.ts";

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }
  if (!authorizedInternalRequest(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = database();
  let preferencesSynchronized = 0;
  let confirmationsSent = 0;
  let updatesSent = 0;

  const { data: preferences, error: preferenceQueryError } =
    sendsProviderPreferences()
      ? await db
        .from("email_contact_preferences")
        .select("contact_id, desired_status")
        .in("sync_status", ["pending", "failed"])
        .order("updated_at")
        .limit(25)
      : { data: [], error: null };
  if (preferenceQueryError) throw preferenceQueryError;

  for (const preference of preferences ?? []) {
    const { data: contact, error: contactError } = await db.from("contacts")
      .select("email").eq("id", preference.contact_id).single();
    if (contactError) {
      console.error(
        "Could not load contact for SES reconciliation",
        contactError,
      );
      continue;
    }

    try {
      await synchronizePreference(contact.email, preference.desired_status);
      await markPreferenceSynchronized(
        db,
        preference.contact_id,
        preference.desired_status,
      );
      preferencesSynchronized++;
    } catch (error) {
      console.error("Email preference reconciliation failed", error);
      await markPreferenceFailed(db, preference.contact_id, error);
    }
  }

  const { data: deliveries, error: claimError } = await db.rpc(
    "claim_deliveries",
    { p_limit: 10, p_lease: "5 minutes" },
  );
  if (claimError) throw claimError;

  for (const delivery of deliveries ?? []) {
    const { data: contact } = await db.from("contacts").select("email").eq(
      "id",
      delivery.contact_id,
    ).single();
    if (!contact) continue;

    const idempotencyKey = crypto.randomUUID();
    const { error: attemptError } = await db.from("delivery_attempts").insert({
      delivery_id: delivery.id,
      attempt_number: delivery.attempt_count,
      idempotency_key: idempotencyKey,
    });
    if (attemptError) {
      console.error("Could not record delivery attempt", attemptError);
      continue;
    }

    try {
      let actionTokenId = delivery.action_token_id;
      if (delivery.kind === "early_access_update" && !actionTokenId) {
        actionTokenId = crypto.randomUUID();
        const token = await actionToken(actionTokenId);
        const expiresAt = new Date(
          Date.now() + 5 * 365 * 24 * 60 * 60 * 1_000,
        ).toISOString();
        const { error: tokenError } = await db.from("action_tokens").insert({
          id: actionTokenId,
          contact_id: delivery.contact_id,
          purpose: "leave",
          token_hash: bytea(await tokenHash(token)),
          expires_at: expiresAt,
        });
        if (tokenError) throw tokenError;

        const { error: deliveryTokenError } = await db.from("deliveries")
          .update({ action_token_id: actionTokenId })
          .eq("id", delivery.id)
          .eq("claim_token", delivery.claim_token);
        if (deliveryTokenError) throw deliveryTokenError;
      }
      if (!actionTokenId) throw new Error("Delivery has no action token");

      const token = await actionToken(actionTokenId);
      let providerMessageId: string;
      if (delivery.kind === "confirmation") {
        const confirmationUrl = new URL(
          `/functions/v1/confirm-early-access?t=${encodeURIComponent(token)}`,
          requiredEnv("SUPABASE_URL"),
        ).toString();
        providerMessageId = await sendConfirmation(
          contact.email,
          confirmationUrl,
          delivery.id,
          idempotencyKey,
        );
      } else {
        const { data: message, error: messageError } = await db.from("messages")
          .select("slug, subject, content_digest")
          .eq("id", delivery.message_id)
          .single();
        if (messageError) throw messageError;

        const unsubscribeUrl = new URL(
          `/functions/v1/leave-early-access?t=${encodeURIComponent(token)}`,
          requiredEnv("SUPABASE_URL"),
        ).toString();
        const content = updateEmail(message.slug, unsubscribeUrl);
        if (
          message.subject !== content.subject ||
          message.content_digest !== content.contentDigest
        ) {
          throw new Error("Queued message metadata differs from its template");
        }

        await db.from("messages").update({ status: "sending" }).eq(
          "id",
          delivery.message_id,
        ).eq("status", "queued");
        providerMessageId = await sendUpdate(
          contact.email,
          content,
          unsubscribeUrl,
          delivery.id,
          message.slug,
          idempotencyKey,
        );
      }

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
          claimed_at: null,
          claim_expires_at: null,
          claim_token: null,
          failure_class: null,
          failure_code: null,
          failure_reason: null,
        }).eq("id", delivery.id).eq("claim_token", delivery.claim_token),
      ]);
      if (results.some((result) => result.error)) {
        throw new Error("Could not persist accepted delivery");
      }
      if (delivery.kind === "confirmation") {
        confirmationsSent++;
      } else {
        updatesSent++;
        const { count, error: remainingError } = await db.from("deliveries")
          .select("*", { count: "exact", head: true })
          .eq("message_id", delivery.message_id)
          .in("status", ["queued", "sending", "failed"]);
        if (remainingError) {
          console.error("Could not finalize message status", remainingError);
        } else if (count === 0) {
          await db.from("messages").update({
            status: "sent",
            completed_at: now,
          }).eq("id", delivery.message_id);
        }
      }
    } catch (error) {
      console.error("Delivery attempt failed", error);
      const now = new Date().toISOString();
      await Promise.all([
        db.from("delivery_attempts").update({
          completed_at: now,
          outcome: "transient_failure",
          failure_code: "email_send",
          failure_reason: errorMessage(error),
        }).eq("idempotency_key", idempotencyKey),
        db.from("deliveries").update({
          status: "failed",
          next_attempt_at: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
          failure_class: "transient",
          failure_code: "email_send",
          failure_reason: errorMessage(error),
          claimed_at: null,
          claim_expires_at: null,
          claim_token: null,
        }).eq("id", delivery.id).eq("claim_token", delivery.claim_token),
      ]);
    }
  }

  return Response.json({
    preferencesSynchronized,
    confirmationsSent,
    updatesSent,
  });
});
