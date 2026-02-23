
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ManualGradeEntry from "@/components/ManualGradeEntry";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { Suspense } from "react";
import UploadGradesSkeleton from "@/components/skeleton/UploadGradesSkeleton";
import ManualGradeEntrySkeleton from "@/components/skeleton/ManualGradeEntrySkeleton";
import { UploadGrades } from "@/components/UploadGrades";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { getSetting } from "@/actions/settings";
import { currentUser } from "@clerk/nextjs/server";
import { AlertCircle } from "lucide-react";
import AdminUploadToggle from "./AdminUploadToggle";

export default async function GradeUploader() {
  const user = await currentUser();
  const role = user?.publicMetadata?.role as string | undefined;
  const isAdmin = role === "admin" || role === "superuser";
  const settingValue = await getSetting("UPLOAD_GRADES_ENABLED");
  const isUploadEnabled = settingValue !== "false";

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
            {isAdmin && (
              <AdminUploadToggle initialEnabled={isUploadEnabled} />
            )}
          </div>

          {!isUploadEnabled && !isAdmin ? (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 flex flex-col md:flex-row gap-4 items-center justify-center my-6">
              <AlertCircle className="h-8 w-8 text-yellow-500 shrink-0" />
              <div>
                <h3 className="text-lg font-semibold text-yellow-800 text-center md:text-left">
                  Upload System Disabled
                </h3>
                <p className="text-sm text-yellow-700 text-center md:text-left">
                  You cannot upload grades right now because the deadline has exceeded or the system has been locked by an administrator. Please contact the registrar for assistance.
                </p>
              </div>
            </div>
          ) : (
            <Tabs defaultValue="upload" className="w-full mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">Excel Upload</TabsTrigger>
                <TabsTrigger value="manual">Manual Entry</TabsTrigger>
              </TabsList>
              <TabsContent value="upload" className="mt-6">
                <Suspense fallback={<UploadGradesSkeleton />}>
                  <UploadGrades />
                </Suspense>
              </TabsContent>
              <TabsContent value="manual" className="mt-6">
                <Suspense fallback={<ManualGradeEntrySkeleton />}>
                  <ManualGradeEntry />
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
