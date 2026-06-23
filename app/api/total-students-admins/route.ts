import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
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
    const totalStudents = await prisma.student.count();
    const totalAdmins = await prisma.admin.count();
    return NextResponse.json({ totalStudents, totalAdmins });
  } catch (error) {
    console.error("Error fetching totals:", error);
    return NextResponse.json(
      { error: "Failed to fetch totals" },
      { status: 500 }
    );
  }
}
