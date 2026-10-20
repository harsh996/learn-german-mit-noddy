import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  findUserByIdentifier,
  getSession,
  verifyPassword,
} from "@/lib/auth";
import { clientIp, readJsonBody } from "@/lib/auth-request";
import { EMAIL_MAX } from "@/lib/auth-validation";
import { clearKey, recordHit, retryAfterSeconds } from "@/lib/rate-limit";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS_PER_IP = 20;
const MAX_FAILS_PER_ACCOUNT = 10;

const NO_STORE = { "Cache-Control": "no-store" };

function fail(message: string, status: number, extra?: Record<string, string>) {
  return NextResponse.json(
    { error: message },
    { status, headers: { ...NO_STORE, ...extra } }
  );
}

function tooMany(retryAfter: number) {
  return fail("Too many attempts. Try again later.", 429, {
    "Retry-After": String(retryAfter),
  });
}

export async function POST(req: NextRequest) {
  try {
    const ipKey = `login:ip:${clientIp(req)}`;
    const ipWait = retryAfterSeconds(ipKey, MAX_FAILS_PER_IP);
    if (ipWait) return tooMany(ipWait);

    const body = await readJsonBody(req);
    if (!body) return fail("Invalid request", 400);

    const identifier = typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!identifier || !password) {
      return fail("Email or username and password are required", 400);
    }

    // Oversized identifiers can't match anything; treat as a normal failed login.
    const user = identifier.length <= EMAIL_MAX ? await findUserByIdentifier(identifier) : null;

    // Key by account id when it exists so logging in via email and via username
    // share one counter instead of doubling an attacker's guesses.
    const acctKey = user ? `login:user:${user.id}` : `login:nx:${identifier.slice(0, 64)}`;
    const acctWait = retryAfterSeconds(acctKey, MAX_FAILS_PER_ACCOUNT);
    if (acctWait) return tooMany(acctWait);

    const ok = await verifyPassword(user?.password, password);
    if (!user || !ok) {
      recordHit(ipKey, WINDOW_MS);
      recordHit(acctKey, WINDOW_MS);
      // Same response whether the account exists or not.
      return fail("Invalid credentials", 401);
    }

    clearKey(acctKey);
    await createSession({ userId: user.id, username: user.username });
    return NextResponse.json({ ok: true, username: user.username }, { headers: NO_STORE });
  } catch (err) {
    console.error("Login error:", err);
    return fail("Login failed", 500);
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401, headers: NO_STORE });
  }
  return NextResponse.json(
    { authenticated: true, username: session.username },
    { headers: NO_STORE }
  );
}
