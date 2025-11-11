import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { Courses, Major, Status, UserSex } from "@prisma/client";
import { RateLimiterMemory } from "rate-limiter-flexible";
import { auth } from "@clerk/nextjs/server";

export const runtime = "nodejs";

const rateLimiter = new RateLimiterMemory({
  points: 20,
  duration: 10,
});

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const getClientIp = (request: NextRequest) => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0].trim() || "127.0.0.1";
};

export async function POST(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ip = getClientIp(request);

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

  const controller = new AbortController();
  const { signal } = controller;
  request.signal.addEventListener("abort", () => controller.abort());

  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;
    if (!file) {
      return NextResponse.json({ error: "File not provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "binary" });
    const sheetName = workbook.SheetNames[0];
    const workSheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, any>>(workSheet);

    // Map spreadsheet columns
    const students = rows.map((row) => ({
      id: String(row["id"] || "").trim(),
      studentNumber: String(row["studentNumber"] || "").trim(),
      firstName: String(row["firstName"] || "").trim(),
      lastName: String(row["lastName"] || "").trim(),
      middleI: String(row["middleI"] || "").trim(),
      email: String(row["email"] || "").trim(),
      phone: String(row["phone"] || "").trim(),
      address: String(row["address"] || "").trim(),
      sex: String(row["sex"] || "").toUpperCase(),
      course: String(row["course"] || "").trim(),
      major: row["major"] ? String(row["major"]).trim() : null,
      status: String(row["status"] || "").trim(),
      role: row["role"] || "student",
    }));

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

    // Batch insert (5 at a time)
    const batchSize = 5;
    for (let i = 0; i < studentsToCreate.length; i += batchSize) {
      if (signal.aborted) throw new Error("Upload cancelled by user");

      const batch = studentsToCreate.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (student) => {
          try {
            if (signal.aborted) throw new Error("Upload cancelled by user");

            const username = `${student.studentNumber}a`.toLowerCase();

            await prisma.student.create({
              data: {
                id: student.id, // ✅ Use exact ID from Excel
                studentNumber: student.studentNumber,
                username,
                firstName: student.firstName,
                lastName: student.lastName,
                middleInit: student.middleI || "",
                email: student.email,
                phone: student.phone || "N/A",
                address: student.address || "N/A",
                sex: student.sex as UserSex,
                course: student.course as Courses,
                major: student.major as Major | null,
                status: student.status as Status,
                isApproved: true,
                isPasswordSet: true,
                createdAt: new Date(),
              },
            });
          } catch (error) {
            console.error(`Error inserting ${student.studentNumber}:`, error);
          }
        })
      );

      await delay(1000); // small delay between batches
    }

    // Export duplicates as Excel if found
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
      message: `✅ Success! Imported ${studentsToCreate.length}/${students.length} students using provided IDs.`,
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
