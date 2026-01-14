import SeedingSubjectOffering from "@/components/SeedingSubjectOffering";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import React from "react";
import { CreateTermDialog } from "@/components/dialogs/CreateTermDialog";

export default function SubjectOffering() {
  return (
    <>
      <SignedIn>
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6">
            <h1 className="md:block text-lg font-semibold">
              Seed a Subject Offering{" "}
              <span className=" flex text-xs text-gray-500 font-normal mt-1">
                Seed a Subject Offering in a specific Academic Year and Semester
              </span>
            </h1>
            <div className="mt-4 md:mt-0">
              <CreateTermDialog />
            </div>
          </div>
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
