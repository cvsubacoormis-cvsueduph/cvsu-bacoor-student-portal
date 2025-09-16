// app/(dashboard)/approval/loading.tsx
"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function loading() {
  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <h1 className="hidden md:block text-lg font-semibold">
        Pending Approval Lists
      </h1>
      <span className="text-xs flex text-gray-500 font-semibold">
        List of pending approvals
      </span>

      <div className="mt-4 space-y-3">
        {/* Skeleton Header */}
        <div className="flex space-x-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-8 w-24 ml-auto" />
        </div>

        {/* Skeleton Table */}
        <div className="rounded-md border">
          <div className="grid grid-cols-6 gap-2 border-b p-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
          <div className="divide-y">
            {[...Array(5)].map((_, rowIndex) => (
              <div
                key={rowIndex}
                className="grid grid-cols-6 gap-2 p-2 items-center"
              >
                {[...Array(6)].map((_, colIndex) => (
                  <Skeleton key={colIndex} className="h-6 w-full" />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
