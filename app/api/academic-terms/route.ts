import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const terms = await prisma.academicTerm.findMany({
      select: {
        academicYear: true,
        semester: true,
      },
    });

    return NextResponse.json(terms);
  } catch (error) {
    console.log("Error fetching academic terms:", error);
    return NextResponse.json(
      { message: "Error fetching academic terms" },
      { status: 500 }
    );
  }
}
