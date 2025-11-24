import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    // 1. Get the maximum ID from the RateLimit table
    const maxIdResult = await prisma.rateLimit.aggregate({
      _max: {
        id: true,
      },
    });

    const maxId = maxIdResult._max.id || 0;
    console.log(`Current max ID in RateLimit table: ${maxId}`);

    // 2. Reset the sequence to maxId + 1
    // The sequence name is usually "RateLimit_id_seq" but Prisma might name it differently.
    // However, for a standard Postgres setup with Prisma, it's usually "RateLimit_id_seq".
    // We can use setval.
    
    // Note: If the table name in the database is different (e.g. mapped), we might need to adjust.
    // Based on schema, it's just RateLimit. Postgres usually lowercases unquoted identifiers.
    // Prisma usually quotes identifiers.
    
    // Let's try to find the sequence name first if possible, or just assume the standard naming convention.
    // Standard naming: "RateLimit_id_seq" (case sensitive if quoted in creation, but usually lowercase in PG if not).
    // Prisma usually creates tables with double quotes preserving case if the model name has mixed case?
    // Actually, Prisma maps models to tables. `RateLimit` model -> `RateLimit` table (if not mapped).
    
    // Let's try the standard approach.
    const nextId = maxId + 1;
    
    // We need to use raw SQL because Prisma doesn't expose sequence manipulation directly.
    // We'll try a few common sequence names if the first one fails, or just list them.
    
    // In Postgres, table names and sequence names are case sensitive if created with quotes.
    // Prisma default: "RateLimit_id_seq"
    
    await prisma.$executeRawUnsafe(`SELECT setval('"RateLimit_id_seq"', ${nextId}, false);`);
    
    console.log(`Successfully updated "RateLimit_id_seq" to ${nextId}`);
  } catch (error) {
    console.error("Error updating sequence:", error);
    // Fallback: try lowercase if the above failed (though unlikely with Prisma default)
    try {
        console.log("Attempting lowercase sequence name...");
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
