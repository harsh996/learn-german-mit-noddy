import { NextRequest, NextResponse } from "next/server";
import { createSession, getSession, verifyLogin } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !password) {
      return jsonError("Username and password are required");
    }

    const user = await verifyLogin(username, password);
    if (!user) {
      return jsonError("Invalid credentials", 401);
    }

    await createSession({ userId: user.id, username: user.username });
    return jsonOk({ ok: true, username: user.username });
  } catch (err) {
    console.error("Login error:", err);
    return jsonError("Login failed", 500);
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
  return jsonOk({ authenticated: true, username: session.username });
}
