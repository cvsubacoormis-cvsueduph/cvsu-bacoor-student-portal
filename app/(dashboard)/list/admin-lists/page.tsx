import AdminListsTable from "@/components/AdminListsTable";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import React from "react";

export default function AdminListsPage() {
  return (
    <>
      <SignedIn>
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
          {/* TOP */}
          <div className="flex items-center justify-between">
            <h1 className="hidden md:block text-lg font-semibold">
              All Administrators
              <span className=" flex text-xs text-gray-500">
                Lists of Administrators
              </span>
            </h1>
          </div>
          {/* LIST */}
          <AdminListsTable />
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
