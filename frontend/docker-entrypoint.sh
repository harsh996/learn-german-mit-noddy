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

echo "Seeding admin user..."
node <<'NODE'
const { createRequire } = require("module");
const requireFromTools = createRequire("/opt/prisma-tools/package.json");
const { PrismaClient } = requireFromTools("@prisma/client");
const bcrypt = requireFromTools("bcryptjs");

const prisma = new PrismaClient();

(async () => {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "Password123!";
  const hash = await bcrypt.hash(password, 12);
  await prisma.user.upsert({
    where: { username },
    update: { password: hash },
    create: { username, password: hash },
  });
  console.log("Admin user ready:", username);
  await prisma.$disconnect();
})().catch(async (e) => {
  console.error(e);
  process.exit(1);
});
NODE

exec "$@"
