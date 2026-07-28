import { bytea, database } from "../_shared/database.ts";
import { corsHeaders, json } from "../_shared/http.ts";
import { requestFingerprint } from "../_shared/token.ts";

const emphasisKey = "pro-benefit-emphasis-v1";
const features = new Set(["canon", "atlas"]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  const key = field("emphasis_key");
  const subjectId = field("subject_id");
  const initialFeature = field("initial_feature");
  const eventId = field("event_id");
  const selectedFeature = field("selected_feature");

  if (
    key !== emphasisKey ||
    !subjectId ||
    !uuidPattern.test(subjectId) ||
    !initialFeature ||
    !features.has(initialFeature) ||
    ((eventId === null) !== (selectedFeature === null)) ||
    (eventId !== null && !uuidPattern.test(eventId)) ||
    (selectedFeature !== null && !features.has(selectedFeature))
  ) {
    return json({ error: "Invalid feature emphasis" }, 400, cors);
  }

  const sourceAddress = request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown";
  const { error } = await database().rpc("record_feature_emphasis", {
    p_emphasis_key: key,
    p_subject_id: subjectId,
    p_initial_feature: initialFeature,
    p_request_fingerprint: bytea(
      await requestFingerprint(`ip:${sourceAddress}`),
    ),
    p_event_id: eventId,
    p_selected_feature: selectedFeature,
  });

  if (error) {
    if (error.code === "P0001") return json({ accepted: false }, 429, cors);
    console.error("Feature emphasis could not be recorded", error);
    return json(
      { error: "The feature emphasis could not be recorded" },
      500,
      cors,
    );
  }

  return new Response(null, { status: 204, headers: cors });
});
