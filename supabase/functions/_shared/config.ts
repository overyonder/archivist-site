export function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

export const siteUrl = () => new URL(requiredEnv("ARCHIVIST_SITE_URL")).origin;

export const earlyAccessTopic = () =>
  Deno.env.get("SES_TOPIC_NAME")?.trim() || "archivist-early-access";
