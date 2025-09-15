import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "../ui/card";

export function StudentProfileSkeleton() {
  return (
    <Card className="overflow-hidden border-0 shadow-sm">
      <CardHeader className="pb-4 sm:pb-5 md:pb-6">
        <div className="flex items-start gap-3 sm:gap-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="space-y-2 w-full">
            <Skeleton className="h-6 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <div className="rounded-lg border p-4 sm:p-5 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="rounded-lg border p-4 sm:p-5 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-lg border p-4 sm:p-5 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
