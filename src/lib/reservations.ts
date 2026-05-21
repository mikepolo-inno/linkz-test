import type { PrismaClient } from "@prisma/client";

import { PaymentStatus, SeatStatus } from "@/lib/status";

type CompletePaymentInput = {
  paymentId: string;
  userId: string;
  outcome: "success" | "failure";
};

type CompletePaymentResult =
  | { ok: true; status: "reserved"; seatLabel: string }
  | { ok: true; status: "already_reserved"; seatLabel: string }
  | { ok: true; status: "failed"; reason: string }
  | { ok: false; status: "not_found" | "forbidden" | "conflict"; message: string };

export async function completePaymentAndReserve(
  prisma: PrismaClient,
  input: CompletePaymentInput,
): Promise<CompletePaymentResult> {
  return prisma.$transaction(async (tx) => {
    const payment = await tx.payment.findUnique({
      where: { id: input.paymentId },
      include: {
        reservation: {
          include: { seat: true },
        },
        seat: true,
      },
    });

    if (!payment) {
      return { ok: false, status: "not_found", message: "Payment was not found." };
    }

    if (payment.userId !== input.userId) {
      return {
        ok: false,
        status: "forbidden",
        message: "This payment belongs to another user.",
      };
    }

    if (payment.status === PaymentStatus.SUCCEEDED && payment.reservation) {
      return {
        ok: true,
        status: "already_reserved",
        seatLabel: payment.reservation.seat.label,
      };
    }

    if (payment.status === PaymentStatus.FAILED) {
      return {
        ok: true,
        status: "failed",
        reason: payment.failureReason ?? "Payment has already failed.",
      };
    }

    if (input.outcome === "failure") {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: "Mock payment failed by user choice.",
          completedAt: new Date(),
        },
      });

      return {
        ok: true,
        status: "failed",
        reason: "Mock payment failed. The seat remains available.",
      };
    }

    const reservedSeat = await tx.seat.updateMany({
      where: {
        id: payment.seatId,
        status: SeatStatus.AVAILABLE,
      },
      data: {
        status: SeatStatus.RESERVED,
        reservedByUserId: input.userId,
        reservedAt: new Date(),
      },
    });

    if (reservedSeat.count === 0) {
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          status: PaymentStatus.FAILED,
          failureReason: "Seat was reserved before payment completed.",
          completedAt: new Date(),
        },
      });

      return {
        ok: false,
        status: "conflict",
        message: "This seat was reserved before payment completed.",
      };
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
        userId: input.userId,
        seatId: payment.seatId,
        paymentId: payment.id,
      },
    });

    return {
      ok: true,
      status: "reserved",
      seatLabel: payment.seat.label,
    };
  });
}
