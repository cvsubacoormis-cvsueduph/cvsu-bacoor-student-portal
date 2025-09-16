import { Skeleton } from "../ui/skeleton";

export function CurriculumSkeleton() {
  return (
    <div className="space-y-6">
      {/* Top bar with search + button */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between">
        <Skeleton className="h-10 w-full sm:w-64" />
        <Skeleton className="h-10 w-40" />
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 border rounded-lg space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="border rounded-lg overflow-hidden">
        {/* Header row */}
        <div className="grid grid-cols-9 gap-2 px-4 py-2 bg-muted">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full" />
          ))}
        </div>
        {/* Body rows */}
        {Array.from({ length: 5 }).map((_, row) => (
          <div key={row} className="grid grid-cols-9 gap-2 px-4 py-4 border-t">
            {Array.from({ length: 9 }).map((_, col) => (
              <Skeleton key={col} className="h-4 w-full" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
