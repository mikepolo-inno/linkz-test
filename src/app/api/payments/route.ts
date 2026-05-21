import { NextResponse } from "next/server";
import { z } from "zod";

import { requireUserId } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createPaymentIntent } from "@/lib/payments";

const createPaymentSchema = z.object({
  seatId: z.string().min(1),
});

export async function POST(request: Request) {
  const userId = await requireUserId();

  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const parsed = createPaymentSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payment request." }, { status: 422 });
  }

  const result = await createPaymentIntent(prisma, {
    seatId: parsed.data.seatId,
    userId,
  });

  if (!result.ok) {
    const status = result.status === "conflict" ? 409 : 404;
    return NextResponse.json({ error: result.message }, { status });
  }

  return NextResponse.json({ paymentId: result.paymentId });
}
