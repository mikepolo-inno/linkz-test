import type { PrismaClient } from "@prisma/client";

import { PaymentStatus, SeatStatus } from "@/lib/enums";
import { err, ok, type Result } from "@/lib/result";

export type CompletePaymentSuccess =
  | { kind: "reserved"; seatLabel: string }
  | { kind: "already_reserved"; seatLabel: string }
  | { kind: "failed"; reason: string };

export type CompletePaymentError =
  | "payment_not_found"
  | "forbidden"
  | "seat_conflict";

export type CompletePaymentResult = Result<
  CompletePaymentSuccess,
  CompletePaymentError
>;

type CompletePaymentArgs = {
  prisma: PrismaClient;
  paymentId: string;
  userId: string;
  outcome: "success" | "failure";
};

/**
 * Completes a PENDING payment intent. The single most important invariant of
 * this codebase lives here: a seat moves to RESERVED only inside this
 * transaction, only when the payment owner matches the requester, and only
 * when the conditional `updateMany` actually claims the seat row.
 *
 * That conditional update is the linchpin for race safety: if two completions
 * land at the same time, exactly one will see `count === 1` and the other
 * will see `count === 0` and be reported as a seat conflict.
 */
export async function completePaymentAndReserve({
  prisma,
  paymentId,
  userId,
  outcome,
}: CompletePaymentArgs): Promise<CompletePaymentResult> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: {
        reservation: { include: { seat: true } },
        seat: true,
      },
    });

    if (!payment) {
      return err("payment_not_found", "Payment was not found.");
    }

    if (payment.userId !== userId) {
      return err("forbidden", "This payment belongs to another user.");
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

    if (outcome === "failure") {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: "Mock payment failed by user choice.",
          completedAt: new Date(),
        },
      });

      return ok({
        kind: "failed",
        reason: "Mock payment failed. The seat remains available.",
      });
    }

    const claim = await tx.seat.updateMany({
      where: { id: payment.seatId, status: SeatStatus.AVAILABLE },
      data: {
        status: SeatStatus.RESERVED,
        reservedByUserId: userId,
        reservedAt: new Date(),
      },
    });

    if (claim.count === 0) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: "Seat was reserved before payment completed.",
          completedAt: new Date(),
        },
      });

      return err(
        "seat_conflict",
        "This seat was reserved before payment completed.",
      );
    }

    await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.SUCCEEDED,
        completedAt: new Date(),
      },
    });

    await tx.reservation.create({
      data: {
        userId,
        seatId: payment.seatId,
        paymentId: payment.id,
      },
    });

    return ok({ kind: "reserved", seatLabel: payment.seat.label });
  });
}
