const encoder = new TextEncoder();

export async function actionToken(tokenId: string): Promise<string> {
  const secret = Deno.env.get("ACTION_TOKEN_SIGNING_KEY")?.trim();
  if (!secret) throw new Error("Missing ACTION_TOKEN_SIGNING_KEY");

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(tokenId),
  );
  return `${tokenId}.${base64Url(new Uint8Array(signature))}`;
}

export async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function requestFingerprint(value: string): Promise<string> {
  const secret = Deno.env.get("ACTION_TOKEN_SIGNING_KEY")?.trim();
  if (!secret) throw new Error("Missing ACTION_TOKEN_SIGNING_KEY");

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(`early-access-request:${value}`),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(
    /=+$/,
    "",
  );
}
