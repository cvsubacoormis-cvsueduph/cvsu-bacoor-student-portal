import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/rate-limit-postgres";
import {
  CheckCircle2Icon,
  XCircleIcon,
  ShieldCheckIcon,
  ShieldBanIcon,
  ClockIcon,
  AlertTriangleIcon,
  BookOpenIcon,
  HashIcon,
  UserIcon,
  LayoutDashboardIcon,
  LogInIcon,
  BanIcon,
  RefreshCwIcon,
} from "lucide-react";
import { courseMap, formatMajor } from "@/lib/courses";
import Link from "next/link";
import { RevokeForm } from "./revoke-form";

type GradeRow = {
  courseCode: string;
  courseTitle: string;
  creditUnit: number;
  grade: string;
  reExam: string | null;
  remarks: string;
  instructor: string;
};

async function getVerification(hash: string) {
  try {
    return await prisma.cogVerification.findUnique({ where: { hash } });
  } catch {
    return null;
  }
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function semesterLabel(sem: string) {
  switch (sem) {
    case "FIRST":
      return "First Semester";
    case "SECOND":
      return "Second Semester";
    case "MIDYEAR":
      return "Midyear";
    default:
      return sem;
  }
}

function InfoRow({ label, value }: { label: string; value: string | React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-900">{value}</span>
    </div>
  );
}

function UniversityHeader() {
  return (
    <div className="text-center mb-8">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/printlogo.png" alt="CvSU Logo" className="mx-auto h-16 w-auto mb-3" />
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
        Republic of the Philippines
      </p>
      <h1 className="text-lg font-bold text-slate-900 mt-0.5">CAVITE STATE UNIVERSITY</h1>
      <p className="text-sm font-semibold text-slate-700">Bacoor City Campus</p>
      <p className="text-xs text-slate-500">SHIV, Molino VI City of Bacoor &bull; (046) 476-5029</p>
      <p className="text-xs text-slate-500">cvsubacoor@cvsu.edu.ph</p>
      <div className="mt-3 h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent" />
    </div>
  );
}

function RateLimitedPage() {
  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 flex items-center justify-center">
      <div className="max-w-md w-full">
        <UniversityHeader />
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-amber-500 to-amber-400" />
          <div className="p-6 sm:p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <ClockIcon className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Too Many Requests</h2>
            <p className="text-sm text-slate-500 mb-6">
              You have exceeded the rate limit for document verification. Please wait a moment
              before trying again.
            </p>
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors"
            >
              <LayoutDashboardIcon className="w-4 h-4" /> Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccessDenied({
  isLoggedIn,
  dashboardUrl,
  role,
}: {
  isLoggedIn: boolean;
  dashboardUrl: string;
  role?: string;
}) {
  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 flex items-center justify-center">
      <div className="max-w-md w-full">
        <UniversityHeader />
        <div className="bg-white rounded-xl shadow-sm border border-amber-200 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-amber-500 to-amber-400" />
          <div className="p-6 sm:p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mb-4">
              <ShieldCheckIcon className="w-8 h-8 text-amber-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Access Restricted</h2>
            {role === "student" ? (
              <>
                <p className="text-sm text-slate-500 mb-4">
                  Grade verification is only available to faculty, registrar, registrar staff, and admin personnel.
                  Students cannot verify documents through this page.
                </p>
                <p className="text-sm text-slate-400 mb-6">
                  If you need to check your grades, please visit your student dashboard or contact
                  the Office of the Campus Registrar.
                </p>
              </>
            ) : (
              <p className="text-sm text-slate-500 mb-6">
                You do not have permission to access grade verification. Only faculty, registrar,
                registrar staff, and admin personnel can verify student documents.
              </p>
            )}
            <a
              href={dashboardUrl}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
            >
              {isLoggedIn ? (
                <><LayoutDashboardIcon className="w-4 h-4" /> Go to Dashboard</>
              ) : (
                <><LogInIcon className="w-4 h-4" /> Sign In</>
              )}
            </a>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">
          Cavite State University - Bacoor Campus &bull; Office of the Campus Registrar
        </p>
      </div>
    </div>
  );
}

function NotFoundFallback({ hash, dashboardUrl }: { hash: string; dashboardUrl: string }) {
  const isLoggedIn = dashboardUrl !== "/sign-in";
  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-lg mx-auto">
        <UniversityHeader />
        <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
          <div className="h-2 bg-gradient-to-r from-red-500 to-red-400" />
          <div className="p-6 sm:p-8 text-center">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <XCircleIcon className="w-8 h-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Document Not Verified</h2>
            <p className="text-sm text-slate-500 mb-6 max-w-sm mx-auto">
              This Certificate of Grades could not be verified. It may have been altered, or the
              verification record does not exist in the university database.
            </p>
            <div className="border-t border-slate-100 pt-6 mb-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left text-sm space-y-2">
                <div className="flex items-start gap-2">
                  <AlertTriangleIcon className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <span className="text-amber-800">
                    <strong>Possible reasons:</strong>
                  </span>
                </div>
                <ul className="text-amber-700 text-xs space-y-1 ml-6 list-disc">
                  <li>The QR code or link was copied incorrectly</li>
                  <li>The document was generated before the verification system was enabled</li>
                  <li>The grades have been updated since this document was generated</li>
                  <li>The document is a counterfeit or has been tampered with</li>
                </ul>
              </div>
            </div>
            <details className="group mb-6">
              <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-600 select-none">
                Technical details
              </summary>
              <div className="mt-2 bg-slate-50 border border-slate-200 rounded-lg p-3 text-left">
                <div className="text-xs text-slate-600 space-y-1 font-mono break-all">
                  <p><span className="text-slate-400">Hash:</span> {hash}</p>
                  <p>
                    <span className="text-slate-400">Status:</span>{" "}
                    <span className="text-red-600 font-semibold">Not found</span>
                  </p>
                </div>
              </div>
            </details>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href={dashboardUrl}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-700 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition-colors"
              >
                {isLoggedIn ? (
                  <><LayoutDashboardIcon className="w-4 h-4" /> Dashboard</>
                ) : (
                  <><LogInIcon className="w-4 h-4" /> Sign In</>
                )}
              </Link>
            </div>
          </div>
        </div>
        <p className="text-center text-xs text-slate-400 mt-6">
          Cavite State University - Bacoor Campus &bull; Office of the Campus Registrar
        </p>
      </div>
    </div>
  );
}

