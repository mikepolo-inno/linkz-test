# syntax=docker/dockerfile:1.7

# ---------- 1. Install all deps (dev + prod) for the build step ----------
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# ---------- 2. Build Next.js + generate Prisma client ----------
FROM node:20-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl

# Next imports server modules during `next build`. Provide placeholders so
# env validation passes; the real DATABASE_URL is injected at container start.
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    DATABASE_URL="file:/tmp/next-build.db" \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_YnVpbGQtcGxhY2Vob2xkZXIuY2xlcmsuYWNjb3VudHMuZGV2JA" \
    CLERK_SECRET_KEY="sk_test_build_placeholder"

COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN npx prisma generate \
    && npm run build

# ---------- 3. Prod-only deps for the runtime image ----------
FROM node:20-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev --no-audit --no-fund \
    && npx prisma generate

# ---------- 4. Minimal runtime image ----------
FROM node:20-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat openssl tini wget

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    DATABASE_URL="file:/app/data/app.db" \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY="pk_test_replace-with-clerk-publishable-key" \
    CLERK_SECRET_KEY="sk_test_replace-with-clerk-secret-key" \
    LOG_LEVEL=info \
    SEED_ON_START=1

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs \
    && mkdir -p /app/data \
    && chown -R nextjs:nodejs /app

COPY --from=prod-deps --chown=nextjs:nodejs /app/node_modules ./node_modules
COPY --from=builder   --chown=nextjs:nodejs /app/.next         ./.next
COPY --from=builder   --chown=nextjs:nodejs /app/prisma        ./prisma
COPY --from=builder   --chown=nextjs:nodejs /app/package.json  ./package.json
COPY --from=builder   --chown=nextjs:nodejs /app/next.config.mjs ./next.config.mjs
COPY --chown=nextjs:nodejs docker/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=5 \
    CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]
