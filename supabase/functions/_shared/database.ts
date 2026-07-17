import { createClient } from "@supabase/supabase-js";
import { requiredEnv } from "./config.ts";

export function database() {
  return createClient(
    requiredEnv("SUPABASE_URL"),
    requiredEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

export function bytea(hex: string): string {
  return `\\x${hex}`;
}

export async function markPreferenceSynchronized(
  db: ReturnType<typeof database>,
  contactId: string,
  status: "OPT_IN" | "OPT_OUT",
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await db.from("ses_contact_preferences").update({
    observed_status: status,
    sync_status: "synced",
    last_attempted_at: now,
    synchronized_at: now,
    failure_reason: null,
  }).eq("contact_id", contactId).eq("topic_name", "archivist-early-access");
  if (error) throw error;
}

export async function markPreferenceFailed(
  db: ReturnType<typeof database>,
  contactId: string,
  reason: unknown,
): Promise<void> {
  const { error } = await db.from("ses_contact_preferences").update({
    sync_status: "failed",
    last_attempted_at: new Date().toISOString(),
    synchronized_at: null,
    failure_reason: errorMessage(reason),
  }).eq("contact_id", contactId).eq("topic_name", "archivist-early-access");
  if (error) console.error("Could not record SES preference failure", error);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
