// Standalone seed runner. Mirrors `src/lib/seed.ts` but keeps zero TS/Next
// dependencies so it can run from the package's npm script without a build.
import "dotenv/config";

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEMO_SEATS = ["A1", "A2", "A3"];

async function main() {
  await prisma.paymentEvent.deleteMany();
  await prisma.seatLock.deleteMany();
  await prisma.reservation.deleteMany();
  await prisma.payment.deleteMany();

  await Promise.all(
    DEMO_SEATS.map((label) =>
      prisma.seat.upsert({
        where: { label },
        update: {
          status: "AVAILABLE",
          reservedAt: null,
          reservedByUserId: null,
          lockedByUserId: null,
          lockExpiresAt: null,
          lockPaymentId: null,
        },
        create: { label, status: "AVAILABLE" },
      }),
    ),
  );
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
