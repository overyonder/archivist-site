import { timingSafeEqual } from "node:crypto";
import { requiredEnv } from "./config.ts";

export function authorizedInternalRequest(request: Request): boolean {
  const supplied = request.headers.get("x-internal-secret") ?? "";
  const expected = requiredEnv("INTERNAL_FUNCTION_SECRET");
  const suppliedBytes = new TextEncoder().encode(supplied);
  const expectedBytes = new TextEncoder().encode(expected);
  return suppliedBytes.length === expectedBytes.length &&
    timingSafeEqual(suppliedBytes, expectedBytes);
}
