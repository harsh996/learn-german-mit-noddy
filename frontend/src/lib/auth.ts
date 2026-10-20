import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "crypto";
import { prisma } from "./prisma";
import { getAuthSecret, getAuthSecretString } from "./auth-secret";
import { PASSWORD_MAX_BYTES } from "./auth-validation";

const COOKIE_NAME = "gt_session";
const MAX_PROFILES = 10;

const BCRYPT_COST = 12;

export type SessionPayload = {
  userId: string;
  username: string;
};

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getAuthSecret());

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getAuthSecret(), { algorithms: ["HS256"] });
    const userId = payload.userId as string;
    const username = payload.username as string;
    if (!userId || !username) return null;
    return { userId, username };
  } catch {
    return null;
  }
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error("UNAUTHORIZED");
  }
  return session;
}

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_COST);
}

let dummyHash: string | undefined;
function getDummyHash() {
  // Compared against when the account doesn't exist, so "unknown user" costs the
  // same time as "wrong password" and response timing doesn't reveal which exist.
  return (dummyHash ??= bcrypt.hashSync("timing-equalizer-not-a-real-password", BCRYPT_COST));
}

/** Constant-work password check; `hash` is undefined for unknown accounts. */
export async function verifyPassword(hash: string | undefined, password: string) {
  // bcrypt silently truncates at 72 bytes, so refuse to compare longer input.
  const size = Buffer.byteLength(password);
  const usable = size > 0 && size <= PASSWORD_MAX_BYTES;
  const match = await bcrypt.compare(usable ? password : "x", hash ?? getDummyHash());
  return Boolean(hash) && usable && match;
}

/** `identifier` is already trimmed + lowercased. Usernames can't contain "@", so it's unambiguous. */
export function findUserByIdentifier(identifier: string) {
  return identifier.includes("@")
    ? prisma.user.findUnique({ where: { email: identifier } })
    : prisma.user.findUnique({ where: { username: identifier } });
}

/** True if `header` equals the shared agent key (constant-time). */
export function isAgentKey(header: string | null) {
  if (!header) return false;
  const a = createHash("sha256").update(header).digest();
  const b = createHash("sha256").update(getAuthSecretString()).digest();
  return timingSafeEqual(a, b);
}

export { MAX_PROFILES, COOKIE_NAME };
