import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.log("ADMIN_PASSWORD not set; skipping admin seed.");
    return;
  }
  const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase() || undefined;
  const hash = await bcrypt.hash(password, 12);

  await prisma.user.upsert({
    where: { username },
    update: { password: hash, ...(email ? { email } : {}) },
    create: { username, password: hash, email },
  });

  console.log(`Seeded admin user: ${username}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
