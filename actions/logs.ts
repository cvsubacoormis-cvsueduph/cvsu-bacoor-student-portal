"use server";

import prisma from "@/lib/prisma";
import { GradeData } from "./grades";
import { auth, currentUser } from "@clerk/nextjs/server";

export type FailedLog = {
    id: string;
    studentNumber: string;
    courseCode: string;
    courseTitle: string;
    creditUnit: number;
    grade: string;
    remarks: string | null;
    instructor: string;
    academicYear: string;
    semester: string;
    action: string;
    performedAt: Date;
    isResolved: boolean;
};

export type GetLogsFilters = {
    search?: string;
    academicYear?: string;
    semester?: string;
};

export async function getFailedLogs(filters?: GetLogsFilters): Promise<FailedLog[]> {
    const { userId } = await auth();
    if (!userId) {
        throw new Error("Unauthorized");
    }

    const where: any = {
        action: { in: ["FAILED", "WARNING"] },
        isResolved: false,
    };

    if (filters?.academicYear && filters.academicYear !== "ALL") {
        where.academicYear = filters.academicYear;
    }

    if (filters?.semester && filters.semester !== "ALL") {
        where.semester = filters.semester;
    }

    if (filters?.search) {
        where.OR = [
            { studentNumber: { contains: filters.search, mode: "insensitive" } },
            { courseCode: { contains: filters.search, mode: "insensitive" } },
            { instructor: { contains: filters.search, mode: "insensitive" } },
        ];
    }

    const logs = await prisma.gradeLog.findMany({
        where,
        orderBy: {
            performedAt: "desc",
        },
    });

    return logs.map((log) => ({
        ...log,
        academicYear: log.academicYear,
        semester: log.semester,
        isResolved: log.isResolved,
    }));
}

export async function resolveGradeLog(
    logId: string,
    gradeData: GradeData
): Promise<void> {
    const user = await currentUser();
    if (!user) {
        throw new Error("Unauthorized");
    }

    // Validate required fields
    if (
        !gradeData.studentNumber ||
        !gradeData.academicYear ||
        !gradeData.semester ||
        !gradeData.courseCode ||
        !gradeData.courseTitle ||
        gradeData.creditUnit === undefined ||
        !gradeData.grade ||
        !gradeData.instructor
    ) {
        throw new Error("Missing required fields");
    }

    await prisma.$transaction(async (prisma) => {
        // 1. Ensure the academic term exists
        await prisma.academicTerm.upsert({
            where: {
                academicYear_semester: {
                    academicYear: gradeData.academicYear,
                    semester: gradeData.semester,
                },
            },
            create: {
                academicYear: gradeData.academicYear,
                semester: gradeData.semester,
            },
            update: {},
        });

        // 2. Find the subject offering
        const subjectOffering = await prisma.subjectOffering.findFirst({
            where: {
                academicYear: gradeData.academicYear,
                semester: gradeData.semester,
                curriculum: {
                    courseCode: gradeData.courseCode,
                },
            },
        });

        // 3. Prepare the base data for upsert
        const baseData = {
            courseTitle: gradeData.courseTitle.toUpperCase(),
            creditUnit: Number(gradeData.creditUnit),
            grade: gradeData.grade,
            reExam: gradeData.reExam,
            remarks: String(gradeData.remarks),
            instructor: gradeData.instructor,
            academicYear: gradeData.academicYear,
            semester: gradeData.semester,
        };

        // 4. Upsert the grade record
        if (subjectOffering) {
            await prisma.grade.upsert({
                where: {
                    studentNumber_courseCode_academicYear_semester: {
                        studentNumber: gradeData.studentNumber,
                        courseCode: gradeData.courseCode.toUpperCase(),
                        academicYear: gradeData.academicYear,
                        semester: gradeData.semester,
                    },
                },
                create: {
                    ...baseData,
                    studentNumber: gradeData.studentNumber,
                    courseCode: gradeData.courseCode.toUpperCase(),
                    subjectOfferingId: subjectOffering.id,
                    uploadedBy: user.fullName || "",
                },
                update: {
                    ...baseData,
                    subjectOfferingId: subjectOffering.id,
                    uploadedBy: user.fullName || "",
                },
            });
        } else {
            await prisma.grade.upsert({
                where: {
                    studentNumber_courseCode_academicYear_semester: {
                        studentNumber: gradeData.studentNumber,
                        courseCode: gradeData.courseCode.toUpperCase(),
                        academicYear: gradeData.academicYear,
                        semester: gradeData.semester,
                    },
                },
                create: {
                    ...baseData,
                    studentNumber: gradeData.studentNumber,
                    courseCode: gradeData.courseCode.toUpperCase(),
                    uploadedBy: user.fullName || "",
                },
                update: {
                    ...baseData,
                    uploadedBy: user.fullName || "",
                },
            });
        }

        // 5. Update the original log to resolved
        await prisma.gradeLog.update({
            where: { id: logId },
            data: { isResolved: true },
        });

        // 6. Create a new log entry for the successful action
        await prisma.gradeLog.create({
            data: {
                studentNumber: gradeData.studentNumber,
                courseCode: gradeData.courseCode.toUpperCase(),
                courseTitle: gradeData.courseTitle.toUpperCase(),
                creditUnit: Number(gradeData.creditUnit),
                grade: gradeData.grade,
                remarks: gradeData.remarks,
                instructor: gradeData.instructor,
                academicYear: gradeData.academicYear,
                semester: gradeData.semester,
                action: "RESOLVED_FAILURE",
            },
        });
    });
}
