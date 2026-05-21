import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness + minimal readiness probe.
 *
 * Returns 200 when the process can serve traffic and reach the database, 503
 * otherwise. Kept intentionally trivial so it stays cheap to call from a load
 * balancer or the Docker HEALTHCHECK directive.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" });
  } catch (error) {
    return NextResponse.json(
      { status: "degraded", error: (error as Error).message },
      { status: 503 },
    );
  }
}
