import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const maxIdResult = await prisma.rateLimit.aggregate({
      _max: {
        id: true,
      },
    });

    const maxId = maxIdResult._max.id || 0;
    const nextId = maxId + 1;

    await prisma.$executeRawUnsafe(`SELECT setval('"RateLimit_id_seq"', ${nextId}, false);`);

    console.log(`Successfully updated "RateLimit_id_seq" to ${nextId}`);
  } catch (error) {
    console.error("Error updating sequence:", error);
    try {
      const maxIdResult = await prisma.rateLimit.aggregate({ _max: { id: true } });
      const nextId = (maxIdResult._max.id || 0) + 1;
      await prisma.$executeRawUnsafe(`SELECT setval('ratelimit_id_seq', ${nextId}, false);`);
      console.log(`Successfully updated "ratelimit_id_seq" to ${nextId}`);
    } catch (innerError) {
      console.error("Failed to update sequence with lowercase name as well.");
    }
  } finally {
    await prisma.$disconnect();
  }
}

main();
