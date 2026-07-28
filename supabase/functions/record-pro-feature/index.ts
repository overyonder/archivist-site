import { bytea, database } from "../_shared/database.ts";
import { corsHeaders, json } from "../_shared/http.ts";
import { requestFingerprint } from "../_shared/token.ts";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const slugPattern = /^[a-z0-9][a-z0-9-]{0,63}$/;

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const body = await request.json().catch(() => null) as
    | Record<string, unknown>
    | null;
  const field = (name: string) =>
    typeof body?.[name] === "string" ? body[name] as string : null;
  const subjectId = field("subject_id");
  const firstFeature = field("first_feature");

  if (
    !subjectId ||
    !uuidPattern.test(subjectId) ||
    !firstFeature ||
    !slugPattern.test(firstFeature)
  ) {
    return json({ error: "Invalid Pro feature record" }, 400, cors);
  }

  const sourceAddress = request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const { error } = await database().rpc("record_pro_feature", {
    p_subject_id: subjectId,
    p_first_feature: firstFeature,
    p_request_fingerprint: bytea(
      await requestFingerprint(`ip:${sourceAddress}`),
    ),
  });

  if (error) {
    if (error.code === "P0001") return json({ accepted: false }, 429, cors);
    console.error("Pro feature order could not be recorded", error);
    return json(
      { error: "The Pro feature order could not be recorded" },
      500,
      cors,
    );
  }

  return new Response(null, { status: 204, headers: cors });
});
