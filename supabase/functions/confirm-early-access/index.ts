import {
  bytea,
  database,
  markPreferenceFailed,
  markPreferenceSynchronized,
} from "../_shared/database.ts";
import { redirect } from "../_shared/http.ts";
import { synchronizePreference } from "../_shared/ses.ts";
import { tokenHash } from "../_shared/token.ts";

Deno.serve(async (request) => {
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const token = new URL(request.url).searchParams.get("t");
  if (!token) return redirect("/early-access/link-invalid/");

  const db = database();
  const { data, error } = await db.rpc("confirm_early_access", {
    p_token_hash: bytea(await tokenHash(token)),
  });

  if (error) {
    console.error("Confirmation failed", error);
    return redirect("/early-access/error/");
  }

  if (data?.outcome !== "confirmed") {
    return redirect("/early-access/link-invalid/");
  }

  try {
    await synchronizePreference(data.email, "OPT_IN");
    await markPreferenceSynchronized(db, data.contact_id, "OPT_IN");
  } catch (syncError) {
    console.error("SES opt-in synchronization failed", syncError);
    await markPreferenceFailed(db, data.contact_id, syncError);
  }

  return redirect("/early-access/joined/");
});
