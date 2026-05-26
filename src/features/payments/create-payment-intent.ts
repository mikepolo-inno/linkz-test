import type { PrismaClient } from "@prisma/client";

import { PaymentStatus, SeatStatus } from "@/lib/enums";
import { ensureSqlitePragmas } from "@/lib/db";
import { err, ok, type Result } from "@/lib/result";

import { PAYMENT_AMOUNT_CENTS, PAYMENT_CURRENCY } from "./config";
import { expirePendingCheckouts } from "./checkout-expiry";

const SEAT_LOCK_TTL_MS = 10 * 60 * 1000;

export type CreatePaymentError =
  | "seat_not_found"
  | "seat_unavailable"
  | "seat_locked"
  | "duplicate_request";
export type CreatePaymentResult = Result<
  { paymentId: string; lockExpiresAt: Date },
  CreatePaymentError
>;

type CreatePaymentArgs = {
  prisma: PrismaClient;
  seatId: string;
  userId: string;
  idempotencyKey: string;
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
  idempotencyKey,
}: CreatePaymentArgs): Promise<CreatePaymentResult> {
  const now = new Date();
  const lockExpiresAt = new Date(now.getTime() + SEAT_LOCK_TTL_MS);

  await ensureSqlitePragmas(prisma);

  return prisma.$transaction(async (tx) => {
    await expirePendingCheckouts(tx, now, seatId);

    const existingPayment = await tx.payment.findUnique({
      where: { idempotencyKey },
      include: { lock: true },
    });

    if (existingPayment) {
      if (existingPayment.userId !== userId || existingPayment.seatId !== seatId) {
        return err(
          "duplicate_request",
          "This idempotency key was already used for another checkout.",
        );
      }

      const existingLockExpiresAt = existingPayment.lock?.expiresAt ?? lockExpiresAt;
      return ok({
        paymentId: existingPayment.id,
        lockExpiresAt: existingLockExpiresAt,
      });
    }

    const seat = await tx.seat.findUnique({
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

    if (seat.lockedByUserId && seat.lockExpiresAt && seat.lockExpiresAt > now) {
      return err("seat_locked", "This seat is temporarily held by another guest.");
    }

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
      },
    });

    if (lock.count === 0) {
      return err("seat_locked", "This seat is temporarily held by another guest.");
    }

    const payment = await tx.payment.create({
      data: {
        userId,
        seatId,
        amountCents: PAYMENT_AMOUNT_CENTS,
        currency: PAYMENT_CURRENCY,
        idempotencyKey,
      },
      select: { id: true },
    });

    await tx.seat.update({
      where: { id: seatId },
      data: { lockPaymentId: payment.id },
    });

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
