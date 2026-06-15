"use server";

import prisma from "@/lib/prisma";
import { AcademicYear, Semester, Prisma } from "@prisma/client";
import { auth } from "@clerk/nextjs/server";

// ── Types ───────────────────────────────────────────────────────────────────

export interface FacultyUploadStatus {
  id: string;
  username: string;
  name: string;
  hasUploaded: boolean;
  gradesUploadedCount: number;
}

export interface GetFacultyUploadStatusParams {
  academicYear: AcademicYear;
  semester: Semester;
  page: number;
  pageSize: number;
  search?: string;
  status?: "all" | "uploaded" | "not-uploaded";
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalizes an instructor name by removing titles, suffixes, and special chars.
 * Used to robustly match Grade.instructor / Grade.uploadedBy fields to User records.
 */
function normalizeInstructorName(name: string): string {
  if (!name) return "";
  const cleaned = String(name).replace(/['.,]/g, "").toUpperCase();
  const tokens = cleaned.split(/\s+/);

  const ignoredWords = new Set([
    "MR", "MS", "MRS", "DR", "PROF", "ENGR", "ARCH", "ATTY", "REV", "FR",
    "HON", "LPT", "MIT", "MSCS", "MAED", "PHD", "EDD", "MAT", "MBA", "MPA",
    "RN", "CPA", "MD", "JD", "DMD", "DBA", "DPA", "INSTRUCTOR", "FACULTY",
    "PROFESSOR",
  ]);

  const filtered = tokens.filter((t) => !ignoredWords.has(t));
  return filtered.join(" ");
}

// ── Auth guard ──────────────────────────────────────────────────────────────

async function authorizeAccess(): Promise<void> {
  const { userId, sessionClaims } = await auth();
  if (!userId) throw new Error("Unauthorized");
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const allowedRoles = ["admin", "superuser", "registrar", "faculty"];
  if (!role || !allowedRoles.includes(role)) {
    throw new Error("Forbidden: insufficient permissions.");
  }
}

// ── Main action ─────────────────────────────────────────────────────────────

export async function getFacultyUploadStatus(
  params: GetFacultyUploadStatusParams,
): Promise<{ data: FacultyUploadStatus[]; total: number }> {
  const { academicYear, semester, page, pageSize, search, status } = params;

  await authorizeAccess();

  try {
    // ── 1. Build Prisma search filter ───────────────────────────────────
    const searchFilter: Prisma.UserWhereInput = search
      ? {
          OR: [
            { firstName: { contains: search, mode: "insensitive" } },
            { lastName: { contains: search, mode: "insensitive" } },
            { username: { contains: search, mode: "insensitive" } },
          ],
        }
      : {};

    // ── 2. Fetch all matching faculties ─────────────────────────────────
    const allFaculties = await prisma.user.findMany({
      where: {
        role: "faculty",
        ...searchFilter,
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        middleInit: true,
      },
      orderBy: { lastName: "asc" },
    });

    if (allFaculties.length === 0) {
      return { data: [], total: 0 };
    }

    // ── 3. Fetch grades for the active term ─────────────────────────────
    const gradesGrouped = await prisma.grade.groupBy({
      by: ["uploadedBy", "instructor"],
      where: { academicYear, semester },
      _count: { id: true },
    });

    // ── 4. Build lookup maps for robust matching ────────────────────────
    const uploadedByMap = new Map<string, number>();
    const instructorMap = new Map<string, number>();

    for (const group of gradesGrouped) {
      if (group.uploadedBy) {
        const cleanName = group.uploadedBy.toLowerCase().replace(/\s+/g, " ").trim();
        uploadedByMap.set(
          cleanName,
          (uploadedByMap.get(cleanName) ?? 0) + group._count.id,
        );
      }
      if (group.instructor) {
        const cleanInst = normalizeInstructorName(group.instructor).toLowerCase();
        instructorMap.set(
          cleanInst,
          (instructorMap.get(cleanInst) ?? 0) + group._count.id,
        );
      }
    }

    // ── 5. Map each faculty to upload status ────────────────────────────
    let statusResults: FacultyUploadStatus[] = allFaculties.map((faculty) => {
      const name = [
        `${faculty.lastName}, ${faculty.firstName}`,
        faculty.middleInit ? ` ${faculty.middleInit}.` : "",
      ]
        .join("")
        .trim();

      // Multiple name permutations for matching against uploadedBy / instructor
      const clerkFull = `${faculty.firstName} ${faculty.lastName}`
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      const clerkFullMid = faculty.middleInit
        ? `${faculty.firstName} ${faculty.middleInit} ${faculty.lastName}`
            .toLowerCase()
            .replace(/\s+/g, " ")
            .trim()
        : clerkFull;
      const reversed = `${faculty.lastName} ${faculty.firstName}`
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim();
      const usernameLower = faculty.username.toLowerCase();

      // Normalized instructor names for this faculty
      const norm1 = normalizeInstructorName(
        `${faculty.firstName} ${faculty.lastName}`,
      ).toLowerCase();
      const norm2 = normalizeInstructorName(
        `${faculty.firstName} ${faculty.middleInit ?? ""} ${faculty.lastName}`,
      ).toLowerCase();

      // Try uploadedBy first, then instructor
      let count =
        uploadedByMap.get(clerkFull) ??
        uploadedByMap.get(usernameLower) ??
        uploadedByMap.get(reversed) ??
        uploadedByMap.get(clerkFullMid) ??
        0;

      if (count === 0) {
        count = instructorMap.get(norm1) ?? instructorMap.get(norm2) ?? 0;
      }

      return {
        id: faculty.id,
        username: faculty.username,
        name,
        hasUploaded: count > 0,
        gradesUploadedCount: count,
      };
    });

    // ── 6. Apply status filter (after mapping) ──────────────────────────
    if (status === "uploaded") {
      statusResults = statusResults.filter((f) => f.hasUploaded);
    } else if (status === "not-uploaded") {
      statusResults = statusResults.filter((f) => !f.hasUploaded);
    }

    const total = statusResults.length;

    // ── 7. Paginate: pageSize of 0 means "return all" (used for export) ─
    const data =
      pageSize === 0
        ? statusResults
        : statusResults.slice((page - 1) * pageSize, page * pageSize);

    return { data, total };
  } catch (error) {
    console.error("Failed to fetch faculty upload status", error);
    throw new Error("Failed to fetch faculty upload status");
  }
}
