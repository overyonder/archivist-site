import { requiredEnv } from "../_shared/config.ts";
import {
  database,
  errorMessage,
  markPreferenceFailed,
  markPreferenceSynchronized,
} from "../_shared/database.ts";
import { authorizedInternalRequest } from "../_shared/internal.ts";
import { sendConfirmation, synchronizePreference } from "../_shared/ses.ts";
import { actionToken } from "../_shared/token.ts";

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

  const { data: preferences, error: preferenceQueryError } = await db
    .from("ses_contact_preferences")
    .select("contact_id, desired_status")
    .in("sync_status", ["pending", "failed"])
    .order("updated_at")
    .limit(25);
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
      console.error("SES preference reconciliation failed", error);
      await markPreferenceFailed(db, preference.contact_id, error);
    }
  }

  const { data: deliveries, error: claimError } = await db.rpc(
    "claim_confirmation_deliveries",
    { p_limit: 10, p_lease: "5 minutes" },
  );
  if (claimError) throw claimError;

  for (const delivery of deliveries ?? []) {
    const [{ data: tokenRow }, { data: contact }] = await Promise.all([
      db.from("action_tokens").select("id").eq("id", delivery.action_token_id)
        .single(),
      db.from("contacts").select("email").eq("id", delivery.contact_id)
        .single(),
    ]);
    if (!tokenRow || !contact) continue;

    const idempotencyKey = crypto.randomUUID();
    const { error: attemptError } = await db.from("delivery_attempts").insert({
      delivery_id: delivery.id,
      attempt_number: delivery.attempt_count,
      idempotency_key: idempotencyKey,
    });
    if (attemptError) {
      console.error("Could not record confirmation retry", attemptError);
      continue;
    }

    try {
      const token = await actionToken(tokenRow.id);
      const confirmationUrl = new URL(
        `/functions/v1/confirm-early-access?t=${encodeURIComponent(token)}`,
        requiredEnv("SUPABASE_URL"),
      ).toString();
      const sesMessageId = await sendConfirmation(
        contact.email,
        confirmationUrl,
        delivery.id,
      );
      const now = new Date().toISOString();
      const results = await Promise.all([
        db.from("delivery_attempts").update({
          completed_at: now,
          outcome: "accepted",
          ses_message_id: sesMessageId,
        }).eq("idempotency_key", idempotencyKey),
        db.from("deliveries").update({
          status: "accepted",
          ses_message_id: sesMessageId,
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
        throw new Error("Could not persist accepted confirmation retry");
      }
      confirmationsSent++;
    } catch (error) {
      console.error("Confirmation retry failed", error);
      const now = new Date().toISOString();
      await Promise.all([
        db.from("delivery_attempts").update({
          completed_at: now,
          outcome: "transient_failure",
          failure_code: "ses_send",
          failure_reason: errorMessage(error),
        }).eq("idempotency_key", idempotencyKey),
        db.from("deliveries").update({
          status: "failed",
          next_attempt_at: new Date(Date.now() + 15 * 60 * 1_000).toISOString(),
          failure_class: "transient",
          failure_code: "ses_send",
          failure_reason: errorMessage(error),
          claimed_at: null,
          claim_expires_at: null,
          claim_token: null,
        }).eq("id", delivery.id).eq("claim_token", delivery.claim_token),
      ]);
    }
  }

  return Response.json({ preferencesSynchronized, confirmationsSent });
});
