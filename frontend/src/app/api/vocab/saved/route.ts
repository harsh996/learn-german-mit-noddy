import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ownedProfile } from "@/lib/profile";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";

const saveSchema = z.object({
  profileId: z.string().min(1).max(64),
  wordKey: z.string().trim().min(1).max(200),
  word: z.string().trim().min(1).max(100),
  article: z.string().max(10).nullish(),
  pos: z.string().max(30).nullish(),
  level: z.string().max(8).nullish(),
  translation: z.string().trim().max(300).default(""),
});

// Saved words belong to a learner profile; the profile is always resolved through the
// logged-in user, so ids from another account or profile are rejected with a 404.

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const profile = await ownedProfile(req.nextUrl.searchParams.get("profileId") || "", session.userId);
  if (!profile) return jsonError("Profile not found", 404);

  const words = await prisma.savedWord.findMany({
    where: { profileId: profile.id },
    orderBy: { createdAt: "desc" },
  });
  return jsonOk({ words }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message || "Invalid word");

  const { profileId, wordKey, ...data } = parsed.data;
  const profile = await ownedProfile(profileId, session.userId);
  if (!profile) return jsonError("Profile not found", 404);

  const word = await prisma.savedWord.upsert({
    where: { profileId_wordKey: { profileId: profile.id, wordKey } },
    update: {},
    create: { userId: session.userId, profileId: profile.id, wordKey, ...data },
  });
  return jsonOk({ word }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const wordKey = req.nextUrl.searchParams.get("wordKey");
  if (!wordKey) return jsonError("wordKey required");
  const profile = await ownedProfile(req.nextUrl.searchParams.get("profileId") || "", session.userId);
  if (!profile) return jsonError("Profile not found", 404);

  await prisma.savedWord.deleteMany({ where: { profileId: profile.id, wordKey } });
  return jsonOk({ ok: true });
}