function RevokedBanner({ record, dashboardUrl }: { record: any; dashboardUrl: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-red-300 overflow-hidden mb-6">
      <div className="h-2 bg-gradient-to-r from-red-500 to-red-400" />
      <div className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center shrink-0">
            <ShieldBanIcon className="w-7 h-7 text-red-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-red-800">✗ Verification Revoked</h2>
            <p className="text-sm text-red-700 mt-0.5">
              This Certificate of Grades has been revoked by the registrar or registrar staff. The grades on this
              document are no longer considered valid.
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-x-6 gap-y-2 text-xs text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <BanIcon className="w-3.5 h-3.5 text-red-500" />
            Revoked — do not accept
          </span>
          <span className="inline-flex items-center gap-1.5">
            <RefreshCwIcon className="w-3.5 h-3.5 text-slate-400" />
            Ask the student to request a new COG
          </span>
        </div>
      </div>
    </div>
  );
}

function ExpiredBanner({ record, dashboardUrl }: { record: any; dashboardUrl: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden mb-6">
      <div className="h-2 bg-gradient-to-r from-orange-500 to-orange-400" />
      <div className="p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
          <div className="w-14 h-14 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
            <ClockIcon className="w-7 h-7 text-orange-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-orange-800">⚠ Verification Expired</h2>
            <p className="text-sm text-orange-700 mt-0.5">
              This Certificate of Grades expired on{" "}
              {record.expiresAt ? formatDate(record.expiresAt) : "the cutoff date"}. It is no longer
              valid for verification purposes.
            </p>
          </div>
        </div>
        <div className="mt-4 text-xs text-orange-600">
          The student must request a new Certificate of Grades from the Office of the Campus Registrar.
        </div>
      </div>
    </div>
  );
}

function getDashboardUrl(sessionClaims: any): string {
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  if (role && ["admin", "student", "faculty", "registrar", "registrar_staff", "superuser", "csg"].includes(role)) {
    return `/${role}`;
  }
  return "/sign-in";
}

