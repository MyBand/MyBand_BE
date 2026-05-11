# ---- stage 1: build ----
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma

# better-sqlite3 is a native addon and requires build tools
RUN apk add --no-cache python3 make g++ \
    && npm ci \
    && npx prisma generate

COPY tsconfig.json tsoa.json ./
COPY src ./src

# tsoa spec-and-routes → tsc
RUN npm run build

# ---- stage 2: production ----
FROM node:22-alpine
WORKDIR /app

COPY package*.json ./

# Start with fully-compiled node_modules from builder (native addons included)
COPY --from=builder /app/node_modules ./node_modules

# Remove devDependencies to trim image size
RUN npm prune --omit=dev

# prisma is a devDep but is needed at startup for `prisma migrate deploy`.
# Restore it after prune.
COPY --from=builder /app/node_modules/prisma        ./node_modules/prisma
COPY --from=builder /app/node_modules/.prisma       ./node_modules/.prisma
COPY --from=builder /app/node_modules/.bin/prisma   ./node_modules/.bin/prisma

COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

# Non-root user + volume mount points
RUN addgroup -S app && adduser -S app -G app \
    && mkdir -p uploads prisma \
    && chown -R app:app /app

COPY --chown=app:app entrypoint.sh ./
RUN chmod +x entrypoint.sh

USER app
EXPOSE 3000
ENTRYPOINT ["./entrypoint.sh"]
