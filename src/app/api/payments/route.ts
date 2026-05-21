import { NextResponse } from "next/server";

import { errToResponse } from "@/app/api/http";
import { getUserId } from "@/features/auth/session";
import { createPaymentIntent } from "@/features/payments/create-payment-intent";
import { createPaymentSchema } from "@/features/payments/schemas";
import { prisma } from "@/lib/db";
import { err } from "@/lib/result";

export async function POST(request: Request) {
  const userId = await getUserId();
  if (!userId) {
    return errToResponse(err("unauthorized", "Authentication required."));
  }

  const json = await request.json().catch(() => null);
  const parsed = createPaymentSchema.safeParse(json);
  if (!parsed.success) {
    return errToResponse(err("invalid_input", "Invalid payment request."));
  }

  const result = await createPaymentIntent({
    prisma,
    seatId: parsed.data.seatId,
    userId,
  });

  if (!result.ok) return errToResponse(result);

  return NextResponse.json({ paymentId: result.value.paymentId });
}
