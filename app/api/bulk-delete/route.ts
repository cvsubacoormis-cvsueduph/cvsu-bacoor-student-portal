import { clerkClient } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
const clerk = await clerkClient();

export async function DELETE() {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let totalDeleted = 0;
    let offset = 0;
    const limit = 100;

    while (true) {
      const { data, totalCount } = await clerk.users.getUserList({
        limit,
        offset,
        orderBy: "-created_at",
      });

      if (!data.length) break;

      for (const user of data) {
        // 🚫 Skip current logged-in user
        if (user.id === userId) continue;

        try {
          await clerk.users.deleteUser(user.id);
          totalDeleted++;
        } catch (err) {
          console.error(`❌ Failed to delete Clerk user ${user.id}:`, err);
        }
      }

      offset += limit;
      if (offset >= totalCount) break;
    }

    // 🧹 Delete all students from Prisma DB
    const { count } = await prisma.student.deleteMany();

    return NextResponse.json(
      {
        message: `✅ Deleted ${totalDeleted} Clerk users (excluding current user) and ${count} students from database.`,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("Error deleting users:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred", error: error.message },
      { status: 500 }
    );
  }
}
