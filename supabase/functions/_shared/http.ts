import { siteUrl } from "./config.ts";

export function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin");
  return origin === siteUrl()
    ? {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "content-type",
      "vary": "Origin",
    }
    : {};
}

export function redirect(path: string, status = 303): Response {
  return Response.redirect(new URL(path, siteUrl()), status);
}

export function json(
  body: unknown,
  status: number,
  headers: HeadersInit = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

export function acceptsHtml(request: Request): boolean {
  return request.headers.get("accept")?.includes("text/html") ?? false;
}

export async function requestField(
  request: Request,
  name: string,
): Promise<string | null> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = await request.json().catch(() => null) as
      | Record<string, unknown>
      | null;
    const value = body?.[name];
    return typeof value === "string" ? value : null;
  }

  const body = await request.formData().catch(() => null);
  const value = body?.get(name);
  return typeof value === "string" ? value : null;
}
