import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/api-rate-limit";

export const runtime = "nodejs";

// Security: hard cap to prevent resource exhaustion (OWASP API #4)
const MAX_EXPORT_LIMIT = 10_000;
const MAX_QUERY_LENGTH = 100;

// Valid enum values from Prisma schema — defense-in-depth input validation (OWASP API #8)
const VALID_COURSES = new Set([
  "BSIT", "BSCS", "BSCRIM", "BSP", "BSHM", "BSED", "BSBA",
]);
const VALID_STATUSES = new Set([
  "REGULAR", "IRREGULAR", "NOT_ANNOUNCED", "TRANSFEREE", "RETURNEE",
]);

export async function GET(request: NextRequest) {
  // --- Authentication ---
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role === "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // --- Rate Limiting: 5 exports per 60s per user ---
  const rl = await checkApiRateLimit("export_students", 5, 60);
  if (rl.error) return rl.error;

  // --- Input extraction ---
  const searchParams = request.nextUrl.searchParams;

  let query = (searchParams.get("query") || "").trim();
  // Truncate overly long search strings
  if (query.length > MAX_QUERY_LENGTH) {
    query = query.slice(0, MAX_QUERY_LENGTH);
  }

  const courseParam = searchParams.get("course");
  const statusParam = searchParams.get("status");
  const isApprovedParam = searchParams.get("isApproved");

  // --- Input validation (OWASP API #8) ---
  if (courseParam && courseParam !== "ALL" && !VALID_COURSES.has(courseParam)) {
    return NextResponse.json(
      { error: `Invalid course: "${courseParam}". Valid values: ${[...VALID_COURSES].join(", ")}` },
      { status: 400 }
    );
  }

  if (statusParam && statusParam !== "ALL" && !VALID_STATUSES.has(statusParam)) {
    return NextResponse.json(
      { error: `Invalid status: "${statusParam}". Valid values: ${[...VALID_STATUSES].join(", ")}` },
      { status: 400 }
    );
  }

  if (isApprovedParam && isApprovedParam !== "true" && isApprovedParam !== "false") {
    return NextResponse.json(
      { error: `Invalid isApproved value: "${isApprovedParam}". Use "true" or "false".` },
      { status: 400 }
    );
  }

  // --- Build Prisma where clause ---
  const whereClause: Record<string, unknown> = {
    AND: [] as Record<string, unknown>[],
  };

  if (query) {
    const tokens = query.split(/\s+/).filter(Boolean);

    // Base: full query on single-field columns (studentNumber, phone, username, address)
    const singleFieldConditions: Record<string, unknown>[] = [
      { username: { contains: query, mode: "insensitive" } },
      { studentNumber: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } },
      { address: { contains: query, mode: "insensitive" } },
    ];

    if (tokens.length === 1) {
      singleFieldConditions.push(
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
      );
      whereClause.OR = singleFieldConditions;
    } else {
      // Multi-token: cross-field name matching — each token must appear in
      // firstName OR lastName (handles "danilo borreros", "borreros danilo", etc.)
      singleFieldConditions.push({
        AND: tokens.map((token) => ({
          OR: [
            { firstName: { contains: token, mode: "insensitive" } },
            { lastName: { contains: token, mode: "insensitive" } },
          ],
        })),
      });
      whereClause.OR = singleFieldConditions;
    }
  }

  if (courseParam && courseParam !== "ALL") {
    (whereClause.AND as Record<string, unknown>[]).push({ course: courseParam });
  }

  if (statusParam && statusParam !== "ALL") {
    (whereClause.AND as Record<string, unknown>[]).push({ status: statusParam });
  }

  if (isApprovedParam === "true") {
    (whereClause.AND as Record<string, unknown>[]).push({ isApproved: true });
  } else if (isApprovedParam === "false") {
    (whereClause.AND as Record<string, unknown>[]).push({ isApproved: false });
  }

  if ((whereClause.AND as Record<string, unknown>[]).length === 0) {
    delete whereClause.AND;
  }

  // --- Database query with hard limit ---
  try {
    // Count total matching records first
    const totalCount = await prisma.student.count({ where: whereClause });

    const students = await prisma.student.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      // HARD CAP: prevents memory exhaustion from unrestricted export
      take: MAX_EXPORT_LIMIT,
      select: {
        studentNumber: true,
        firstName: true,
        lastName: true,
        middleInit: true,
        course: true,
        major: true,
        status: true,
        sex: true,
        email: true,
        phone: true,
        address: true,
        isApproved: true,
        isPasswordSet: true,
        createdAt: true,
      },
    });

    const truncated = totalCount > MAX_EXPORT_LIMIT;

    return NextResponse.json({
      data: students,
      total: students.length,
      totalMatching: totalCount,
      truncated,
      ...(truncated && {
        warning: `Results truncated. Showing ${MAX_EXPORT_LIMIT.toLocaleString()} of ${totalCount.toLocaleString()} matching students. Narrow your filters to export all.`,
      }),
    });
  } catch (error) {
    // Sanitized logging: don't leak raw Prisma errors into logs or response
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Export students failed:", message);
    return NextResponse.json(
      { error: "An unexpected error occurred while exporting students." },
      { status: 500 }
    );
  }
}
