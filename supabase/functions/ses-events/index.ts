import {
  database,
  markPreferenceFailed,
  markPreferenceSynchronized,
} from "../_shared/database.ts";
import { earlyAccessTopic } from "../_shared/config.ts";
import { synchronizePreference } from "../_shared/ses.ts";
import {
  confirmSnsSubscription,
  type SnsEnvelope,
  verifySnsEnvelope,
} from "../_shared/sns.ts";

interface SesEvent {
  eventType?: string;
  mail?: {
    messageId?: string;
    timestamp?: string;
    destination?: string[];
    tags?: Record<string, string[]>;
  };
  bounce?: { bounceType?: string };
  subscription?: {
    timestamp?: string;
    newTopicPreferences?: {
      unsubscribeAll?: boolean;
      topicSubscriptionStatus?: Array<{
        topicName?: string;
        subscriptionStatus?: "OptIn" | "OptOut";
      }>;
    };
  };
}

const eventKinds = new Map([
  ["Send", "send"],
  ["Delivery", "delivery"],
  ["Bounce", "bounce"],
  ["Complaint", "complaint"],
  ["Reject", "reject"],
  ["Open", "open"],
  ["Click", "click"],
  ["Rendering Failure", "rendering_failure"],
  ["Subscription", "preference_change"],
]);

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  let envelope: SnsEnvelope;
  try {
    envelope = await request.json() as SnsEnvelope;
    await verifySnsEnvelope(envelope);
  } catch (error) {
    console.error("Rejected SNS request", error);
    return new Response("Invalid notification", { status: 401 });
  }

  if (envelope.Type === "SubscriptionConfirmation") {
    try {
      await confirmSnsSubscription(envelope);
      return new Response(null, { status: 204 });
    } catch (error) {
      console.error("SNS subscription confirmation failed", error);
      return new Response(null, { status: 502 });
    }
  }

  if (envelope.Type !== "Notification") {
    return new Response(null, { status: 204 });
  }

  let event: SesEvent;
  try {
    event = JSON.parse(envelope.Message) as SesEvent;
  } catch {
    return new Response("Invalid SES event", { status: 400 });
  }

  const kind = event.eventType ? eventKinds.get(event.eventType) : undefined;
  const sesMessageId = event.mail?.messageId;
  if (!kind || !sesMessageId) return new Response(null, { status: 204 });

  const db = database();
  const hardBounce = kind === "bounce" &&
    event.bounce?.bounceType === "Permanent";
  const { data: recorded, error } = await db.rpc("record_delivery_event", {
    p_provider_event_id: envelope.MessageId,
    p_ses_message_id: sesMessageId,
    p_delivery_id: event.mail?.tags?.["delivery-id"]?.[0] || null,
    p_kind: kind,
    p_payload: event,
    p_occurred_at: event.mail?.timestamp || envelope.Timestamp,
    p_hard_bounce: hardBounce,
  });

  if (error) {
    console.error("Could not record SES event", error);
    return new Response(null, { status: 500 });
  }

  if (kind === "preference_change") {
    const preferences = event.subscription?.newTopicPreferences;
    const topicStatus = preferences?.topicSubscriptionStatus?.find((entry) =>
      entry.topicName === earlyAccessTopic()
    )?.subscriptionStatus;
    const status = preferences?.unsubscribeAll || topicStatus === "OptOut"
      ? "OPT_OUT"
      : topicStatus === "OptIn"
      ? "OPT_IN"
      : null;
    const email = event.mail?.destination?.[0];

    if (status && email) {
      const { error: preferenceError } = await db.rpc(
        "apply_ses_preference_event",
        {
          p_email: email,
          p_status: status,
          p_provider_event_id: envelope.MessageId,
          p_occurred_at: event.subscription?.timestamp || envelope.Timestamp,
        },
      );
      if (preferenceError) {
        console.error("Could not apply SES preference event", preferenceError);
        return new Response(null, { status: 500 });
      }
    }
  }

  if (recorded && (kind === "complaint" || hardBounce)) {
    const { data: delivery } = await db.from("deliveries")
      .select("contact_id").eq("ses_message_id", sesMessageId).maybeSingle();
    if (delivery?.contact_id) {
      const { data: contact } = await db.from("contacts")
        .select("email").eq("id", delivery.contact_id).single();
      if (contact?.email) {
        try {
          await synchronizePreference(contact.email, "OPT_OUT");
          await markPreferenceSynchronized(db, delivery.contact_id, "OPT_OUT");
        } catch (syncError) {
          console.error(
            "SES suppression preference synchronization failed",
            syncError,
          );
          await markPreferenceFailed(db, delivery.contact_id, syncError);
        }
      }
    }
  }

  return new Response(null, { status: 204 });
});
