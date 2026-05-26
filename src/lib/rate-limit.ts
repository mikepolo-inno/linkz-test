import { NextResponse } from "next/server";

import { env } from "@/lib/env";

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

export type RateLimitResult = { ok: true } | { ok: false; response: NextResponse };

export function enforceRateLimit(
  request: Request,
  scope: string,
  userId?: string | null,
): RateLimitResult {
  const now = Date.now();
  const key = `${scope}:${userId ?? getClientIp(request)}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, {
      count: 1,
      resetAt: now + env.RATE_LIMIT_WINDOW_MS,
    });
    return { ok: true };
  }

  existing.count += 1;

  if (existing.count <= env.RATE_LIMIT_MAX_REQUESTS) {
    return { ok: true };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  return {
    ok: false,
    response: NextResponse.json(
      {
        error: "Too many requests. Please retry shortly.",
        code: "rate_limited",
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(retryAfterSeconds),
          "X-RateLimit-Limit": String(env.RATE_LIMIT_MAX_REQUESTS),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(existing.resetAt / 1000)),
        },
      },
    ),
  };
}

function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    forwardedFor ??
    request.headers.get("x-real-ip") ??
    request.headers.get("cf-connecting-ip") ??
    "anonymous"
  );
}
