import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

export const getStudents = async (
  query: string,
  page: number = 1,
  limit: number = 10
) => {
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
    const students = await prisma.student.findMany({
      where: {
        OR: [
          {
            firstName: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            lastName: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            username: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
      skip: (page - 1) * limit, // Skip the appropriate number of items based on the current page
      take: limit, // Limit the number of results per page
    });

    const totalStudents = await prisma.student.count({
      where: {
        OR: [
          {
            firstName: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            lastName: {
              contains: query,
              mode: "insensitive",
            },
          },
          {
            username: {
              contains: query,
              mode: "insensitive",
            },
          },
        ],
      },
    });

    const totalPages = Math.ceil(totalStudents / limit);

    return {
      data: students,
      totalPages,
      currentPage: page,
    };
  } catch (error) {
    console.error("Error fetching students:", error);
    throw error;
  }
};
