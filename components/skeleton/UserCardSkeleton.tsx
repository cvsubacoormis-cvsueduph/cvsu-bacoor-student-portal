"use client";

import { Skeleton } from "@/components/ui/skeleton";

export default function UserCardSkeleton() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4 flex-1 min-w-[130px]">
      <div className="flex justify-between items-center">
        <Skeleton className="h-4 w-20 rounded-full" />
      </div>
      <div className="my-4 space-y-3">
        <Skeleton className="h-8 w-16 rounded" />
        <Skeleton className="h-4 w-24 rounded" />
      </div>
    </div>
  );
}
