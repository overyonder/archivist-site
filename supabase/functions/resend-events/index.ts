import { Webhook } from "svix";
import {
  database,
  markPreferenceFailed,
  markPreferenceSynchronized,
} from "../_shared/database.ts";
import { requiredEnv } from "../_shared/config.ts";
import { synchronizePreference } from "../_shared/email.ts";

interface ResendEvent {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    to?: string[];
    tags?: Record<string, string>;
    bounce?: {
      type?: string;
    };
    suppressed?: {
      message?: string;
      type?: string;
    };
  };
}

const eventKinds = new Map([
  ["email.sent", "send"],
  ["email.delivered", "delivery"],
  ["email.delivery_delayed", "delivery_delayed"],
  ["email.bounced", "bounce"],
  ["email.complained", "complaint"],
  ["email.failed", "reject"],
  ["email.suppressed", "suppression"],
  ["email.opened", "open"],
  ["email.clicked", "click"],
]);

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const rawBody = await request.text();
  let event: ResendEvent;
  try {
    event = new Webhook(requiredEnv("RESEND_WEBHOOK_SECRET")).verify(rawBody, {
      "svix-id": requiredHeader(request, "svix-id"),
      "svix-timestamp": requiredHeader(request, "svix-timestamp"),
      "svix-signature": requiredHeader(request, "svix-signature"),
    }) as ResendEvent;
  } catch (error) {
    console.error("Rejected Resend webhook", error);
    return new Response("Invalid webhook", { status: 401 });
  }

  const kind = event.type ? eventKinds.get(event.type) : undefined;
  const providerMessageId = event.data?.email_id;
  if (!kind || !providerMessageId) return new Response(null, { status: 204 });

  const providerEventId = requiredHeader(request, "svix-id");
  const hardBounce = kind === "bounce" &&
    event.data?.bounce?.type === "Permanent";
  const deliveryId = event.data?.tags?.["delivery-id"] || null;
  const db = database();
  const { data: recorded, error } = await db.rpc("record_delivery_event", {
    p_provider_event_id: providerEventId,
    p_provider_message_id: providerMessageId,
    p_delivery_id: deliveryId,
    p_kind: kind,
    p_payload: event,
    p_occurred_at: event.created_at || new Date().toISOString(),
    p_hard_bounce: hardBounce,
  });
  if (error) {
    console.error("Could not record Resend event", error);
    return new Response(null, { status: 500 });
  }

  if (
    recorded &&
    (kind === "complaint" || kind === "suppression" || hardBounce)
  ) {
    const { data: delivery } = await db.from("deliveries")
      .select("contact_id").eq("provider_message_id", providerMessageId)
      .maybeSingle();
    if (delivery?.contact_id) {
      const { data: contact } = await db.from("contacts")
        .select("email").eq("id", delivery.contact_id).single();
      if (contact?.email) {
        try {
          await synchronizePreference(contact.email, "OPT_OUT");
          await markPreferenceSynchronized(
            db,
            delivery.contact_id,
            "OPT_OUT",
          );
        } catch (syncError) {
          console.error(
            "Resend suppression preference synchronization failed",
            syncError,
          );
          await markPreferenceFailed(db, delivery.contact_id, syncError);
        }
      }
    }
  }

  return new Response(null, { status: 204 });
});

function requiredHeader(request: Request, name: string): string {
  const value = request.headers.get(name)?.trim();
  if (!value) throw new Error(`Missing required header: ${name}`);
  return value;
}
