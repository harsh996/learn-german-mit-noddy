import { prisma } from "./prisma";

/** The profile, only if it belongs to `userId`; the single gate for per-profile data. */
export function ownedProfile(id: string, userId: string) {
  return prisma.profile.findFirst({ where: { id, userId } });
}