function isExpired(record: any): boolean {
  if (record.expiresAt) {
    return new Date() > new Date(record.expiresAt);
  }
  // Fallback for records without expiresAt: 1 year from generatedAt
  const defaultExpiry = new Date(record.generatedAt);
  defaultExpiry.setFullYear(defaultExpiry.getFullYear() + 1);
  return new Date() > defaultExpiry;
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ hash: string }>;
}) {
  const { hash } = await params;

  // ── Auth & Role Check ───────────────────────────────────────────
  let dashboardUrl = "/sign-in";
  let userRole: string | undefined;
  let userId: string | undefined;
  try {
    const session = await auth();
    if (session?.sessionClaims) {
      userId = session.userId;
      userRole = (session.sessionClaims?.metadata as { role?: string })?.role;
      dashboardUrl = getDashboardUrl(session.sessionClaims);
    }
  } catch {
    // Not authenticated — middleware will redirect
  }

  const allowedRoles = ["admin", "registrar", "registrar_staff", "faculty", "superuser"];
  if (!userRole || !allowedRoles.includes(userRole)) {
    return <AccessDenied isLoggedIn={!!userRole} dashboardUrl={dashboardUrl} role={userRole} />;
  }

  // ── Rate Limiting ───────────────────────────────────────────────
  try {
    await checkRateLimit({ action: "verify_cog", limit: 30, windowSeconds: 60 });
  } catch {
    return <RateLimitedPage />;
  }

  // ── Fetch Record ────────────────────────────────────────────────
  const record = await getVerification(hash);
  if (!record) {
    return <NotFoundFallback hash={hash} dashboardUrl={dashboardUrl} />;
  }

  // ── Status Checks ───────────────────────────────────────────────
  const expired = isExpired(record);
  const revoked = record.isRevoked;

  const grades: GradeRow[] = JSON.parse(record.grades);
  const totalUnitsEnrolled = grades.reduce((acc, g) => {
    if (["DRP", "INC", "FAILED", "4.00", "5.00", "US"].includes(String(g.grade))) return acc;
    return acc + g.creditUnit;
  }, 0);
  const totalCreditsEarned = record.totalCreditsEarned ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <UniversityHeader />

        {/* ── REVOKED BANNER ── */}
        {revoked && <RevokedBanner record={record} dashboardUrl={dashboardUrl} />}

        {/* ── EXPIRED BANNER ── */}
        {!revoked && expired && <ExpiredBanner record={record} dashboardUrl={dashboardUrl} />}

        {/* ── VERIFICATION BADGE ── */}
        {!revoked && !expired && (
          <div className="bg-white rounded-xl shadow-sm border border-green-200 overflow-hidden mb-6">
            <div className="h-2 bg-gradient-to-r from-green-500 to-emerald-400" />
            <div className="p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle2Icon className="w-7 h-7 text-green-600" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold text-green-800">✓ Document Verified</h2>
                  <p className="text-sm text-green-700 mt-0.5">
                    This Certificate of Grades matches the official records of Cavite State
                    University - Bacoor Campus.
                  </p>
                </div>
                {/* Revoke button for authorized users */}
                <div className="shrink-0 self-start">
                  <RevokeForm hash={hash} />
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-center sm:justify-start gap-x-6 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheckIcon className="w-3.5 h-3.5 text-green-500" />
                  Verified on {formatDate(record.generatedAt)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <ClockIcon className="w-3.5 h-3.5 text-slate-400" />
                  Expires on{" "}
                  {record.expiresAt
                    ? formatDate(record.expiresAt)
                    : "1 year from issuance"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <HashIcon className="w-3.5 h-3.5 text-slate-400" />
                  Hash:{" "}
                  <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                    {record.hash.substring(0, 12)}...
                  </code>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── ALERT BADGE (still show info even if revoked/expired) ── */}
        {(revoked || expired) && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
            <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
              <span className="text-xs text-slate-500">
                This record is shown for reference only. The document is{" "}
                {revoked ? "revoked" : "expired"}.
              </span>
            </div>
            <div className="p-6 sm:p-8">
              <div className="flex flex-wrap justify-start gap-x-6 gap-y-2 text-xs text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <ClockIcon className="w-3.5 h-3.5" />
                  Generated on {formatDate(record.generatedAt)}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <HashIcon className="w-3.5 h-3.5" />
                  Hash:{" "}
                  <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                    {record.hash.substring(0, 12)}...
                  </code>
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── STUDENT INFORMATION ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
                Student Information
              </h3>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-5">
              <InfoRow label="Full Name" value={record.studentName} />
              <InfoRow label="Student Number" value={record.studentNumber} />
              <InfoRow label="Course" value={courseMap(record.course) || record.course} />
              <InfoRow label="Major" value={formatMajor(record.major)} />
              <InfoRow label="Year Level" value={record.yearLevel} />
              <InfoRow
                label="Academic Term"
                value={`${semesterLabel(record.semester)} ${record.academicYear.replace(/_/g, "-")}`}
              />
              <InfoRow
                label="Academic Performance"
                value={
                  <span>
                    GPA: <span className="text-green-700 font-bold">{record.gpa}</span>
                  </span>
                }
              />
              <InfoRow label="Purpose" value={record.purpose} />
            </div>
          </div>
        </div>

        {/* ── GRADE RECORD TABLE ── */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-slate-100 bg-slate-50">
            <div className="flex items-center gap-2 mb-1">
              <BookOpenIcon className="w-4 h-4 text-slate-500" />
              <h3 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">
                Grade Record
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              {record.totalSubjects} subject{record.totalSubjects !== 1 ? "s" : ""} &bull;{" "}
              {totalUnitsEnrolled} total unit{totalUnitsEnrolled !== 1 ? "s" : ""} &bull; GPA:{" "}
              {record.gpa}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-100">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Course Title</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Units</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Grade</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Re-Exam</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Remarks</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Instructor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {grades.map((g, i) => {
                  const isFailing = ["FAILED", "CON. FAILURE", "LACK OF REQ", "DROPPED"].includes(g.remarks);
                  const isLowGrade = ["DRP", "INC", "4.00", "5.00", "US"].includes(g.grade);
                  return (
                    <tr
                      key={i}
                      className={`transition-colors ${
                        isFailing || isLowGrade ? "bg-red-50 hover:bg-red-100" : "hover:bg-slate-50"
                      }`}
                    >
                      <td className="px-4 py-3 font-mono text-xs text-slate-800">{g.courseCode}</td>
                      <td className="px-4 py-3 text-sm text-slate-800">{g.courseTitle}</td>
                      <td className="px-4 py-3 text-center text-sm text-slate-700">
                        {isLowGrade ? <span className="text-red-500 font-medium">0</span> : g.creditUnit}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded text-sm font-bold ${
                            isLowGrade ? "bg-red-100 text-red-700" : "bg-slate-100 text-slate-800"
                          }`}
                        >
                          {g.grade || "-"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-slate-600">
                        {g.reExam || <span className="text-slate-300">&mdash;</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-sm font-medium ${
                            isFailing ? "text-red-600" : g.remarks ? "text-green-700" : "text-slate-400"
                          }`}
                        >
                          {g.remarks || <span className="text-slate-300">&mdash;</span>}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-[160px] truncate" title={g.instructor}>
                        {g.instructor || <span className="text-slate-300">&mdash;</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50">
            <div className="flex flex-wrap gap-x-8 gap-y-1 text-xs text-slate-600">
              <span><span className="text-slate-400">Subjects:</span> {record.totalSubjects}</span>
              <span><span className="text-slate-400">Units Enrolled:</span> {totalUnitsEnrolled}</span>
              <span>
                <span className="text-slate-400">Credits Earned:</span> {totalCreditsEarned.toFixed(2)}
              </span>
              <span>
                <span className="text-slate-400">GPA:</span>{" "}
                <span className="font-bold text-green-700">{record.gpa}</span>
              </span>
              {record.expiresAt && (
                <span>
                  <span className="text-slate-400">Expires:</span>{" "}
                  <span className={expired ? "text-red-600 font-semibold" : ""}>
                    {formatDate(record.expiresAt)}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ── FOOTER ── */}
        <div className="text-center space-y-1 pb-8">
          <p className="text-xs text-slate-400">
            Cavite State University - Bacoor Campus &bull; Office of the Campus Registrar
          </p>
          <p className="text-xs text-slate-400">Verification generated on {formatDate(record.generatedAt)}</p>
          <div className="mt-4">
            <Link
              href={dashboardUrl}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {dashboardUrl !== "/sign-in" ? (
                <><LayoutDashboardIcon className="w-3.5 h-3.5" /> Go to Dashboard</>
              ) : (
                <><LogInIcon className="w-3.5 h-3.5" /> Sign In to Portal</>
              )}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
