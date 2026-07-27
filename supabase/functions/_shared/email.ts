import {
  sendSesConfirmation,
  synchronizeSesPreference,
} from "./ses.ts";
import { sendResendConfirmation } from "./resend.ts";

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
