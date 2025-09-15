"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded-md bg-muted animate-pulse ${className}`} />;
}

export function StudentCardSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-1 lg:grid-cols-1">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">
            <Skeleton className="h-4 w-28" /> {/* "Weather & Time" */}
          </CardTitle>
          <Skeleton className="h-8 w-8 rounded-full" /> {/* Weather Icon */}
        </CardHeader>
        <CardContent>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-2xl font-bold">
                <Skeleton className="h-6 w-14" /> {/* Temperature */}
              </div>
              <Skeleton className="h-4 w-24 text-xs text-muted-foreground" />{" "}
              {/* Description */}
            </div>
            <div className="text-right">
              <Skeleton className="h-5 w-16 ml-auto text-xl font-medium" />{" "}
              {/* Time */}
              <Skeleton className="h-4 w-20 ml-auto text-xs text-muted-foreground" />{" "}
              {/* Day */}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
