"use client";

import { useParams, useSearchParams } from "next/navigation";
import PreviewGrade from "@/components/PreviewGrade";
import CreditedSubjectsManager from "@/components/CreditedSubjectsManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, GraduationCap } from "lucide-react";

export default function StudentGradesPage() {
  const { studentNumber } = useParams<{ studentNumber: string }>();
  const searchParams = useSearchParams();

  const firstName = searchParams.get("firstName") ?? "";
  const lastName = searchParams.get("lastName") ?? "";
  const course = searchParams.get("course") ?? "";
  const major = searchParams.get("major") ?? "";

  return (
    <Tabs defaultValue="grades" className="w-full">
      <div className="bg-white px-4 pt-4">
        <TabsList>
          <TabsTrigger value="grades" className="flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            Grades
          </TabsTrigger>
          <TabsTrigger
            value="credited-subjects"
            className="flex items-center gap-2"
          >
            <GraduationCap className="h-4 w-4" />
            Credited Subjects
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="grades" className="m-0">
        <PreviewGrade
          studentNumber={studentNumber}
          firstName={firstName}
          lastName={lastName}
        />
      </TabsContent>

      <TabsContent value="credited-subjects" className="m-0">
        <div className="bg-white p-6 rounded-md flex-1 m-4 mt-0 min-h-screen">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-xl font-bold text-gray-800">
              {firstName && lastName
                ? `${firstName} ${lastName}`
                : studentNumber}
            </h1>
            <p className="text-sm text-gray-500">
              Student Number: {studentNumber}
            </p>
          </div>

          <CreditedSubjectsManager
            studentNumber={studentNumber}
            studentCourse={course}
            studentMajor={major}
          />
        </div>
      </TabsContent>
    </Tabs>
  );
}
