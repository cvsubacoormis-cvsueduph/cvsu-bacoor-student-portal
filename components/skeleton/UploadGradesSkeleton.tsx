"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";

export default function UploadGradesSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" /> {/* Title */}
        <Button disabled>
          <Skeleton className="h-5 w-20" /> {/* Upload button */}
        </Button>
      </div>

      {/* File Input Skeleton */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-40" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>

      {/* Preview Table Skeleton */}
      <Card>
        <CardHeader>
          <CardTitle>
            <Skeleton className="h-6 w-28" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {/* Header */}
            <div className="grid grid-cols-6 gap-2 border-b pb-2">
              {[...Array(6)].map((_, i) => (
                <Skeleton key={i} className="h-6 w-full" />
              ))}
            </div>
            {/* Rows */}
            <div className="space-y-2">
              {[...Array(5)].map((_, rowIndex) => (
                <div
                  key={rowIndex}
                  className="grid grid-cols-6 gap-2 items-center"
                >
                  {[...Array(6)].map((_, colIndex) => (
                    <Skeleton key={colIndex} className="h-6 w-full" />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
