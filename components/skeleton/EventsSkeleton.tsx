"use client";

import { Skeleton } from "@/components/ui/skeleton";

export function EventsSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="p-5 rounded-md border-2 border-gray-100 border-t-4"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-32" /> {/* Title */}
            <Skeleton className="h-4 w-20" /> {/* Time */}
          </div>
          <Skeleton className="h-3 w-full mt-2" /> {/* Description */}
        </div>
      ))}
    </div>
  );
}
