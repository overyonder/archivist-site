import {
  bytea,
  database,
  markPreferenceFailed,
  markPreferenceSynchronized,
} from "../_shared/database.ts";
import { siteUrl } from "../_shared/config.ts";
import { redirect } from "../_shared/http.ts";
import { synchronizePreference } from "../_shared/email.ts";
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
    return retryPage(request, token);
  }

  if (data?.outcome !== "confirmed") {
    return redirect("/early-access/link-invalid/");
  }

  try {
    await synchronizePreference(data.email, "OPT_IN");
    await markPreferenceSynchronized(db, data.contact_id, "OPT_IN");
  } catch (syncError) {
    console.error("Email opt-in synchronization failed", syncError);
    await markPreferenceFailed(db, data.contact_id, syncError);
  }

  return redirect("/early-access/joined/");
});

function retryPage(request: Request, token: string): Response {
  const retryUrl = new URL(request.url);
  retryUrl.search = "";
  retryUrl.searchParams.set("t", token);
  const publicSite = new URL(siteUrl());

  return new Response(
    `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
  <title>Something went wrong — Archivist</title>
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
  <main class="utility-main"><section class="utility-state"><p class="utility-kicker">Temporary problem</p><h1>That didn’t work.</h1><p>Your notification status hasn’t changed. Please wait a moment and try the confirmation again.</p><div class="utility-actions"><a class="utility-action" href="${
      attribute(retryUrl.toString())
    }">Try confirmation again <span aria-hidden="true">→</span></a><a class="utility-action secondary" href="mailto:hello@over-yonder.tech">Contact us</a></div></section></main>
  <footer class="utility-footer"><span>Archivist release notifications</span><a href="https://over-yonder.tech/">An over|yonder product ↗</a></footer>
</body>
</html>`,
    {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "content-type": "text/html; charset=utf-8",
        "retry-after": "5",
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
