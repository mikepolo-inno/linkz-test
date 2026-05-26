import { NextResponse } from "next/server";

import type { Err } from "@/lib/result";

const HTTP_STATUS_BY_CODE: Record<string, number> = {
  unauthorized: 401,
  invalid_input: 422,
  seat_not_found: 404,
  payment_not_found: 404,
  forbidden: 403,
  seat_unavailable: 409,
  seat_locked: 409,
  seat_conflict: 409,
  duplicate_request: 409,
  duplicate_gateway_event: 409,
  lock_expired: 409,
  rate_limited: 429,
};

/**
 * Maps a domain Err into a Next.js JSON response with a consistent shape.
 * Adding a new error code without an HTTP mapping defaults to 400, which is
 * intentional - we want unmapped codes to be visible during review.
 */
export function errToResponse(error: Err<string>): NextResponse {
  const status = HTTP_STATUS_BY_CODE[error.code] ?? 400;
  return NextResponse.json({ error: error.message, code: error.code }, { status });
}
