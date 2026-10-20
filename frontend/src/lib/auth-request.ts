import type { NextRequest } from "next/server";

const MAX_BODY_BYTES = 4096;

/**
 * Parses a small JSON object body. Requiring `application/json` also blocks
 * cross-site <form> posts (login CSRF), since browsers can't send that type
 * cross-origin without a CORS preflight, which we never grant.
 */
export async function readJsonBody(
  req: NextRequest
): Promise<Record<string, unknown> | null> {
  const type = req.headers.get("content-type") || "";
  if (!type.toLowerCase().startsWith("application/json")) return null;

  const declared = Number(req.headers.get("content-length") || 0);
  if (declared > MAX_BODY_BYTES) return null;

  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return null;
    const parsed: unknown = JSON.parse(text);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function clientIp(req: NextRequest): string {
  // cloudflared sets cf-connecting-ip. These headers are only trustworthy when
  // all traffic arrives through the tunnel; per-account limits cover the rest.
  const cf = req.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return "unknown";
}

export function signupEnabled(): boolean {
  return (process.env.ALLOW_SIGNUP ?? "true").trim().toLowerCase() !== "false";
}
