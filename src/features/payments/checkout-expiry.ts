import type { Prisma } from "@prisma/client";

import { PaymentStatus } from "@/lib/enums";

const CHECKOUT_EXPIRED_REASON = "Checkout session expired.";

export async function expirePendingCheckouts(
  tx: Prisma.TransactionClient,
  now = new Date(),
  seatId?: string,
) {
  const expiredLocks = await tx.seatLock.findMany({
    where: {
      releasedAt: null,
      expiresAt: { lte: now },
      ...(seatId ? { seatId } : {}),
      payment: { status: PaymentStatus.PENDING },
    },
    select: { paymentId: true },
  });

  if (expiredLocks.length === 0) return;

  const paymentIds = expiredLocks.map((lock) => lock.paymentId);

  await tx.payment.updateMany({
    where: { id: { in: paymentIds }, status: PaymentStatus.PENDING },
    data: {
      status: PaymentStatus.FAILED,
      failureReason: CHECKOUT_EXPIRED_REASON,
      completedAt: now,
    },
  });

  await tx.seat.updateMany({
    where: { lockPaymentId: { in: paymentIds } },
    data: {
      lockedByUserId: null,
      lockExpiresAt: null,
      lockPaymentId: null,
    },
  });

  await tx.seatLock.updateMany({
    where: { paymentId: { in: paymentIds }, releasedAt: null },
    data: { releasedAt: now },
  });

  await tx.paymentEvent.createMany({
    data: paymentIds.map((paymentId) => ({
      paymentId,
      type: "CHECKOUT_SESSION_EXPIRED",
      status: PaymentStatus.FAILED,
      source: "app",
      message: CHECKOUT_EXPIRED_REASON,
    })),
  });
}
