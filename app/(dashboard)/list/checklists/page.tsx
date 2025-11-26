import { CurriculumChecklist } from "@/components/ChecklistsTable";
import { CurriculumChecklistSkeleton } from "@/components/skeleton/CurriculumChecklistSkeleton";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { Suspense } from "react";

export default function CheckListsPage() {
  return (
    <>
      <SignedIn>
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0 h-full">
          {/* TOP */}
          <div className="flex items-center justify-between">
            <h1 className="hidden md:block text-lg font-semibold">
              Curriculum Checklist{" "}
              <span className=" flex text-xs text-gray-500 mb-2">
                Lists of Checklists
              </span>
            </h1>
          </div>
          <Suspense
            fallback={
              <>
                <CurriculumChecklistSkeleton />
              </>
            }
          >
            <CurriculumChecklist />
          </Suspense>
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
