import {
  bytea,
  database,
  markPreferenceFailed,
  markPreferenceSynchronized,
} from "../_shared/database.ts";
import { acceptsHtml, redirect, requestField } from "../_shared/http.ts";
import { synchronizePreference } from "../_shared/ses.ts";
import { tokenHash } from "../_shared/token.ts";

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("t");

  if (request.method === "GET") {
    if (!queryToken) return redirect("/early-access/link-invalid/");
    return redirect(`/early-access/leave/?t=${encodeURIComponent(queryToken)}`);
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const oneClick = request.headers.get("content-type")?.includes(
      "application/x-www-form-urlencoded",
    )
    ? await request.clone().formData().then((form) =>
      form.get("List-Unsubscribe") === "One-Click"
    ).catch(() => false)
    : false;
  const token = queryToken ?? await requestField(request, "token");
  if (!token) {
    return acceptsHtml(request)
      ? redirect("/early-access/link-invalid/")
      : new Response(null, { status: 400 });
  }

  const db = database();
  const { data, error } = await db.rpc("leave_early_access", {
    p_token_hash: bytea(await tokenHash(token)),
    p_source: oneClick ? "rfc8058" : "removal_page",
  });

  if (error) {
    console.error("Removal failed", error);
    return acceptsHtml(request)
      ? redirect("/early-access/error/")
      : new Response(null, { status: 500 });
  }

  if (data?.outcome !== "left") {
    return acceptsHtml(request)
      ? redirect("/early-access/link-invalid/")
      : new Response(null, { status: 200 });
  }

  try {
    await synchronizePreference(data.email, "OPT_OUT");
    await markPreferenceSynchronized(db, data.contact_id, "OPT_OUT");
  } catch (syncError) {
    console.error("SES opt-out synchronization failed", syncError);
    await markPreferenceFailed(db, data.contact_id, syncError);
  }

  return acceptsHtml(request)
    ? redirect("/early-access/left/")
    : new Response(null, { status: 200 });
});
