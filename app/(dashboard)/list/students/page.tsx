"use client";

import { Suspense, useState } from "react";
import { RedirectToSignIn, SignedIn, SignedOut, useUser } from "@clerk/nextjs";

import StudentsTable from "@/components/StudentsTable";
import UploadStudents from "@/components/students/upload-students";
import SearchStudent from "@/components/students/search-students";
import BulkDeleteStudent from "@/components/BulkDeleteStudent";
import { Button } from "@/components/ui/button";
import { PlusCircleIcon } from "lucide-react";
import Link from "next/link";
import { HashLoader } from "react-spinners";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { allCourses } from "@/lib/utils";

export default function StudentLists() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string;
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [courseFilter, setCourseFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  return (
    <>
      <SignedIn>
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h1 className="hidden md:block text-lg font-semibold">
              All Students
              <span className=" flex text-xs text-gray-500">
                Lists of students
              </span>
            </h1>
            <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
              <SearchStudent
                query={searchQuery}
                setSearchQuery={setSearchQuery}
              />

              {/* Filters */}
              <div className="flex gap-2 w-full md:w-auto">
                <Select value={courseFilter} onValueChange={setCourseFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Course" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Courses</SelectItem>
                    {allCourses.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px]">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All Status</SelectItem>
                    <SelectItem value="REGULAR">Regular</SelectItem>
                    <SelectItem value="IRREGULAR">Irregular</SelectItem>
                    <SelectItem value="TRANSFEREE">Transferee</SelectItem>
                    <SelectItem value="RETURNEE">Returnee</SelectItem>
                    <SelectItem value="NOT_ANNOUNCED">Not Announced</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-2 md:gap-4 self-end">
                {(role === "admin" || role === "superuser") && (
                  <>
                    <Link href="/list/students/create">
                      <Button className="bg-blue-700 hover:bg-blue-900 w-full md:w-auto">
                        <PlusCircleIcon className="mr-2 h-4 w-4" />
                        Create Student
                      </Button>
                    </Link>
                    <UploadStudents />
                    <BulkDeleteStudent />
                  </>
                )}
              </div>
            </div>
          </div>
          <Suspense fallback={<HashLoader />}>
            <StudentsTable
              query={searchQuery}
              page={page}
              setPage={setPage}
              course={courseFilter}
              status={statusFilter}
            />
          </Suspense>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
