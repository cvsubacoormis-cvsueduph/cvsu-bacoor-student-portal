import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
export const runtime = "nodejs";


export async function GET() {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const metadata = (sessionClaims?.metadata ?? {}) as Record<string, string>;
  const role = (metadata?.role || metadata?.enrollmentRole)?.toLowerCase();
  const allowedRoles = ["admin", "superuser", "registrar", "faculty"];
  if (!role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const coursesCount = await prisma.student.groupBy({
      by: ["course"],
      _count: {
        course: true,
      },
    });
    // Return JSON with the grouped data
    return NextResponse.json({ data: coursesCount });
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
}
