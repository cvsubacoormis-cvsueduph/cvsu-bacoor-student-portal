import prisma from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
export const runtime = "nodejs";


export async function GET(request: NextRequest) {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role === "student") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("query") || "";
  const page = Number(searchParams.get("page")) || 1;
  const limit = Number(searchParams.get("limit")) || 10;
  const course = searchParams.get("course");
  const status = searchParams.get("status");

  const whereClause: any = {
    AND: [],
    OR: [
      { firstName: { contains: query, mode: "insensitive" } },
      { lastName: { contains: query, mode: "insensitive" } },
      { username: { contains: query, mode: "insensitive" } },
      { studentNumber: { contains: query, mode: "insensitive" } },
      { phone: { contains: query, mode: "insensitive" } },
      { address: { contains: query, mode: "insensitive" } },
    ],
  };

  if (course && course !== "ALL") {
    whereClause.AND.push({ course: course });
  }

  if (status && status !== "ALL") {
    whereClause.AND.push({ status: status });
  }

  // If query is empty, remove the OR clause to avoid matching failures on partial empty checks if sensitive, 
  // but usually empty string contains matches everything. 
  // However, optimization:
  if (!query) {
    delete whereClause.OR;
  }

  try {
    const students = await prisma.student.findMany({
      where: whereClause,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' } // Good practice to have stable sort
    });

    const totalStudents = await prisma.student.count({
      where: whereClause,
    });

    const totalPages = Math.ceil(totalStudents / limit);

    return Response.json({
      data: students,
      totalPages,
      currentPage: page,
    });
  } catch (error) {
    console.error("Error fetching students:", error);
    throw error;
  }
}
