import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit-postgres";
import { AcademicYear, Semester } from "@prisma/client";
import { z } from "zod";

export const runtime = "nodejs";

const REVIEWER_ROLES = ["admin", "superuser", "registrar"];

// Validation for PATCH body
const reviewBodySchema = z
  .object({
    action: z.enum(["APPROVE", "REJECT"]),
    rejectionReason: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.action === "REJECT" && !data.rejectionReason) {
        return false;
      }
      return true;
    },
    {
      message: "Rejection reason is required when rejecting",
      path: ["rejectionReason"],
    }
  );

// ---------------------------------------------------------------------------
// PATCH — Approve or reject a pending grade change
// ---------------------------------------------------------------------------
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
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

    // Rate limiting — log and continue on non-RATE_LIMIT_EXCEEDED errors
    try {
      await checkRateLimit({
        action: "pending-changes-patch",
        limit: 30,
        windowSeconds: 60,
      });
    } catch (error: any) {
      if (error.code === "RATE_LIMIT_EXCEEDED") {
        return NextResponse.json({ error: error.message }, { status: 429 });
      }
      console.error("Rate limiter error (non-blocking):", error.message);
    }

    const { id } = await params;
    const body = await request.json();
    const validationResult = reviewBodySchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Invalid request body",
          details: validationResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { action, rejectionReason } = validationResult.data;

    // Fetch the pending change
    const pendingChange = await prisma.pendingGradeChange.findUnique({
      where: { id },
    });

    if (!pendingChange) {
      return NextResponse.json(
        { error: "Pending change not found" },
        { status: 404 }
      );
    }

    if (pendingChange.status !== "PENDING") {
      return NextResponse.json(
        { error: `Change is already ${pendingChange.status}` },
        { status: 409 }
      );
    }

    const user = await currentUser();
    const reviewerName = user?.fullName ?? "";

    // ------------------------------------------------------------------
    // APPROVE: apply the change and mark as approved
    // ------------------------------------------------------------------
    if (action === "APPROVE") {
      const gradeData = pendingChange.gradeData as Record<string, any>;

      switch (pendingChange.action) {
        case "CREATE": {
          // Ensure academic term exists
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

          // Upsert the grade
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

          // Audit log
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
          if (!pendingChange.gradeId) {
            return NextResponse.json(
              { error: "UPDATE pending change is missing gradeId" },
              { status: 400 }
            );
          }

          // Fetch existing grade for the audit log
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

          // Audit log
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
          if (!pendingChange.gradeId) {
            return NextResponse.json(
              { error: "DELETE pending change is missing gradeId" },
              { status: 400 }
            );
          }

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
            // Audit log before deletion
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

        default:
          return NextResponse.json(
            { error: `Unknown action: ${pendingChange.action}` },
            { status: 400 }
          );
      }

      // Mark as approved
      await prisma.pendingGradeChange.update({
        where: { id },
        data: {
          status: "APPROVED",
          reviewedById: userId,
          reviewedByName: reviewerName,
          reviewedAt: new Date(),
        },
      });

      return NextResponse.json({
        message: "Change approved and applied successfully",
        status: "APPROVED",
      });
    }

    // ------------------------------------------------------------------
    // REJECT: mark as rejected
    // ------------------------------------------------------------------
    if (action === "REJECT") {
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

      return NextResponse.json({
        message: "Change rejected",
        status: "REJECTED",
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Error processing pending change:", error);
    return NextResponse.json(
      { error: "Failed to process pending change" },
      { status: 500 }
    );
  }
}
