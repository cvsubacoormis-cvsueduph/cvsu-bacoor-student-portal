import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit-postgres";
import { AcademicYear, Semester } from "@prisma/client";
import { z } from "zod";

export const runtime = "nodejs";

const REVIEWER_ROLES = ["admin", "superuser", "registrar"];

const bulkBodySchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  ids: z.array(z.string()).min(1, "At least one ID is required"),
  rejectionReason: z.string().max(500).optional(),
});

async function applyApprove(pendingChange: {
  id: string;
  action: string;
  studentNumber: string;
  gradeData: unknown;
  gradeId: string | null;
  academicYear: string | null;
  semester: string | null;
  requestedByName: string;
}) {
  const gradeData = pendingChange.gradeData as Record<string, any>;

  switch (pendingChange.action) {
    case "CREATE": {
      await prisma.academicTerm.upsert({
        where: {
          academicYear_semester: {
            academicYear: pendingChange.academicYear as AcademicYear,
            semester: pendingChange.semester as Semester,
          },
        },
        create: {
          academicYear: pendingChange.academicYear as AcademicYear,
          semester: pendingChange.semester as Semester,
        },
        update: {},
      });

      await prisma.grade.upsert({
        where: {
          studentNumber_courseCode_academicYear_semester: {
            studentNumber: pendingChange.studentNumber,
            courseCode: gradeData.courseCode,
            academicYear: pendingChange.academicYear as AcademicYear,
            semester: pendingChange.semester as Semester,
          },
        },
        create: {
          studentNumber: pendingChange.studentNumber,
          academicYear: pendingChange.academicYear as AcademicYear,
          semester: pendingChange.semester as Semester,
          courseCode: gradeData.courseCode,
          creditUnit: Number(gradeData.creditUnit) || 0,
          courseTitle: gradeData.courseTitle || "",
          grade: gradeData.grade || "",
          reExam: gradeData.reExam ?? null,
          remarks: gradeData.remarks ?? "",
          instructor: gradeData.instructor || "",
          uploadedBy: pendingChange.requestedByName,
        },
        update: {
          creditUnit: Number(gradeData.creditUnit) || 0,
          courseTitle: gradeData.courseTitle || "",
          grade: gradeData.grade || "",
          reExam: gradeData.reExam ?? null,
          remarks: gradeData.remarks ?? "",
          instructor: gradeData.instructor || "",
        },
      });

      await prisma.gradeLog.create({
        data: {
          studentNumber: pendingChange.studentNumber,
          courseCode: gradeData.courseCode,
          courseTitle: gradeData.courseTitle,
          creditUnit: Number(gradeData.creditUnit) || 0,
          grade: gradeData.grade,
          remarks: gradeData.remarks,
          instructor: gradeData.instructor,
          academicYear: pendingChange.academicYear as AcademicYear,
          semester: pendingChange.semester as Semester,
          action: "APPROVED_CREATE",
        },
      });
      break;
    }

    case "UPDATE": {
      if (!pendingChange.gradeId) throw new Error("UPDATE missing gradeId");

      const existingGrade = await prisma.grade.findUnique({
        where: { id: pendingChange.gradeId },
        select: { studentNumber: true, academicYear: true, semester: true },
      });

      await prisma.grade.update({
        where: { id: pendingChange.gradeId },
        data: {
          courseCode: gradeData.courseCode,
          creditUnit: Number(gradeData.creditUnit) || 0,
          courseTitle: gradeData.courseTitle,
          grade: gradeData.grade,
          reExam: gradeData.reExam ?? null,
          remarks: gradeData.remarks,
          instructor: gradeData.instructor,
        },
      });

      if (existingGrade) {
        await prisma.gradeLog.create({
          data: {
            studentNumber: existingGrade.studentNumber,
            courseCode: gradeData.courseCode,
            courseTitle: gradeData.courseTitle,
            creditUnit: Number(gradeData.creditUnit) || 0,
            grade: gradeData.grade,
            remarks: gradeData.remarks,
            instructor: gradeData.instructor,
            academicYear: existingGrade.academicYear,
            semester: existingGrade.semester,
            action: "APPROVED_UPDATE",
          },
        });
      }
      break;
    }

    case "DELETE": {
      if (!pendingChange.gradeId) throw new Error("DELETE missing gradeId");

      const gradeToDelete = await prisma.grade.findUnique({
        where: { id: pendingChange.gradeId },
        select: {
          studentNumber: true,
          courseCode: true,
          courseTitle: true,
          creditUnit: true,
          grade: true,
          remarks: true,
          instructor: true,
          academicYear: true,
          semester: true,
        },
      });

      if (gradeToDelete) {
        await prisma.gradeLog.create({
          data: {
            studentNumber: gradeToDelete.studentNumber,
            courseCode: gradeToDelete.courseCode,
            courseTitle: gradeToDelete.courseTitle,
            creditUnit: gradeToDelete.creditUnit,
            grade: gradeToDelete.grade,
            remarks: gradeToDelete.remarks,
            instructor: gradeToDelete.instructor,
            academicYear: gradeToDelete.academicYear,
            semester: gradeToDelete.semester,
            action: "APPROVED_DELETE",
          },
        });

        await prisma.grade.delete({ where: { id: pendingChange.gradeId } });
      }
      break;
    }
  }
}

