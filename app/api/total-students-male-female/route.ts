import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
export const runtime = "nodejs";


export async function GET() {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const allowedRoles = ["admin", "superuser", "registrar", "faculty"];
  if (!role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const maleCount = await prisma.student.count({
      where: { sex: "MALE" },
    });

    const femaleCount = await prisma.student.count({
      where: { sex: "FEMALE" },
    });
    return NextResponse.json({
      maleCount,
      femaleCount,
      total: maleCount + femaleCount,
    });
  } catch (error) {
    console.error("Error fetching gender counts:", error);
    return NextResponse.json(
      { error: "Failed to fetch gender counts" },
      { status: 500 }
    );
  }
}
