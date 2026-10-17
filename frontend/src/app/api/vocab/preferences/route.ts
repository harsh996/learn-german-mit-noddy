import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";

const prefsSchema = z.object({
  sort: z.enum(["frequency", "alpha"]).optional(),
  status: z.enum(["all", "saved", "unsaved"]).optional(),
  pos: z.string().max(30).optional(),
  level: z.string().max(4).optional(),
});

export async function GET() {
  const session = await getSession();
  if (!session) return unauthorized();
  const row = await prisma.userPreference.findUnique({ where: { userId: session.userId } });
  let prefs = {};
  try {
    prefs = JSON.parse(row?.vocab ?? "{}");
  } catch {}
  return jsonOk({ prefs });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session) return unauthorized();
  const parsed = prefsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid preferences");
  const vocab = JSON.stringify(parsed.data);
  await prisma.userPreference.upsert({
    where: { userId: session.userId },
    update: { vocab },
    create: { userId: session.userId, vocab },
  });
  return jsonOk({ ok: true });
}
