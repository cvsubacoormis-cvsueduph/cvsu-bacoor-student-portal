import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
