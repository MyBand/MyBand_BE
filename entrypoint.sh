#!/bin/sh
set -e
echo "[entrypoint] Running migrations..."
npx prisma migrate deploy
echo "[entrypoint] Starting server..."
exec node dist/server.js
