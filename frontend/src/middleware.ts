import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_EXACT = new Set(["/login", "/api/auth/login", "/api/health"]);

function getSecret() {
  const secret = process.env.AUTH_SECRET || "german-tutor-dev-secret-change-in-prod";
  return new TextEncoder().encode(secret);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Never interfere with Next internals / static assets
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (PUBLIC_EXACT.has(pathname)) {
    return NextResponse.next();
  }

  // Agent summarize with shared secret
  if (pathname.startsWith("/api/session/summarize") && req.headers.get("x-agent-key")) {
    return NextResponse.next();
  }

  const token = req.cookies.get("gt_session")?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    return NextResponse.redirect(login);
  }

  try {
    await jwtVerify(token, getSecret());
    return NextResponse.next();
  } catch {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", req.url));
  }
}

export const config = {
  matcher: [
    "/login",
    "/profiles",
    "/profiles/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/api/:path*",
    "/",
  ],
};
