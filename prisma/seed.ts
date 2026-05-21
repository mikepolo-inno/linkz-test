import { PrismaClient } from "@prisma/client";

import { seedDemoData } from "../src/lib/seed-data";

const prisma = new PrismaClient();

async function main() {
  await seedDemoData(prisma);
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
