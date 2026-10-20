import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";

const prefsSchema = z.object({
  level: z.enum(["A1", "A2", "B1", "B2"]).optional(),
  size: z.number().int().min(0).max(3).optional(),
});

const putSchema = z.object({
  profileId: z.string().min(1).max(64),
  storyId: z.string().min(1).max(100).optional(),
  progress: z.number().min(0).max(1).optional(),
  prefs: prefsSchema.optional(),
});

// Always resolve the profile through the session's user, so one account (or profile)
// can never read or write another's reading state by guessing an id.
function ownedProfile(id: string, userId: string) {
  return prisma.profile.findFirst({ where: { id, userId }, select: { id: true, readingPrefs: true } });
}

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const profileId = req.nextUrl.searchParams.get("profileId") || "";
  const profile = await ownedProfile(profileId, session.userId);
  if (!profile) return jsonError("Profile not found", 404);

  const rows = await prisma.readingProgress.findMany({ where: { profileId: profile.id } });
  let prefs = {};
  try {
    prefs = prefsSchema.parse(JSON.parse(profile.readingPrefs));
  } catch {}

  return jsonOk(
    { progress: Object.fromEntries(rows.map((r) => [r.storyId, r.progress])), prefs },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  const parsed = putSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request");
  const { profileId, storyId, progress, prefs } = parsed.data;

  const profile = await ownedProfile(profileId, session.userId);
  if (!profile) return jsonError("Profile not found", 404);

  if (storyId !== undefined && progress !== undefined) {
    await prisma.readingProgress.upsert({
      where: { profileId_storyId: { profileId: profile.id, storyId } },
      update: { progress },
      create: { profileId: profile.id, storyId, progress },
    });
  }

  if (prefs) {
    let current = {};
    try {
      current = prefsSchema.parse(JSON.parse(profile.readingPrefs));
    } catch {}
    await prisma.profile.update({
      where: { id: profile.id },
      data: { readingPrefs: JSON.stringify({ ...current, ...prefs }) },
    });
  }

  return jsonOk({ ok: true });
}
