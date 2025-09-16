"use client";

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

function Shimmer({ className }: { className?: string }) {
  return (
    <Skeleton className={`relative overflow-hidden ${className}`}>
      <span
        className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] 
        bg-gradient-to-r from-transparent via-white/40 to-transparent"
      />
    </Skeleton>
  );
}

export default function AttendanceChartSkeleton() {
  return (
    <div className="w-full">
      <Card>
        <CardHeader className="space-y-2">
          <Shimmer className="h-4 w-1/4" /> {/* Title */}
          <Shimmer className="h-3 w-2/5" /> {/* Description */}
        </CardHeader>

        <CardContent className="pt-6">
          {/* Fake bar chart with 7 bars */}
          <div className="flex items-end justify-between gap-2 h-48">
            {Array.from({ length: 7 }).map((_, i) => (
              <Shimmer
                key={i}
                className={`w-8 rounded-md ${i % 2 === 0 ? "h-20" : "h-32"}`}
              />
            ))}
          </div>
        </CardContent>

        <CardFooter className="flex-col items-start gap-2">
          <Shimmer className="h-3 w-3/4" />
          <Shimmer className="h-3 w-1/2" />
        </CardFooter>
      </Card>
    </div>
  );
}