export async function POST(request: Request) {
  try {
    const { userId, sessionClaims } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const role = (sessionClaims?.metadata as { role?: string })?.role;
    if (!role || !REVIEWER_ROLES.includes(role)) {
      return NextResponse.json(
        { error: "Forbidden: only registrars and admins can review changes" },
        { status: 403 }
      );
    }

    try {
      await checkRateLimit({
        action: "pending-changes-bulk",
        limit: 10,
        windowSeconds: 60,
      });
    } catch (error: any) {
      if (error.code === "RATE_LIMIT_EXCEEDED") {
        return NextResponse.json({ error: error.message }, { status: 429 });
      }
      console.error("Rate limiter error (non-blocking):", error.message);
    }

    const body = await request.json();
    const validationResult = bulkBodySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { action, ids, rejectionReason } = validationResult.data;

    const user = await currentUser();
    const reviewerName = user?.fullName ?? "";

    const results: { id: string; success: boolean; error?: string }[] = [];

    if (action === "APPROVE") {
      for (const id of ids) {
        try {
          const pendingChange = await prisma.pendingGradeChange.findUnique({
            where: { id },
          });

          if (!pendingChange) {
            results.push({ id, success: false, error: "Not found" });
            continue;
          }

          if (pendingChange.status !== "PENDING") {
            results.push({
              id,
              success: false,
              error: `Already ${pendingChange.status}`,
            });
            continue;
          }

          await applyApprove(pendingChange);

          await prisma.pendingGradeChange.update({
            where: { id },
            data: {
              status: "APPROVED",
              reviewedById: userId,
              reviewedByName: reviewerName,
              reviewedAt: new Date(),
            },
          });

          results.push({ id, success: true });
        } catch (err: any) {
          results.push({ id, success: false, error: err.message });
        }
      }
    } else {
      for (const id of ids) {
        try {
          const pendingChange = await prisma.pendingGradeChange.findUnique({
            where: { id },
          });

          if (!pendingChange) {
            results.push({ id, success: false, error: "Not found" });
            continue;
          }

          if (pendingChange.status !== "PENDING") {
            results.push({
              id,
              success: false,
              error: `Already ${pendingChange.status}`,
            });
            continue;
          }

          await prisma.pendingGradeChange.update({
            where: { id },
            data: {
              status: "REJECTED",
              reviewedById: userId,
              reviewedByName: reviewerName,
              reviewedAt: new Date(),
              rejectionReason: rejectionReason || null,
            },
          });

          results.push({ id, success: true });
        } catch (err: any) {
          results.push({ id, success: false, error: err.message });
        }
      }
    }

    const succeeded = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    return NextResponse.json({
      message:
        failed === 0
          ? `All ${succeeded} changes ${action === "APPROVE" ? "approved" : "rejected"} successfully`
          : `${succeeded} ${action === "APPROVE" ? "approved" : "rejected"}, ${failed} failed`,
      results,
    });
  } catch (error) {
    console.error("Error processing bulk changes:", error);
    return NextResponse.json(
      { error: "Failed to process bulk changes" },
      { status: 500 }
    );
  }
}
