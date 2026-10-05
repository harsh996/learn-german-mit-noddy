import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { jsonError, jsonOk, unauthorized } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const profile = await prisma.profile.findFirst({
    where: { id, userId: session.userId },
    include: {
      memories: { orderBy: { occurrenceCount: "desc" }, take: 10 },
      sessions: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });

  if (!profile) return jsonError("Profile not found", 404);
  return jsonOk({ profile });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await getSession();
  if (!session) return unauthorized();

  const { id } = await params;
  const existing = await prisma.profile.findFirst({
    where: { id, userId: session.userId },
  });
  if (!existing) return jsonError("Profile not found", 404);

  await prisma.profile.delete({ where: { id } });
  return jsonOk({ ok: true });
}
