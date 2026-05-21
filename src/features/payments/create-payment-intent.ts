import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";

import { SeatStatus } from "@/lib/enums";
import { err, ok, type Result } from "@/lib/result";

import { PAYMENT_AMOUNT_CENTS, PAYMENT_CURRENCY } from "./config";

export type CreatePaymentError = "seat_not_found" | "seat_unavailable";
export type CreatePaymentResult = Result<{ paymentId: string }, CreatePaymentError>;

type CreatePaymentArgs = {
  prisma: PrismaClient;
  seatId: string;
  userId: string;
};

/**
 * Creates a PENDING payment intent for a seat the user wants to reserve.
 *
 * The seat is intentionally *not* held at this point. Holds would require
 * timeout management and conflict cleanup that is out of scope for this
 * mock checkout; reservation only happens on successful completion (see
 * `completePaymentAndReserve`).
 */
export async function createPaymentIntent({
  prisma,
  seatId,
  userId,
}: CreatePaymentArgs): Promise<CreatePaymentResult> {
  const seat = await prisma.seat.findUnique({
    where: { id: seatId },
    select: { id: true, status: true },
  });

  if (!seat) {
    return err("seat_not_found", "Seat was not found.");
  }

  if (seat.status !== SeatStatus.AVAILABLE) {
    return err("seat_unavailable", "This seat has already been reserved.");
  }

  const payment = await prisma.payment.create({
    data: {
      userId,
      seatId,
      amountCents: PAYMENT_AMOUNT_CENTS,
      currency: PAYMENT_CURRENCY,
      idempotencyKey: randomUUID(),
    },
    select: { id: true },
  });

  return ok({ paymentId: payment.id });
}
