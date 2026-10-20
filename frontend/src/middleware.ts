import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { getAuthSecret } from "@/lib/auth-secret";

const PUBLIC_EXACT = new Set([
  "/login",
  "/signup",
  "/api/auth/login",
  "/api/auth/signup",
  "/api/health",
]);

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
    await jwtVerify(token, getAuthSecret(), { algorithms: ["HS256"] });
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
    "/signup",
    "/profiles",
    "/profiles/:path*",
    "/dashboard",
    "/dashboard/:path*",
    "/vocab",
    "/vocab/:path*",
    "/reading",
    "/api/:path*",
    "/",
  ],
};
