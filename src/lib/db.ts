import { PrismaClient } from "@prisma/client";

import { env } from "@/lib/env";

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * Reuse a single PrismaClient across hot reloads in development so we don't
 * exhaust the SQLite connection limit. In production we create a fresh client
 * per process.
 */
export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
