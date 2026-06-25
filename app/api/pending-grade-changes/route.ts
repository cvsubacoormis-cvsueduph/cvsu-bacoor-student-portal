import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit-postgres";
import { z } from "zod";

export const runtime = "nodejs";

// Only registrars (and admin/superuser) can review pending changes
const REVIEWER_ROLES = ["admin", "superuser", "registrar"];

// ---------------------------------------------------------------------------
// GET — List pending grade changes
// ---------------------------------------------------------------------------
export async function GET(request: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (sessionClaims?.metadata as { role?: string })?.role;
    if (!role || !REVIEWER_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Forbidden: only registrars and admins can review pending changes" },
        { status: 403 }
      );
    }

    try {
      await checkRateLimit({
        action: "pending-changes-get",
        limit: 30,
        windowSeconds: 60,
      });
    } catch (error: any) {
      if (error.code === "RATE_LIMIT_EXCEEDED") {
        return NextResponse.json({ error: error.message }, { status: 429 });
      }
      throw error;
    }

    // Optional query params
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || "PENDING";

    // Validate status
    const validStatuses = ["PENDING", "APPROVED", "REJECTED"];
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: "Invalid status. Must be PENDING, APPROVED, or REJECTED" },
        { status: 400 }
      );
    }

    const changes = await prisma.pendingGradeChange.findMany({
      where: { status },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(changes);
  } catch (error) {
    console.error("Error fetching pending changes:", error);
    return NextResponse.json(
      { error: "Failed to fetch pending changes" },
      { status: 500 }
    );
  }
}
