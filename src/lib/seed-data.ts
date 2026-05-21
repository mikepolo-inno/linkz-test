import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";

export async function seedDemoData(prisma: PrismaClient) {
  const passwordHash = await bcrypt.hash("password123", 12);

  await prisma.reservation.deleteMany();
  await prisma.payment.deleteMany();

  await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {
      name: "Demo User",
      passwordHash,
    },
    create: {
      email: "demo@example.com",
      name: "Demo User",
      passwordHash,
    },
  });

  await Promise.all(
    ["A1", "A2", "A3"].map((label) =>
      prisma.seat.upsert({
        where: { label },
        update: {
          status: "AVAILABLE",
          reservedAt: null,
          reservedByUserId: null,
        },
        create: {
          label,
          status: "AVAILABLE",
        },
      }),
    ),
  );
}
