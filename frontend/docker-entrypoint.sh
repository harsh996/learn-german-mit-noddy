#!/bin/sh
set -e

mkdir -p /app/prisma
export DATABASE_URL="${DATABASE_URL:-file:/app/prisma/dev.db}"

PRISMA_BIN="/opt/prisma-tools/node_modules/.bin/prisma"
PRISMA_SCHEMA="/opt/prisma-tools/prisma/schema.prisma"

if [ ! -x "$PRISMA_BIN" ]; then
  echo "Prisma CLI missing at $PRISMA_BIN"
  exit 1
fi

echo "Running Prisma migrations (db push)..."
"$PRISMA_BIN" db push --skip-generate --schema="$PRISMA_SCHEMA"

echo "Assigning legacy saved words to a profile..."
node <<'NODE'
const { createRequire } = require("module");
const requireFromTools = createRequire("/opt/prisma-tools/package.json");
const { PrismaClient } = requireFromTools("@prisma/client");
const prisma = new PrismaClient();

(async () => {
  // Saved words used to belong to the account; move each to that account's oldest profile.
  const orphans = await prisma.savedWord.findMany({ where: { profileId: null } });
  const target = new Map();
  let moved = 0;
  for (const w of orphans) {
    if (!target.has(w.userId)) {
      const p = await prisma.profile.findFirst({ where: { userId: w.userId }, orderBy: { createdAt: "asc" } });
      target.set(w.userId, p ? p.id : null);
    }
    const profileId = target.get(w.userId);
    if (!profileId) continue;
    await prisma.savedWord.update({ where: { id: w.id }, data: { profileId } });
    moved++;
  }
  console.log("Legacy saved words assigned:", moved, "of", orphans.length);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
NODE

echo "Seeding admin user..."
node <<'NODE'
const { createRequire } = require("module");
const requireFromTools = createRequire("/opt/prisma-tools/package.json");
const { PrismaClient } = requireFromTools("@prisma/client");
const bcrypt = requireFromTools("bcryptjs");

const prisma = new PrismaClient();

(async () => {
  const password = process.env.ADMIN_PASSWORD;
  if (!password) {
    console.log("ADMIN_PASSWORD not set; skipping admin seed.");
    await prisma.$disconnect();
    return;
  }
  const username = (process.env.ADMIN_USERNAME || "admin").trim().toLowerCase();
  const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase() || undefined;
  const hash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { username },
    update: { password: hash, ...(email ? { email } : {}) },
    create: { username, password: hash, email },
  });
  console.log("Admin user ready:", username);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
NODE

exec "$@"
