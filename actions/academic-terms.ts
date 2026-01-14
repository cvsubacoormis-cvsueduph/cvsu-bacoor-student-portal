"use server";

import prisma from "@/lib/prisma";
import { AcademicYear, Semester } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

export async function createAcademicTerm(data: {
    academicYear: AcademicYear;
    semester: Semester;
}) {
    const { userId } = await auth();

    if (!userId) {
        return { success: false, message: "Unauthorized" };
    }

    try {
        const existingTerm = await prisma.academicTerm.findUnique({
            where: {
                academicYear_semester: {
                    academicYear: data.academicYear,
                    semester: data.semester,
                },
            },
        });

        if (existingTerm) {
            return { success: false, message: "Academic Term already exists." };
        }

        await prisma.academicTerm.create({
            data: {
                academicYear: data.academicYear,
                semester: data.semester,
            },
        });

        revalidatePath("/list/subject-offering");
        return { success: true, message: "Academic Term created successfully." };
    } catch (error) {
        console.error("Failed to create academic term:", error);
        return { success: false, message: "Failed to create academic term." };
    }
}

export async function getAllAcademicTerms() {
    try {
        const terms = await prisma.academicTerm.findMany({
            orderBy: [
                { academicYear: "desc" },
                { semester: "desc" }, // Sort semester conceptually if possible, existing enum might be tricky but this is fine
            ],
        });
        return terms;
    } catch (error) {
        console.error("Failed to fetch academic terms:", error);
        return [];
    }
}
