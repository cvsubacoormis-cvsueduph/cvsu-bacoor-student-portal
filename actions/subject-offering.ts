"use server";

import prisma from "@/lib/prisma";
import { AcademicYear, Semester } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";

export async function getSubjectOfferings({
    page = 1,
    limit = 10,
    search = "",
    academicYear,
    semester,
}: {
    page?: number;
    limit?: number;
    search?: string;
    academicYear?: string;
    semester?: string;
}) {
    const { userId } = await auth();
    if (!userId) {
        throw new Error("Unauthorized");
    }

    const skip = (page - 1) * limit;

    const where: any = {};

    if (academicYear && academicYear !== "ALL") {
        where.academicYear = academicYear as AcademicYear;
    }

    if (semester && semester !== "ALL") {
        where.semester = semester as Semester;
    }

    if (search) {
        where.curriculum = {
            OR: [
                { courseTitle: { contains: search, mode: "insensitive" } },
                { courseCode: { contains: search, mode: "insensitive" } },
            ],
        };
    }

    const [data, count] = await prisma.$transaction([
        prisma.subjectOffering.findMany({
            where,
            include: {
                curriculum: true,
            },
            take: limit,
            skip: skip,
            orderBy: {
                curriculum: {
                    courseCode: "asc",
                },
            },
        }),
        prisma.subjectOffering.count({ where }),
    ]);

    return { data, count };
}
