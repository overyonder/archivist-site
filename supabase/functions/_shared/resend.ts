import { confirmationEmail } from "./confirmation-email.ts";
import { requiredEnv } from "./config.ts";
import type { UpdateEmail } from "./update-email.ts";

interface ResendResponse {
  id?: string;
  message?: string;
  name?: string;
}

export async function sendResendConfirmation(
  email: string,
  confirmationUrl: string,
  deliveryId: string,
  idempotencyKey: string,
): Promise<string> {
  const content = confirmationEmail(confirmationUrl);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: requiredEnv("EMAIL_FROM"),
      to: [email],
      subject: content.subject,
      html: content.html,
      text: content.text,
      tags: [
        { name: "message-kind", value: "early-access-confirmation" },
        { name: "delivery-id", value: deliveryId },
      ],
    }),
  });
  const result = await response.json().catch(() => ({})) as ResendResponse;
  if (!response.ok) {
    throw new Error(
      `Resend rejected mail (${response.status}): ${
        result.message || result.name || "unknown error"
      }`,
    );
  }
  if (!result.id) throw new Error("Resend accepted mail without a message ID");
  return result.id;
}

export async function sendResendUpdate(
  email: string,
  content: UpdateEmail,
  unsubscribeUrl: string,
  deliveryId: string,
  messageSlug: string,
  idempotencyKey: string,
): Promise<string> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${requiredEnv("RESEND_API_KEY")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify({
      from: requiredEnv("EMAIL_FROM"),
      to: [email],
      subject: content.subject,
      html: content.html,
      text: content.text,
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
      tags: [
        { name: "message-kind", value: "early-access-update" },
        { name: "message-slug", value: messageSlug },
        { name: "delivery-id", value: deliveryId },
      ],
    }),
  });
  const result = await response.json().catch(() => ({})) as ResendResponse;
  if (!response.ok) {
    throw new Error(
      `Resend rejected mail (${response.status}): ${
        result.message || result.name || "unknown error"
      }`,
    );
  }
  if (!result.id) throw new Error("Resend accepted mail without a message ID");
  return result.id;
}
