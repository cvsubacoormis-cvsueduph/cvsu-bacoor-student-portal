import { clerkClient } from "@clerk/nextjs/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { checkApiRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";
const clerk = await clerkClient();

export async function DELETE(request: NextRequest) {
  const { userId, sessionClaims } = await auth();

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role !== "admin" && role !== "superuser") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const rl = await checkApiRateLimit("bulk_delete", 3, 300);
  if (rl.error) return rl.error;

  // Require explicit confirmation phrase — defense against accidental clicks, misconfigured clients, and CSRF
  let body: { confirm?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Confirmation required. Send { \"confirm\": \"DELETE ALL USERS\" } in the request body." },
      { status: 400 }
    );
  }

  if (body?.confirm !== "DELETE ALL USERS") {
    return NextResponse.json(
      { error: "Confirmation phrase missing or incorrect. Expected: \"DELETE ALL USERS\"." },
      { status: 400 }
    );
  }

  // Pre-delete audit log — required for forensic recovery if deletion is triggered accidentally or maliciously
  console.warn("[bulk-delete] INITIATED", {
    initiatedBy: userId,
    initiatedAt: new Date().toISOString(),
    targetScope: "all_clerk_users + all_students",
    note: "This is irreversible. Clerk users and students will be deleted below.",
  });

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
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
