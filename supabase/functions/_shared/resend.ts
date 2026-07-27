import { confirmationEmail } from "./confirmation-email.ts";
import { requiredEnv } from "./config.ts";

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
