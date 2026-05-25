import { randomUUID } from "crypto";
import type { PrismaClient } from "@prisma/client";

import { PaymentStatus, SeatStatus } from "@/lib/enums";
import { err, ok, type Result } from "@/lib/result";

import { PAYMENT_AMOUNT_CENTS, PAYMENT_CURRENCY } from "./config";

const SEAT_LOCK_TTL_MS = 10 * 60 * 1000;

export type CreatePaymentError = "seat_not_found" | "seat_unavailable" | "seat_locked";
export type CreatePaymentResult = Result<
  { paymentId: string; lockExpiresAt: Date },
  CreatePaymentError
>;

type CreatePaymentArgs = {
  prisma: PrismaClient;
  seatId: string;
  userId: string;
};

/**
 * Creates a PENDING payment intent and atomically holds the selected seat.
 * Access/session tokens stay short-lived; this short DB lock is what protects
 * the checkout workflow from two users paying for the same seat at once.
 */
export async function createPaymentIntent({
  prisma,
  seatId,
  userId,
}: CreatePaymentArgs): Promise<CreatePaymentResult> {
  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + SEAT_LOCK_TTL_MS);

  const seat = await prisma.seat.findUnique({
    where: { id: seatId },
    select: {
      id: true,
      status: true,
      lockedByUserId: true,
      lockExpiresAt: true,
      lockPaymentId: true,
    },
  });

  if (!seat) {
    return err("seat_not_found", "Seat was not found.");
  }

  if (seat.status !== SeatStatus.AVAILABLE) {
    return err("seat_unavailable", "This seat has already been reserved.");
  }

  if (
    seat.lockedByUserId === userId &&
    seat.lockExpiresAt &&
    seat.lockExpiresAt > now &&
    seat.lockPaymentId
  ) {
    return ok({ paymentId: seat.lockPaymentId, lockExpiresAt: seat.lockExpiresAt });
  }

  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.create({
      data: {
        userId,
        seatId,
        amountCents: PAYMENT_AMOUNT_CENTS,
        currency: PAYMENT_CURRENCY,
        idempotencyKey: randomUUID(),
      },
      select: { id: true },
    });

    const lock = await tx.seat.updateMany({
      where: {
        id: seatId,
        status: SeatStatus.AVAILABLE,
        OR: [
          { lockExpiresAt: null },
          { lockExpiresAt: { lte: now } },
          { lockedByUserId: userId },
        ],
      },
      data: {
        lockedByUserId: userId,
        lockExpiresAt,
        lockPaymentId: payment.id,
      },
    });

    if (lock.count === 0) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: "Seat is temporarily held by another checkout.",
          completedAt: now,
        },
      });
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: "SEAT_LOCK_REJECTED",
          status: PaymentStatus.FAILED,
          source: "app",
          message: "Seat is temporarily held by another checkout.",
        },
      });
      return err("seat_locked", "This seat is temporarily held by another guest.");
    }

    await tx.seatLock.create({
      data: {
        userId,
        seatId,
        paymentId: payment.id,
        expiresAt: lockExpiresAt,
      },
    });

    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        type: "PAYMENT_INTENT_CREATED",
        status: PaymentStatus.PENDING,
        source: "app",
        message: "Seat locked while checkout is pending.",
      },
    });

    return ok({ paymentId: payment.id, lockExpiresAt });
  });
}
