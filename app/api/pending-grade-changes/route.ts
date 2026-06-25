import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit-postgres";

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

    // Rate limiting — if it fails for any reason other than RATE_LIMIT_EXCEEDED,
    // log and continue rather than blocking the request entirely.
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
      // Non-rate-limit error (e.g. DB connection) — log and allow through
      console.error("Rate limiter error (non-blocking):", error.message);
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

    // Fetch pending changes. If the table doesn't exist yet (fresh deploy
    // before migration), return an empty array instead of crashing.
    let changes;
    try {
      changes = await prisma.pendingGradeChange.findMany({
        where: { status },
        orderBy: { createdAt: "desc" },
      });
    } catch (dbError: any) {
      console.error("Database error fetching pending changes:", dbError.message);
      // If the table doesn't exist yet, return empty gracefully
      if (dbError.message?.includes("does not exist") || dbError.code === "P2021") {
        return NextResponse.json([]);
      }
      throw dbError; // re-throw for the outer catch
    }

    return NextResponse.json(changes);
  } catch (error: any) {
    console.error("Error fetching pending changes:", error);
    // Return the actual error message so the frontend can display it
    return NextResponse.json(
      { error: error.message || "Failed to fetch pending changes" },
      { status: 500 }
    );
  }
}
