"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SeedingSubjectOfferingSkeleton() {
  return (
    <div className="container mx-auto p-4 animate-pulse">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left Config Panel */}
        <div className="space-y-6">
          {/* Subject Offering Seed Configuration */}
          <Card>
            <CardHeader>
              <CardTitle>
                <Skeleton className="h-6 w-64" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </CardContent>
          </Card>

          {/* Course & Major Configuration */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-2">
                    <Skeleton className="h-5 w-5 rounded" />
                    <Skeleton className="h-5 w-24" />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Manual Overrides */}
          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-40" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full rounded-md" />
            </CardContent>
          </Card>

          {/* Button */}
          <Skeleton className="h-12 w-full rounded-md" />
        </div>

        {/* Right Logs Panel */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-start space-x-2 p-2 rounded-md border"
                  >
                    <Skeleton className="h-4 w-4 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
