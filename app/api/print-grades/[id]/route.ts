import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
export const runtime = "nodejs";


export async function GET() {
  try {
    // Authenticate the user
    const authResult = await auth();
    const { userId } = authResult;

    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch the student data associated with the logged-in user
    const student = await prisma.student.findUnique({
      where: { username: userId },
      include: {
        grades: {
          include: {
            academicTerm: true, // Include academic term details
          },
        },
      },
    });

    if (!student) {
      return NextResponse.json(
        { error: "Student not found." },
        { status: 404 }
      );
    }

    // Return the student's grades
    return NextResponse.json(student.grades, { status: 200 });
  } catch (error) {
    console.error("Error fetching grades:", error);
    return NextResponse.json(
      { error: "An error occurred while fetching grades." },
      { status: 500 }
    );
  }
}
