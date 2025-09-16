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

export default function CountChartSkeleton() {
  return (
    <div className="w-full">
      <Card className="flex flex-col">
        <CardHeader className="pb-0 space-y-2">
          <Shimmer className="h-4 w-1/3" />
          <Shimmer className="h-3 w-2/5" />
        </CardHeader>

        <CardContent className="flex flex-col items-center justify-center py-12">
          <Shimmer className="h-40 w-40 rounded-full" />

          <div className="flex items-center justify-center gap-6 mt-6">
            <div className="flex items-center gap-2">
              <Shimmer className="h-3 w-3 rounded-full" />
              <Shimmer className="h-3 w-12" />
            </div>
            <div className="flex items-center gap-2">
              <Shimmer className="h-3 w-3 rounded-full" />
              <Shimmer className="h-3 w-12" />
            </div>
          </div>
        </CardContent>

        <CardFooter className="flex-col gap-2">
          <Shimmer className="h-3 w-3/4" />
          <Shimmer className="h-3 w-2/5" />
        </CardFooter>
      </Card>
    </div>
  );
}
