"use client";
import { StudentCardSkeleton } from "@/components/skeleton/StudentCardSkeleton";
import { StudentProfileSkeleton } from "@/components/skeleton/StudentProfileSkeleton";
import React from "react";

export default function loading() {
  return (
    <main className="min-h-[100dvh] w-full py-6 md:py-10">
      <div className="px-4 md:px-8">
        <StudentProfileSkeleton />
      </div>
    </main>
  );
}
