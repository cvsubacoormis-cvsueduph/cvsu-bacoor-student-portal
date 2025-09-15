import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const userId = req.headers.get("x-user-id");
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
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
