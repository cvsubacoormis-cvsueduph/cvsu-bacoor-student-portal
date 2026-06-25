import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";

export const runtime = "nodejs";

const querySchema = z.object({
  studentNumber: z.string().min(1),
  courseCode: z.string().min(1),
  academicYear: z.string().min(1),
  semester: z.string().min(1),
});

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const result = querySchema.safeParse({
      studentNumber: searchParams.get("studentNumber"),
      courseCode: searchParams.get("courseCode"),
      academicYear: searchParams.get("academicYear"),
      semester: searchParams.get("semester"),
    });

    if (!result.success) {
      return NextResponse.json(
        { error: "Missing required query parameters" },
        { status: 400 },
      );
    }

    const { studentNumber, courseCode, academicYear, semester } = result.data;

    const logs = await prisma.gradeLog.findMany({
      where: {
        studentNumber,
        courseCode,
        academicYear: academicYear as any,
        semester: semester as any,
      },
      orderBy: { performedAt: "desc" },
      take: 20,
    });

    return NextResponse.json(logs);
  } catch (error) {
    console.error("Error fetching grade history:", error);
    return NextResponse.json(
      { error: "Failed to fetch grade history" },
      { status: 500 },
    );
  }
}
