import type { Prisma, PrismaClient } from "@prisma/client";

import { PaymentStatus, SeatStatus } from "@/lib/enums";
import { err, ok, type Result } from "@/lib/result";

export type CompletePaymentSuccess =
  | { kind: "reserved"; seatLabel: string }
  | { kind: "already_reserved"; seatLabel: string }
  | { kind: "failed"; reason: string };

export type CompletePaymentError =
  | "payment_not_found"
  | "forbidden"
  | "lock_expired"
  | "seat_conflict";

export type CompletePaymentResult = Result<CompletePaymentSuccess, CompletePaymentError>;

type CompletePaymentArgs = {
  prisma: PrismaClient;
  paymentId: string;
  userId?: string;
  gatewayEventId: string;
  gatewayStatus: "succeeded" | "failed";
  failureReason?: string;
  source?: "mock_gateway" | "gateway_webhook";
};

/**
 * Applies a trusted payment-gateway event to a PENDING payment intent. The
 * single most important invariant of this codebase lives here: a seat moves to
 * RESERVED only inside this transaction, only after a gateway success, only
 * while the seat lock is still active, and only when the conditional
 * `updateMany` actually claims the seat row.
 *
 * That conditional update is the linchpin for race safety: if two completions
 * land at the same time, exactly one will see `count === 1` and the other
 * will see `count === 0` and be reported as a seat conflict.
 */
export async function completePaymentAndReserve({
  prisma,
  paymentId,
  userId,
  gatewayEventId,
  gatewayStatus,
  failureReason,
  source = "gateway_webhook",
}: CompletePaymentArgs): Promise<CompletePaymentResult> {
  return prisma.$transaction(async (tx) => {
    const existingEvent = await tx.paymentEvent.findUnique({
      where: { gatewayEventId },
    });

    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: {
        reservation: { include: { seat: true } },
        seat: true,
        lock: true,
      },
    });

    if (!payment) {
      return err("payment_not_found", "Payment was not found.");
    }

    if (userId && payment.userId !== userId) {
      return err("forbidden", "This payment belongs to another user.");
    }

    if (existingEvent) {
      if (payment.status === PaymentStatus.SUCCEEDED && payment.reservation) {
        return ok({
          kind: "already_reserved",
          seatLabel: payment.reservation.seat.label,
        });
      }
      if (payment.status === PaymentStatus.FAILED) {
        return ok({
          kind: "failed",
          reason: payment.failureReason ?? "Payment has already failed.",
        });
      }
    }

    if (payment.status === PaymentStatus.SUCCEEDED && payment.reservation) {
      return ok({
        kind: "already_reserved",
        seatLabel: payment.reservation.seat.label,
      });
    }

    if (payment.status === PaymentStatus.FAILED) {
      return ok({
        kind: "failed",
        reason: payment.failureReason ?? "Payment has already failed.",
      });
    }

    if (gatewayStatus === "failed") {
      const reason = failureReason ?? "Payment gateway reported failure.";
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: reason,
          completedAt: new Date(),
        },
      });
      await releaseSeatLock(tx, payment.id);
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: "GATEWAY_PAYMENT_FAILED",
          status: PaymentStatus.FAILED,
          source,
          gatewayEventId,
          message: reason,
        },
      });

      return ok({
        kind: "failed",
        reason: "Payment failed. The seat remains available.",
      });
    }

    const now = new Date();
    if (
      !payment.lock ||
      payment.lock.releasedAt ||
      payment.lock.expiresAt <= now ||
      payment.seat.lockPaymentId !== payment.id ||
      !payment.seat.lockExpiresAt ||
      payment.seat.lockExpiresAt <= now
    ) {
      const reason = "Seat lock expired before payment completed.";
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: reason,
          completedAt: now,
        },
      });
      await releaseSeatLock(tx, payment.id);
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: "GATEWAY_PAYMENT_REJECTED",
          status: PaymentStatus.FAILED,
          source,
          gatewayEventId,
          message: reason,
        },
      });

      return err("lock_expired", reason);
    }

    const claim = await tx.seat.updateMany({
      where: {
        id: payment.seatId,
        status: SeatStatus.AVAILABLE,
        lockPaymentId: payment.id,
        lockExpiresAt: { gt: now },
      },
      data: {
        status: SeatStatus.RESERVED,
        reservedByUserId: payment.userId,
        reservedAt: now,
        lockedByUserId: null,
        lockExpiresAt: null,
        lockPaymentId: null,
      },
    });

    if (claim.count === 0) {
      const reason = "This seat was reserved before payment completed.";
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: reason,
          completedAt: now,
        },
      });
      await releaseSeatLock(tx, payment.id);
      await tx.paymentEvent.create({
        data: {
          paymentId: payment.id,
          type: "GATEWAY_PAYMENT_REJECTED",
          status: PaymentStatus.FAILED,
          source,
          gatewayEventId,
          message: reason,
        },
      });

      return err("seat_conflict", "This seat was reserved before payment completed.");
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCEEDED,
        completedAt: now,
      },
    });

    await tx.reservation.create({
      data: {
        userId: payment.userId,
        seatId: payment.seatId,
        paymentId: payment.id,
      },
    });

    await tx.seatLock.update({
      where: { paymentId: payment.id },
      data: { releasedAt: now },
    });
    await tx.paymentEvent.create({
      data: {
        paymentId: payment.id,
        type: "GATEWAY_PAYMENT_SUCCEEDED",
        status: PaymentStatus.SUCCEEDED,
        source,
        gatewayEventId,
        message: "Payment succeeded and seat was reserved.",
      },
    });

    return ok({ kind: "reserved", seatLabel: payment.seat.label });
  });
}

async function releaseSeatLock(tx: Prisma.TransactionClient, paymentId: string) {
  const now = new Date();
  await tx.seat.updateMany({
    where: { lockPaymentId: paymentId },
    data: {
      lockedByUserId: null,
      lockExpiresAt: null,
      lockPaymentId: null,
    },
  });
  await tx.seatLock.updateMany({
    where: { paymentId, releasedAt: null },
    data: { releasedAt: now },
  });
}
