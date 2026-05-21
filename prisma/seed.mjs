// Standalone seed runner. Mirrors `src/lib/seed.ts` but keeps zero TS/Next
// dependencies so it can run from the package's npm script without a build.
import "dotenv/config";

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const DEMO_EMAIL = "demo@example.com";
const DEMO_NAME = "Demo User";
const DEMO_PASSWORD = "password123";
const DEMO_SEATS = ["A1", "A2", "A3"];

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 12);

  await prisma.reservation.deleteMany();
  await prisma.payment.deleteMany();

  await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: { name: DEMO_NAME, passwordHash },
    create: { email: DEMO_EMAIL, name: DEMO_NAME, passwordHash },
  });

  await Promise.all(
    DEMO_SEATS.map((label) =>
      prisma.seat.upsert({
        where: { label },
        update: {
          status: "AVAILABLE",
          reservedAt: null,
          reservedByUserId: null,
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
