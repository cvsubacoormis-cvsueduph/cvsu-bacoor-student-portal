"use client";

import CreateAdminForm from "@/components/forms/create-adminform";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import Image from "next/image";
import React from "react";

export default function CreateAdmin() {
  return (
    <>
      <SignedIn>
        <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
          <div className="flex items-center justify-between">
            <h1 className="hidden md:block text-lg font-semibold">
              Create a New Administrator
            </h1>
            {/* <div className="flex flex-col md:flex-row items-center gap-4 w-full md:w-auto">
          <div className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
            <button>
              <Image src="/filter.png" alt="" width={14} height={14} />
            </button>
          </div>
          <button className="w-8 h-8 flex items-center justify-center rounded-full bg-lamaYellow">
            <Image src="/sort.png" alt="" width={14} height={14} />
          </button>
        </div> */}
          </div>
          <CreateAdminForm />
        </div>
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
