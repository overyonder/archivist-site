import {
  bytea,
  database,
  markPreferenceFailed,
  markPreferenceSynchronized,
} from "../_shared/database.ts";
import { siteUrl } from "../_shared/config.ts";
import { acceptsHtml, redirect, requestField } from "../_shared/http.ts";
import { synchronizePreference } from "../_shared/email.ts";
import { tokenHash } from "../_shared/token.ts";

Deno.serve(async (request) => {
  const url = new URL(request.url);
  const queryToken = url.searchParams.get("t");

  if (request.method === "GET") {
    if (!queryToken) return redirect("/early-access/link-invalid/");
    return removalPage();
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
    console.error("Email opt-out synchronization failed", syncError);
    await markPreferenceFailed(db, data.contact_id, syncError);
  }

  return acceptsHtml(request)
    ? redirect("/early-access/left/")
    : new Response(null, { status: 200 });
});

function removalPage(): Response {
  const publicSite = new URL(siteUrl());
  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
  <title>Stop notifications — Archivist</title>
  <link rel="icon" href="${
      attribute(new URL("/mark.svg", publicSite).toString())
    }" type="image/svg+xml">
  <link rel="stylesheet" href="${
      attribute(new URL("/styles.css", publicSite).toString())
    }">
  <link rel="stylesheet" href="${
      attribute(new URL("/theme.css", publicSite).toString())
    }">
  <link rel="stylesheet" href="${
      attribute(new URL("/early-access.css", publicSite).toString())
    }">
</head>
<body class="utility-page">
  <header class="utility-header"><a class="brand" href="${
      attribute(publicSite.toString())
    }"><img src="${
      attribute(new URL("/mark.svg", publicSite).toString())
    }" alt="" width="26" height="26"><span>Archivist</span></a><span class="status"><i></i> Release notifications</span></header>
  <main class="utility-main"><section class="utility-state"><p class="utility-kicker">Release notifications</p><h1>Stop notifications?</h1><p>We’ll remove this address and won’t email it when paid early access or Archivist Free becomes available.</p><div class="utility-actions"><form method="post"><button class="utility-action" type="submit">Yes, remove me <span aria-hidden="true">→</span></button></form><a class="utility-action secondary" href="${
      attribute(publicSite.toString())
    }">Keep notifying me</a></div></section></main>
  <footer class="utility-footer"><span>Archivist release notifications</span><a href="https://over-yonder.tech/">An over|yonder product ↗</a></footer>
</body>
</html>`,
    {
      status: 200,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8",
      },
    },
  );
}

function attribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
