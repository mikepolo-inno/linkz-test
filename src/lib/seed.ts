import type { PrismaClient } from "@prisma/client";

import { SeatStatus } from "@/lib/enums";

export const DEMO_SEATS = ["A1", "A2", "A3"] as const;

/**
 * Seeds the three demo seats. Safe to call repeatedly:
 * existing reservations and payments are cleared so the demo always starts
 * from a clean state, and seats are upserted in place. Users are created from
 * Clerk identities on first sign-in, so no local password data is stored.
 */
export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  await prisma.paymentEvent.deleteMany();
  await prisma.seatLock.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.payment.deleteMany();

  await Promise.all(
    DEMO_SEATS.map((label) =>
      prisma.seat.upsert({
        where: { label },
        update: {
          status: SeatStatus.AVAILABLE,
          reservedAt: null,
          reservedByUserId: null,
          lockedByUserId: null,
          lockExpiresAt: null,
          lockPaymentId: null,
        },
        create: { label, status: SeatStatus.AVAILABLE },
      }),
    ),
  );
}
