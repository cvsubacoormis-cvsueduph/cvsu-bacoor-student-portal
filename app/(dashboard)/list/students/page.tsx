"use client";

import { Suspense, useState } from "react";
import { RedirectToSignIn, SignedIn, SignedOut, useUser } from "@clerk/nextjs";

import StudentsTable from "@/components/StudentsTable";
import UploadStudents from "@/components/students/upload-students";
import SearchStudent from "@/components/students/search-students";
import Spinner from "@/components/Spinner";
import BulkDeleteStudent from "@/components/BulkDeleteStudent";
import { Button } from "@/components/ui/button";
import { PlusCircleIcon } from "lucide-react";
import Link from "next/link";
import { HashLoader } from "react-spinners";

export default function StudentLists() {
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string;
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  return (
    <>
      <SignedIn>
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
          <div className="flex items-center justify-between">
            <h1 className="hidden md:block text-lg font-semibold">
              All Students
            </h1>
            <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
              <SearchStudent
                query={searchQuery}
                setSearchQuery={setSearchQuery}
              />
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
            <StudentsTable query={searchQuery} page={page} setPage={setPage} />
          </Suspense>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
