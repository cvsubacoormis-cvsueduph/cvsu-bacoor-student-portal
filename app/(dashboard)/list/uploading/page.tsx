import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ManualGradeEntry from "@/components/ManualGradeEntry";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { Suspense } from "react";
import UploadGradesSkeleton from "@/components/skeleton/UploadGradesSkeleton";
import ManualGradeEntrySkeleton from "@/components/skeleton/ManualGradeEntrySkeleton";
import { UploadGrades } from "@/components/UploadGrades";
import {
  getSetting,
  getGradeVisibility,
  getActiveUploadTerm,
} from "@/actions/settings";
import { getAllAcademicTerms } from "@/actions/academic-terms";
import { auth } from "@clerk/nextjs/server";
import { AcademicTerm } from "@prisma/client";
import AdminUploadToggle from "@/components/AdminUploadToggle";
import GradeVisibilityToggle from "@/components/GradeVisibilityToggle";
import FacultyApprovalToggle from "@/components/FacultyApprovalToggle";
import ActiveUploadTermSelector from "@/components/ActiveUploadTermSelector";
import { UploadSystemDisabled } from "@/components/UploadSystemDisabled";

export default async function GradeUploader() {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const isAdmin = role === "admin" || role === "superuser";
  const canToggleGradeVisibility = isAdmin || role === "registrar";

  const [
    settingValue,
    isGradesVisible,
    facultyApprovalSetting,
    activeTerm,
    allTerms,
  ] = await Promise.all([
    getSetting("UPLOAD_GRADES_ENABLED"),
    getGradeVisibility(),
    getSetting("FACULTY_UPDATE_REQUIRES_APPROVAL"),
    getActiveUploadTerm(),
    getAllAcademicTerms(),
  ]);

  const isUploadEnabled = settingValue !== "false";
  const isFacultyApprovalEnabled = facultyApprovalSetting !== "false";

  const availableTerms = ((allTerms as AcademicTerm[] | undefined) || []).map(
    (t: AcademicTerm) => ({
      academicYear: t.academicYear as string,
      semester: t.semester as "FIRST" | "SECOND" | "MIDYEAR",
    }),
  );

  const currentRole:
    | "admin"
    | "superuser"
    | "registrar"
    | "registrar_staff"
    | "faculty"
    | "student" =
    role === "admin" ||
    role === "superuser" ||
    role === "registrar" ||
    role === "registrar_staff" ||
    role === "faculty" ||
    role === "student"
      ? role
      : "student";

  return (
    <div className="">
      <SignedIn>
        <div className="bg-white p-4 rounded-md m-4 mt-0">
          <h2 className="text-lg font-semibold">
            Upload Student Grades (.xlsx)
          </h2>
          <div className="flex justify-between items-start mb-2">
            <div>
              <span className="flex text-xs text-gray-500 font-semibold mb-2">
                Uploading of Student Grades
              </span>
            </div>
            <div className="flex items-center gap-3 flex-wrap justify-end">
              <ActiveUploadTermSelector
                availableTerms={availableTerms}
                currentActive={activeTerm}
                currentRole={currentRole}
              />
              {canToggleGradeVisibility && (
                <GradeVisibilityToggle initialVisible={isGradesVisible} />
              )}
              {isAdmin && (
                <AdminUploadToggle initialEnabled={isUploadEnabled} />
              )}
              {isAdmin && (
                <FacultyApprovalToggle
                  initialEnabled={isFacultyApprovalEnabled}
                />
              )}
            </div>
          </div>

          {!isUploadEnabled && !isAdmin ? (
            <UploadSystemDisabled />
          ) : (
            <Tabs defaultValue="upload" className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">Excel Upload</TabsTrigger>
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="mt-6">
                <Suspense fallback={<UploadGradesSkeleton />}>
                  <UploadGrades activeTerm={activeTerm} />
                </Suspense>
              </TabsContent>
              <TabsContent value="manual" className="mt-6">
                <Suspense fallback={<ManualGradeEntrySkeleton />}>
                  <ManualGradeEntry activeTerm={activeTerm} />
                </Suspense>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </div>
  );
}
