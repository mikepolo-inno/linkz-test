#!/bin/sh
set -e

cd /app

# SQLite file path from DATABASE_URL (default matches docker-compose + Dockerfile).
export DATABASE_URL="${DATABASE_URL:-file:/app/data/app.db}"

# Ensure the volume mount target exists and is writable for the nextjs user.
mkdir -p /app/data

echo "==> Database: ${DATABASE_URL}"
echo "==> Applying migrations"
node_modules/.bin/prisma migrate deploy --schema=./prisma/schema.prisma

echo "==> Enabling SQLite WAL pragmas"
node --input-type=module <<'EOF'
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
await prisma.$queryRawUnsafe("PRAGMA journal_mode = WAL");
await prisma.$queryRawUnsafe("PRAGMA busy_timeout = 5000");
await prisma.$queryRawUnsafe("PRAGMA foreign_keys = ON");
await prisma.$disconnect();
EOF

if [ "${SEED_ON_START:-1}" = "1" ]; then
  echo "==> Seeding demo data"
  node ./prisma/seed.mjs
else
  echo "==> Skipping seed (SEED_ON_START=0)"
fi

echo "==> Starting Next.js on ${HOSTNAME:-0.0.0.0}:${PORT:-3000}"
exec "$@"
