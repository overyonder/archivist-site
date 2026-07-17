import { requiredEnv } from "./config.ts";

interface TurnstileResult {
  success: boolean;
  hostname?: string;
  action?: string;
  "error-codes"?: string[];
}

export async function verifyEarlyAccessChallenge(
  token: string,
): Promise<boolean> {
  const body = new URLSearchParams({
    secret: requiredEnv("TURNSTILE_SECRET_KEY"),
    response: token,
    idempotency_key: crypto.randomUUID(),
  });

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5_000),
    },
  );
  if (!response.ok) return false;

  const result = await response.json() as TurnstileResult;
  return result.success === true &&
    result.hostname === "archivist.over-yonder.tech" &&
    result.action === "early-access";
}
