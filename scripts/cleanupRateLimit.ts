import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE "public"."RateLimit";`
  );
  console.log("Done");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
