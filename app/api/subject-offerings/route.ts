import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { AcademicYear, Semester } from "@prisma/client";
import { z } from "zod";

export const runtime = "nodejs";

const getQuerySchema = z.object({
    academicYear: z.nativeEnum(AcademicYear, {
        errorMap: () => ({ message: "Invalid academic year" }),
    }),
    semester: z.nativeEnum(Semester, {
        errorMap: () => ({ message: "Invalid semester" }),
    }),
});

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const academicYear = searchParams.get("academicYear");
        const semester = searchParams.get("semester");

        const validationResult = getQuerySchema.safeParse({
            academicYear,
            semester,
        });

        if (!validationResult.success) {
            // If not provided, maybe return empty or error?
            // For dropdowns, we usually need the context.
            return NextResponse.json(
                { error: "Academic Year and Semester are required" },
                { status: 400 }
            );
        }

        const { academicYear: validAY, semester: validSem } = validationResult.data;

        const subjectOfferings = await prisma.subjectOffering.findMany({
            where: {
                academicYear: validAY,
                semester: validSem,
                isActive: true,
            },
            include: {
                curriculum: {
                    select: {
                        courseCode: true,
                        courseTitle: true,
                        creditLec: true,
                        creditLab: true,
                    },
                },
            },
            orderBy: {
                curriculum: {
                    courseCode: 'asc'
                }
            }
        });

        // Map to a friendlier format if needed, but the structure:
        // { id, curriculum: { courseCode... } } is fine.
        // Adding a totalUnits helper.
        const mapped = subjectOfferings.map(offer => ({
            id: offer.id,
            courseCode: offer.curriculum.courseCode,
            courseTitle: offer.curriculum.courseTitle,
            creditUnit: offer.curriculum.creditLec + offer.curriculum.creditLab,
        }));

        return NextResponse.json(mapped);
    } catch (error) {
        console.error("Error fetching subject offerings:", error);
        return NextResponse.json(
            { error: "Failed to fetch subject offerings" },
            { status: 500 }
        );
    }
}
