import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";

const saveSchema = z.object({
  wordKey: z.string().trim().min(1).max(200),
  word: z.string().trim().min(1).max(100),
  article: z.string().max(10).nullish(),
  pos: z.string().max(30).nullish(),
  level: z.string().max(4).nullish(),
  translation: z.string().trim().max(300).default(""),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const words = await prisma.savedWord.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });
  return jsonOk({ words });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const parsed = saveSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.errors[0]?.message || "Invalid word");

  const { wordKey, ...data } = parsed.data;
  const word = await prisma.savedWord.upsert({
    where: { userId_wordKey: { userId: session.userId, wordKey } },
    update: {},
    create: { userId: session.userId, wordKey, ...data },
  });
  return jsonOk({ word }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const wordKey = req.nextUrl.searchParams.get("wordKey");
  if (!wordKey) return jsonError("wordKey required");
  await prisma.savedWord.deleteMany({ where: { userId: session.userId, wordKey } });
  return jsonOk({ ok: true });
}
