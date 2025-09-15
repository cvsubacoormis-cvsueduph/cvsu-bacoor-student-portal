import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
export const runtime = "nodejs";


export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
