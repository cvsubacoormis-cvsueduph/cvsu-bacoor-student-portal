"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export function NewsAndUpdatesSkeleton() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg">News & Updates</CardTitle>
          <CardDescription>
            Latest news and updates from university
          </CardDescription>
        </div>
        <Skeleton className="h-8 w-8 rounded-md" />
      </CardHeader>
      <CardContent>
        <div className="space-y-8">
          {[...Array(2)].map((_, i) => (
            <div
              key={i}
              className="rounded-lg border p-4 space-y-3 animate-pulse"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Skeleton className="h-5 w-20 rounded-md" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                  <Skeleton className="h-6 w-48" />
                </div>
                <div className="flex space-x-2">
                  <Skeleton className="h-8 w-8 rounded-md" />
                  <Skeleton className="h-8 w-8 rounded-md" />
                </div>
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex items-center justify-between pt-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between pt-4 animate-pulse">
            <Skeleton className="h-4 w-32" />
            <div className="flex items-center space-x-2">
              <Skeleton className="h-8 w-8 rounded-md" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn("rounded-md bg-muted animate-pulse", className)} />;
}
