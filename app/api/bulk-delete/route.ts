import prisma from "@/lib/prisma";
import { clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
export const runtime = "nodejs";

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const students = await prisma.student.findMany();
    for (const student of students) {
      await (await clerkClient()).users.deleteUser(student.id);
    }
    const deleteStudents = await prisma.student.deleteMany();

    if (!deleteStudents.count) {
      return NextResponse.json(
        { message: "No students found to delete" },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { message: "All students deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Error deleting students:", error);
    return NextResponse.json(
      { message: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
