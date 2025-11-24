import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("Attempting to create a RateLimit entry...");
    const rateLimit = await prisma.rateLimit.create({
      data: {
        userId: "test-user-verification",
        action: "test-action",
      },
    });
    console.log("Successfully created RateLimit entry:", rateLimit);
    
    // Clean up
    await prisma.rateLimit.delete({
      where: { id: rateLimit.id },
    });
    console.log("Cleaned up test entry.");
  } catch (error) {
    console.error("Error creating RateLimit entry:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
