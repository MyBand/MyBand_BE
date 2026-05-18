#!/bin/sh
set -e
echo "[entrypoint] Syncing Prisma schema and migrations..."
mkdir -p prisma/migrations
cp -f prisma-image/schema.prisma prisma/schema.prisma
cp -R prisma-image/migrations/. prisma/migrations/
echo "[entrypoint] Running migrations..."
npx prisma migrate deploy
echo "[entrypoint] Starting server..."
exec node dist/server.js
