import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";

import { SeatStatus } from "@/lib/status";

export const PAYMENT_AMOUNT_CENTS = 5000;
export const PAYMENT_CURRENCY = "USD";

type CreatePaymentResult =
  | { ok: true; paymentId: string }
  | { ok: false; status: "not_found" | "conflict"; message: string };

export async function createPaymentIntent(
  prisma: PrismaClient,
  input: { seatId: string; userId: string },
): Promise<CreatePaymentResult> {
  const seat = await prisma.seat.findUnique({
    where: { id: input.seatId },
    select: { id: true, status: true },
  });

  if (!seat) {
    return { ok: false, status: "not_found", message: "Seat was not found." };
  }

  if (seat.status !== SeatStatus.AVAILABLE) {
    return {
      ok: false,
      status: "conflict",
      message: "This seat has already been reserved.",
    };
  }

  const payment = await prisma.payment.create({
    data: {
      userId: input.userId,
      seatId: input.seatId,
      amountCents: PAYMENT_AMOUNT_CENTS,
      currency: PAYMENT_CURRENCY,
      idempotencyKey: randomUUID(),
    },
    select: { id: true },
  });

  return { ok: true, paymentId: payment.id };
}
