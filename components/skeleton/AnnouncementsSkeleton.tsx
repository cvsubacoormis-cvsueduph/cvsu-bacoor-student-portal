"use client";

import React from "react";

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded-md bg-muted animate-pulse ${className}`} />;
}

export function AnnouncementsSkeleton() {
  return (
    <div className="bg-white p-4 rounded-md">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" /> {/* "Announcements" title */}
        <Skeleton className="h-5 w-5 rounded-full" /> {/* Ellipsis icon */}
      </div>

      {/* List items */}
      <div className="flex flex-col gap-4 mt-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="bg-gray-100 rounded-md p-4 shadow-sm flex flex-col gap-2"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-28" /> {/* Title */}
              <Skeleton className="h-4 w-16" /> {/* Date */}
            </div>
            <Skeleton className="h-4 w-full" /> {/* Description line */}
            <Skeleton className="h-4 w-3/4" /> {/* Description line */}
          </div>
        ))}
      </div>
    </div>
  );
}
