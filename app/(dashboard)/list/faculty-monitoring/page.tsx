import { currentUser } from "@clerk/nextjs/server";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { FacultyMonitoringClient } from "@/components/FacultyMonitoringClient";
import { getFacultyUploadStatus } from "@/actions/faculty-monitoring";
import prisma from "@/lib/prisma";
import { AcademicYear, Semester } from "@prisma/client";
import { z } from "zod";

// ── SearchParams validation schema ──────────────────────────────────────────
const searchParamsSchema = z.object({
  page: z.coerce.number().int().positive().max(10_000).optional().default(1),
  pageSize: z.coerce
    .number()
    .int()
    .positive()
    .min(1)
    .max(100)
    .optional()
    .default(10),
  search: z.string().max(100).optional().default(""),
  status: z.enum(["all", "uploaded", "not-uploaded"]).optional().default("all"),
  academicYear: z.string().max(20).optional().default(""),
  semester: z.string().max(20).optional().default(""),
});

// ── AcademicYear enum guard ─────────────────────────────────────────────────
const VALID_ACADEMIC_YEARS: Set<string> = new Set([
  "AY_2014_2015",
  "AY_2015_2016",
  "AY_2016_2017",
  "AY_2017_2018",
  "AY_2018_2019",
  "AY_2019_2020",
  "AY_2020_2021",
  "AY_2021_2022",
  "AY_2022_2023",
  "AY_2023_2024",
  "AY_2024_2025",
  "AY_2025_2026",
  "AY_2026_2027",
  "AY_2027_2028",
  "AY_2028_2029",
  "AY_2029_2030",
  "AY_2030_2031",
  "AY_2031_2032",
  "AY_2032_2033",
  "AY_2033_2034",
  "AY_2034_2035",
  "AY_2035_2036",
  "AY_2036_2037",
  "AY_2037_2038",
  "AY_2038_2039",
  "AY_2039_2040",
]);

const VALID_SEMESTERS: Set<string> = new Set(["FIRST", "SECOND", "MIDYEAR"]);

// ── Page ────────────────────────────────────────────────────────────────────

export default async function FacultyMonitoringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // ── Auth check ─────────────────────────────────────────────────────────
  const user = await currentUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const isAdminOrRegistrar =
    role === "admin" || role === "superuser" || role === "registrar" || role === "registrar_staff";
  const isFaculty = role === "faculty";

  if (!isAdminOrRegistrar && !isFaculty) {
    return (
      <div className="p-4 m-4 mt-0 bg-white rounded-md flex items-center justify-center h-64">
        <p className="text-gray-500">
          You are not authorized to view this page.
        </p>
      </div>
    );
  }

  // ── Resolve faculty User record for faculty self-view ──────────────────
  let currentFacultyId: string | null = null;

  if (isFaculty && user) {
    const clerkUsername = user.username;
    if (clerkUsername) {
      const facultyRecord = await prisma.user.findFirst({
        where: { username: clerkUsername, role: "faculty" },
        select: { id: true },
      });
      currentFacultyId = facultyRecord?.id ?? null;
    }
  }

  // ── Parse & validate searchParams ──────────────────────────────────────
  const rawParams = await searchParams;
  const parsed = searchParamsSchema.safeParse(rawParams);

  const {
    page,
    pageSize,
    search,
    status,
    academicYear: ay,
    semester: sem,
  } = parsed.success
    ? parsed.data
    : {
        page: 1,
        pageSize: 10,
        search: "",
        status: "all" as const,
        academicYear: "",
        semester: "",
      };

  // ── Guard enum values from URL tampering ───────────────────────────────
  const safeAcademicYear = VALID_ACADEMIC_YEARS.has(ay)
    ? (ay as AcademicYear)
    : null;
  const safeSemester = VALID_SEMESTERS.has(sem) ? (sem as Semester) : null;
  const canFetch = safeAcademicYear !== null && safeSemester !== null;

  // ── Fetch data (only when term is selected) ────────────────────────────
  let data = null as Awaited<ReturnType<typeof getFacultyUploadStatus>> | null;

  if (canFetch) {
    try {
      data = await getFacultyUploadStatus({
        academicYear: safeAcademicYear!,
        semester: safeSemester!,
        page,
        pageSize,
        search,
        status,
        ...(isFaculty && currentFacultyId
          ? { facultyId: currentFacultyId }
          : {}),
      });
    } catch (error) {
      console.error("Error fetching faculty monitoring data:", error);
      // Graceful fallback — client will show error state via empty data
    }
  }

  const items = data?.data ?? [];
  const total = data?.total ?? 0;

  return (
    <div>
      <SignedIn>
        <div className="bg-white p-4 rounded-md m-4 mt-0">
          <h2 className="text-lg font-semibold mb-1">
            {isFaculty ? "My Uploaded Grades" : "Faculty Upload Monitoring"}
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            {isFaculty
              ? "View your uploaded grades for specific academic terms."
              : "Monitor which faculties have uploaded grades for specific academic terms."}
          </p>
          <FacultyMonitoringClient
            data={items}
            total={total}
            page={page}
            pageSize={pageSize}
            isFacultyView={isFaculty}
            currentFacultyId={currentFacultyId}
          />
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </div>
  );
}
