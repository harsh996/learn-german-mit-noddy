import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession, MAX_PROFILES } from "@/lib/auth";
import { AVATARS, CEFR_LEVELS } from "@/lib/safety";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";

const createSchema = z.object({
  name: z.string().trim().min(1).max(40),
  level: z.enum(CEFR_LEVELS),
  avatarGender: z.enum(["female", "male"]),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();

  const profiles = await prisma.profile.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
    include: {
      memories: {
        orderBy: { occurrenceCount: "desc" },
        take: 5,
      },
      _count: { select: { sessions: true, memories: true } },
    },
  });

  return jsonOk({ profiles, maxProfiles: MAX_PROFILES });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();

  try {
    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid profile data");
    }

    const count = await prisma.profile.count({ where: { userId: session.userId } });
    if (count >= MAX_PROFILES) {
      return jsonError(`Maximum of ${MAX_PROFILES} profiles allowed`, 403);
    }

    const avatar = AVATARS.find((a) => a.gender === parsed.data.avatarGender);
    if (!avatar) return jsonError("Invalid avatar selection");

    const profile = await prisma.profile.create({
      data: {
        userId: session.userId,
        name: parsed.data.name,
        level: parsed.data.level,
        avatarGender: avatar.gender,
        avatarName: avatar.name,
      },
    });

    return jsonOk({ profile }, { status: 201 });
  } catch (err) {
    console.error("Create profile error:", err);
    return jsonError("Failed to create profile", 500);
  }
}
