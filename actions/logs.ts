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
    importedName: string | null;
};

export type GetLogsFilters = {
    search?: string;
    academicYear?: string;
    semester?: string;
};

export type LogsMetadata = {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
};

export async function getFailedLogs(
    filters?: GetLogsFilters,
    page: number = 1,
    limit: number = 10
): Promise<{ data: FailedLog[]; metadata: LogsMetadata }> {
    const { userId } = await auth();
    const user = await currentUser();
    const role = user?.publicMetadata.role as string;
    if (!userId) {
        throw new Error("Permission Denied: You must be logged in to view logs.");
    }

    if (role !== "admin" && role !== "registrar") {
        throw new Error("Permission Denied: You do not have the required permissions (Admin or Registrar) to view these logs.");
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
            { importedName: { contains: filters.search, mode: "insensitive" } },
        ];
    }

    const total = await prisma.gradeLog.count({ where });
    const totalPages = Math.ceil(total / limit);

    const logs = await prisma.gradeLog.findMany({
        where,
        orderBy: {
            performedAt: "desc",
        },
        skip: (page - 1) * limit,
        take: limit,
    });

    const data = logs.map((log) => ({
        ...log,
        academicYear: log.academicYear,
        semester: log.semester,
        isResolved: log.isResolved,
        importedName: log.importedName,
    }));

    return {
        data,
        metadata: {
            total,
            page,
            limit,
            totalPages,
        },
    };
}

export async function resolveGradeLog(
    logId: string,
    gradeData: GradeData
): Promise<void> {
    const user = await currentUser();
    if (!user) {
        throw new Error("Permission Denied: You must be logged in to perform this action.");
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
        throw new Error("Missing Grade Details: Please ensure Student Number, Course Code, Grade, and Term are complete.");
    }

    // Verify student exists
    const student = await prisma.student.findUnique({
        where: { studentNumber: gradeData.studentNumber },
    });

    if (!student) {
        throw new Error(`Student Not Found: The student number '${gradeData.studentNumber}' does not match any registered student.`);
    }

    // Verify course code exists in curriculum
    const validCourse = await prisma.curriculumChecklist.findFirst({
        where: {
            courseCode: {
                equals: gradeData.courseCode,
                mode: "insensitive",
            },
        },
    });

    if (!validCourse) {
        throw new Error(`Invalid Course Code: '${gradeData.courseCode}' is not a recognized subject in the curriculum.`);
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

export type BulkResolveResult = {
    successCount: number;
    failureCount: number;
    failures: { id: string; error: string; studentNumber: string }[];
};

export async function bulkResolveLogs(
    logIds: string[],
    overrides?: Partial<GradeData>
): Promise<BulkResolveResult> {
    const user = await currentUser();
    const role = user?.publicMetadata.role as string;

    if (!user) {
        throw new Error("Permission Denied: You must be logged in to perform this action.");
    }

    if (role !== "admin" && role !== "registrar") {
        throw new Error("Permission Denied: You do not have the required permissions (Admin or Registrar) to resolve logs.");
    }

    const results: BulkResolveResult = {
        successCount: 0,
        failureCount: 0,
        failures: [],
    };

    // Process logs sequentially to avoid database lock issues with transactions if any
    for (const logId of logIds) {
        let currentStudentNumber = "Unknown";
        try {
            const log = await prisma.gradeLog.findUnique({
                where: { id: logId }
            });

            if (!log) {
                throw new Error("Log Retrieval Failed: The specified log entry could not be found.");
            }
            currentStudentNumber = log.studentNumber;

            if (log.isResolved) {
                results.successCount++;
                continue;
            }

            const gradeData: GradeData = {
                studentNumber: log.studentNumber,
                firstName: "",
                lastName: "",
                academicYear: log.academicYear,
                semester: log.semester,
                courseCode: log.courseCode,
                courseTitle: log.courseTitle,
                creditUnit: log.creditUnit,
                grade: log.grade,
                remarks: log.remarks || undefined,
                instructor: log.instructor,
                isResolved: false,
                ...overrides, // Apply overrides here
            };

            await resolveGradeLog(logId, gradeData);
            results.successCount++;

        } catch (error: any) {
            results.failureCount++;
            results.failures.push({
                id: logId,
                error: error.message || "Unknown error",
                studentNumber: currentStudentNumber
            });
        }
    }

    return results;
}
