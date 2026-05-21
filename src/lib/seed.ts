import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

import { SeatStatus } from "@/lib/enums";

export const DEMO_USER = {
  email: "demo@example.com",
  password: "password123",
  name: "Demo User",
} as const;

export const DEMO_SEATS = ["A1", "A2", "A3"] as const;

/**
 * Seeds the demo user and the three demo seats. Safe to call repeatedly:
 * existing reservations and payments are cleared so the demo always starts
 * from a clean state, and seats/users are upserted in place.
 */
export async function seedDemoData(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_USER.password, 12);

  await prisma.reservation.deleteMany();
  await prisma.payment.deleteMany();

  await prisma.user.upsert({
    where: { email: DEMO_USER.email },
    update: { name: DEMO_USER.name, passwordHash },
    create: { email: DEMO_USER.email, name: DEMO_USER.name, passwordHash },
  });

  await Promise.all(
    DEMO_SEATS.map((label) =>
      prisma.seat.upsert({
        where: { label },
        update: {
          status: SeatStatus.AVAILABLE,
          reservedAt: null,
          reservedByUserId: null,
        },
        create: { label, status: SeatStatus.AVAILABLE },
      }),
    ),
  );
}
