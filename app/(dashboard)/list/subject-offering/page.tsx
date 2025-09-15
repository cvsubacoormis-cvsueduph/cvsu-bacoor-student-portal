import SeedingSubjectOffering from "@/components/SeedingSubjectOffering";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import React from "react";

export default function SubjectOffering() {
  return (
    <>
      <SignedIn>
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
          <h1 className="hidden md:block text-lg font-semibold">
            Seed a Subject Offering{" "}
            <span className=" flex text-xs text-gray-500 mb-2">
              Seed a Subject Offering in a specific Academic Year and Semester
            </span>
          </h1>
          <div className="flex items-center justify-between">
            <SeedingSubjectOffering />
          </div>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
