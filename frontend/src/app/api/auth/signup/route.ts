import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createSession, hashPassword } from "@/lib/auth";
import { clientIp, readJsonBody, signupEnabled } from "@/lib/auth-request";
import {
  normalizeEmail,
  normalizeUsername,
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/auth-validation";
import { recordHit, retryAfterSeconds } from "@/lib/rate-limit";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_SIGNUPS_PER_IP = 10;
const NO_STORE = { "Cache-Control": "no-store" };

function fail(message: string, status: number, extra?: Record<string, string>) {
  return NextResponse.json({ error: message }, { status, headers: { ...NO_STORE, ...extra } });
}

export async function GET() {
  return NextResponse.json({ enabled: signupEnabled() }, { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  if (!signupEnabled()) return fail("Sign-up is currently closed", 403);

  try {
    const body = await readJsonBody(req);
    if (!body) return fail("Invalid request", 400);

    const email = normalizeEmail(typeof body.email === "string" ? body.email : "");
    const username = normalizeUsername(typeof body.username === "string" ? body.username : "");
    const password = typeof body.password === "string" ? body.password : "";

    const problem =
      validateEmail(email) ||
      validateUsername(username) ||
      validatePassword(password, { email, username });
    if (problem) return fail(problem, 400);

    // Counted after validation so typos are free but probing for taken emails is not.
    const ipKey = `signup:ip:${clientIp(req)}`;
    const wait = retryAfterSeconds(ipKey, MAX_SIGNUPS_PER_IP);
    if (wait) {
      return fail("Too many sign-up attempts. Try again later.", 429, {
        "Retry-After": String(wait),
      });
    }
    recordHit(ipKey, WINDOW_MS);

    // Hash before touching the DB so "new" and "already registered" take equally long.
    const hash = await hashPassword(password);

    let user;
    try {
      user = await prisma.user.create({ data: { email, username, password: hash } });
    } catch (err) {
      // The DB unique constraints are the source of truth (no check-then-insert race).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = JSON.stringify(err.meta?.target ?? "");
        if (target.includes("username")) return fail("That username is already taken", 409);
        return fail("Could not create account. If you already have one, log in instead.", 409);
      }
      throw err;
    }

    await createSession({ userId: user.id, username: user.username });
    return NextResponse.json({ ok: true, username: user.username }, { status: 201, headers: NO_STORE });
  } catch (err) {
    console.error("Signup error:", err);
    return fail("Sign-up failed", 500);
  }
}
