"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ManualGradeEntry from "@/components/ManualGradeEntry";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { Suspense } from "react";
import UploadGradesSkeleton from "@/components/skeleton/UploadGradesSkeleton";
import ManualGradeEntrySkeleton from "@/components/skeleton/ManualGradeEntrySkeleton";
import { UploadGrades } from "@/components/UploadGrades";

export default function GradeUploader() {
  return (
    <>
      <SignedIn>
        <div className="bg-white p-4 rounded-md m-4 mt-0">
          <h2 className="text-lg font-semibold">
            Upload Student Grades (.xlsx)
          </h2>
          <span className=" flex text-xs text-gray-500 font-semibold mb-2">
            Uploading of Student Grades
          </span>
          <Tabs defaultValue="upload" className="w-full">
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
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
