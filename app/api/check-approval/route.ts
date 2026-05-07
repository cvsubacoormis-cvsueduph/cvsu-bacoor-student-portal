import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
export const runtime = "nodejs";


export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkApiRateLimit("check_approval", 30, 60);
    if (rl.error) return rl.error;

    const student = await prisma.student.findUnique({
      where: { id: userId },
      select: { isApproved: true },
    });

    if (!student) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 });
    }

    return NextResponse.json({ isApproved: student.isApproved });
  } catch (error) {
    console.error("Error checking approval:", error);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
