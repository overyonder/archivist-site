import { database } from "../_shared/database.ts";
import { corsHeaders, json } from "../_shared/http.ts";

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { data, error } = await database().rpc("early_access_status");
  if (error) {
    console.error("Early-access status failed", error);
    return json({ error: "Status unavailable" }, 503, cors);
  }
  return json(data, 200, {
    ...cors,
    "cache-control": "public, max-age=30, stale-while-revalidate=120",
  });
});
