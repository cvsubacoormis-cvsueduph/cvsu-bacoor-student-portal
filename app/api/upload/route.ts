import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { Courses, Major, Status, UserSex } from "@prisma/client";
import { CreateStudentSchema } from "@/lib/formValidationSchemas";
import { clerkClient } from "@clerk/nextjs/server";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { auth } from "@clerk/nextjs/server";
export const runtime = "nodejs";

const rateLimiter = new RateLimiterMemory({
  points: 1000,
  duration: 10,
  blockDuration: 10,
  keyPrefix: "rl",
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getClientIp = (request: NextRequest) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0].trim() || "127.0.0.1"; // First IP in the chain
};

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ip = getClientIp(request);
  console.log("Current IP:", ip);
  const clerk = await clerkClient();

  try {
    await rateLimiter.consume(ip);
  } catch (rateLimiterRes) {
    return NextResponse.json(
      {
        error: "Too many requests. Please try again later.",
        retryAfter: Math.ceil(
          (rateLimiterRes as { msBeforeNext: number }).msBeforeNext / 1000
        ),
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil(
              (rateLimiterRes as { msBeforeNext: number }).msBeforeNext / 1000
            )
          ),
        },
      }
    );
  }

  // Abort controller for cancellation
  const controller = new AbortController();
  const { signal } = controller;

  try {
    request.signal.addEventListener("abort", () => controller.abort());

    const formData = await request.formData();
    const file = formData.get("file") as Blob;
    if (!file) {
      return NextResponse.json({ error: "File not provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "binary" });
    const sheetName = workbook.SheetNames[0];
    const workSheet = workbook.Sheets[sheetName];
    const students: CreateStudentSchema[] = XLSX.utils.sheet_to_json(workSheet);

    // Check for duplicates
    const existingStudentNumbers = await prisma.student
      .findMany({ select: { studentNumber: true } })
      .then((students) => new Set(students.map((s) => s.studentNumber)));

    const duplicates: { studentNumber: string; name: string }[] = [];
    const studentsToCreate = students.filter((student) => {
      if (existingStudentNumbers.has(String(student.studentNumber))) {
        duplicates.push({
          studentNumber: student.studentNumber.toString(),
          name: `${student.firstName} ${student.lastName}`,
        });
        return false;
      }
      return true;
    });

    // Batch processing (5 at a time)
    const batchSize = 5;
    for (let i = 0; i < studentsToCreate.length; i += batchSize) {
      if (signal.aborted) throw new Error("Upload cancelled by user");

      const batch = studentsToCreate.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (student) => {
          try {
            if (signal.aborted) throw new Error("Upload cancelled by user");

            const username = `${
              student.studentNumber
            }${student.firstName.toLowerCase()}`
              .toLowerCase()
              .replace(/[^a-zA-Z0-9_-]/g, "")
              .replaceAll("-", "");

            const password = `cvsubacoor${username}`;

            const user = await clerk.users.createUser({
              username,
              firstName: student.firstName.toUpperCase(),
              lastName: student.lastName.toUpperCase(),
              emailAddress: [student.email ?? ""],
              password: password,
              skipPasswordChecks: true,
              publicMetadata: { role: "student", isApproved: true },
            });

            await prisma.student.upsert({
              where: { id: user.id },
              create: {
                studentNumber: String(student.studentNumber).replaceAll(
                  "-",
                  ""
                ),
                username,
                firstName: student.firstName,
                lastName: student.lastName,
                middleInit: student.middleInit ? student.middleInit[0] : "",
                email: student.email ?? "",
                phone: student.phone ? String(student.phone) : "N/A",
                address: student.address.toUpperCase() ?? "N/A",
                sex: String(student.sex).toUpperCase() as UserSex,
                course: student.course.trim() as Courses,
                major: student.major ? (student.major.trim() as Major) : null,
                status: student.status.trim() as Status,
                createdAt: new Date(),
                isPasswordSet: true,
                isApproved: true,
                id: user.id,
              },
              update: {
                studentNumber: String(student.studentNumber).replaceAll(
                  "-",
                  ""
                ),
                username,
                firstName: student.firstName,
                lastName: student.lastName,
                middleInit: student.middleInit ? student.middleInit[0] : "",
                email: student.email ?? "",
                phone: student.phone ? String(student.phone) : "N/A",
                address: student.address.toUpperCase() ?? "N/A",
                sex: String(student.sex).toUpperCase() as UserSex,
                course: student.course.trim() as Courses,
                major: student.major ? (student.major.trim() as Major) : null,
                status: student.status.trim() as Status,
                createdAt: new Date(),
                isApproved: true,
                id: user.id,
              },
            });
          } catch (error) {
            if (
              error instanceof Error &&
              error.message === "Upload cancelled by user"
            ) {
              throw error;
            }
            console.error(
              `Error creating student ${student.studentNumber}:`,
              error
            );
          }
        })
      );

      await delay(50); // Rate limit Clerk API calls
    }

    // Handle duplicates (export to XLSX if any)
    if (duplicates.length > 0) {
      const worksheet = XLSX.utils.json_to_sheet(duplicates);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Duplicates");

      const fileBuffer = XLSX.write(workbook, {
        bookType: "xlsx",
        type: "array",
      });

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": "attachment; filename=duplicates.xlsx",
        },
      });
    }

    return NextResponse.json({
      message: `Success! Created ${studentsToCreate.length}/${students.length} students.`,
      duplicates,
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "Upload cancelled by user"
    ) {
      return NextResponse.json(
        { error: "Upload cancelled by user" },
        { status: 499 }
      );
    }
    console.error("Error uploading students:", error);
    return NextResponse.json(
      { error: "Failed to upload students" },
      { status: 500 }
    );
  }
}
