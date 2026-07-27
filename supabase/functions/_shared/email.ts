import {
  sendSesConfirmation,
  sendSesUpdate,
  synchronizeSesPreference,
} from "./ses.ts";
import { sendResendConfirmation, sendResendUpdate } from "./resend.ts";
import type { UpdateEmail } from "./update-email.ts";

type PreferenceStatus = "OPT_IN" | "OPT_OUT";

function provider(): "resend" | "ses" {
  const value = Deno.env.get("EMAIL_PROVIDER")?.trim().toLowerCase() || "ses";
  if (value === "resend" || value === "ses") return value;
  throw new Error(`Unsupported email provider: ${value}`);
}

export function sendsProviderPreferences(): boolean {
  return provider() === "ses";
}

export function sendConfirmation(
  email: string,
  confirmationUrl: string,
  deliveryId: string,
  idempotencyKey: string,
): Promise<string> {
  return provider() === "resend"
    ? sendResendConfirmation(
      email,
      confirmationUrl,
      deliveryId,
      idempotencyKey,
    )
    : sendSesConfirmation(email, confirmationUrl, deliveryId);
}

export function synchronizePreference(
  email: string,
  status: PreferenceStatus,
): Promise<void> {
  return provider() === "ses"
    ? synchronizeSesPreference(email, status)
    : Promise.resolve();
}

export function sendUpdate(
  email: string,
  content: UpdateEmail,
  unsubscribeUrl: string,
  deliveryId: string,
  messageSlug: string,
  idempotencyKey: string,
): Promise<string> {
  return provider() === "resend"
    ? sendResendUpdate(
      email,
      content,
      unsubscribeUrl,
      deliveryId,
      messageSlug,
      idempotencyKey,
    )
    : sendSesUpdate(
      email,
      content,
      unsubscribeUrl,
      deliveryId,
      messageSlug,
    );
}
