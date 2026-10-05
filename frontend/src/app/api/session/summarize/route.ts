import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { containsBlockedContent, SAFETY_REFUSAL_DE } from "@/lib/safety";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";

const mistakeSchema = z.object({
  category: z.string().min(1).max(40),
  errorPattern: z.string().min(1).max(300),
  correctionNote: z.string().min(1).max(300),
});

const bodySchema = z.object({
  profileId: z.string().uuid().or(z.string().min(1)),
  summary: z.string().min(1).max(2000),
  mistakes: z.array(mistakeSchema).max(20).default([]),
  transcript: z.string().max(50000).optional(),
});

export async function POST(req: NextRequest) {
  // Allow either session cookie OR internal agent key
  const session = await getSession();
  const agentKey = req.headers.get("x-agent-key");
  const expectedKey = process.env.AUTH_SECRET || "german-tutor-dev-secret-change-in-prod";
  const isAgent = agentKey === expectedKey;

  if (!session && !isAgent) return unauthorized();

  try {
    const raw = await req.json();
    const parsed = bodySchema.safeParse(raw);
    if (!parsed.success) {
      return jsonError(parsed.error.errors[0]?.message || "Invalid payload");
    }

    const { profileId, summary, mistakes, transcript } = parsed.data;

    if (containsBlockedContent(summary) || containsBlockedContent(transcript || "")) {
      return jsonError(SAFETY_REFUSAL_DE, 400);
    }

    const profile = await prisma.profile.findFirst({
      where: session
        ? { id: profileId, userId: session.userId }
        : { id: profileId },
    });
    if (!profile) return jsonError("Profile not found", 404);

    const safeMistakes = mistakes.filter(
      (m) =>
        !containsBlockedContent(m.errorPattern) &&
        !containsBlockedContent(m.correctionNote)
    );

    for (const m of safeMistakes) {
      const existing = await prisma.profileMemory.findFirst({
        where: {
          profileId,
          category: m.category,
          errorPattern: m.errorPattern,
        },
      });

      if (existing) {
        await prisma.profileMemory.update({
          where: { id: existing.id },
          data: {
            occurrenceCount: existing.occurrenceCount + 1,
            lastSeenAt: new Date(),
            correctionNote: m.correctionNote,
          },
        });
      } else {
        await prisma.profileMemory.create({
          data: {
            profileId,
            category: m.category,
            errorPattern: m.errorPattern,
            correctionNote: m.correctionNote,
          },
        });
      }
    }

    const sessionLog = await prisma.sessionLog.create({
      data: {
        profileId,
        summary,
        newMistakes: JSON.stringify(safeMistakes),
      },
    });

    return jsonOk({ ok: true, sessionId: sessionLog.id, mistakesSaved: safeMistakes.length });
  } catch (err) {
    console.error("Summarize error:", err);
    return jsonError("Failed to save session summary", 500);
  }
}
