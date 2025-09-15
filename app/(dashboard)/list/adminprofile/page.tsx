"use client";

import AdminProfileComp from "@/components/AdminProfile";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";

export default function AdminProfile() {
  return (
    <>
      <SignedIn>
        <div>
          <AdminProfileComp />
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
