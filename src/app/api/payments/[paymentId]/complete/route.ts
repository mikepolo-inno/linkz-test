import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { completePaymentAndReserve } from "@/lib/reservations";

const completePaymentSchema = z.object({
  outcome: z.enum(["success", "failure"]),
});

export async function POST(
  request: Request,
  { params }: { params: { paymentId: string } },
) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const parsed = completePaymentSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid completion request." }, { status: 422 });
  }

  const result = await completePaymentAndReserve(prisma, {
    paymentId: params.paymentId,
    userId,
    outcome: parsed.data.outcome,
  });

  if (!result.ok) {
    const statusByResult = {
      conflict: 409,
      forbidden: 403,
      not_found: 404,
    } as const;

    return NextResponse.json(
      { error: result.message, status: result.status },
      { status: statusByResult[result.status] },
    );
  }

  return NextResponse.json(result);
}
