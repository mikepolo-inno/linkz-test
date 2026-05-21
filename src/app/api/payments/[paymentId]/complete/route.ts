import { NextResponse } from "next/server";

import { errToResponse } from "@/app/api/http";
import { getUserId } from "@/features/auth/session";
import { completePaymentAndReserve } from "@/features/payments/complete-payment";
import { completePaymentSchema } from "@/features/payments/schemas";
import { prisma } from "@/lib/db";
import { err } from "@/lib/result";

export async function POST(
  request: Request,
  { params }: { params: { paymentId: string } },
) {
  const userId = await getUserId();
  if (!userId) {
    return errToResponse(err("unauthorized", "Authentication required."));
  }

  const json = await request.json().catch(() => null);
  const parsed = completePaymentSchema.safeParse(json);
  if (!parsed.success) {
    return errToResponse(err("invalid_input", "Invalid completion request."));
  }

  const result = await completePaymentAndReserve({
    prisma,
    paymentId: params.paymentId,
    userId,
    outcome: parsed.data.outcome,
  });

  if (!result.ok) return errToResponse(result);

  return NextResponse.json(result.value);
}
