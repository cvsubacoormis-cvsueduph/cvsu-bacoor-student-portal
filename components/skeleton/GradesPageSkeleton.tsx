"use client";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function GradesPageSkeleton() {
  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0 min-h-screen">
      {/* Title */}
      <Skeleton className="h-6 w-40 mb-6" />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Skeleton className="h-10 w-[180px]" /> {/* Year Select */}
        <Skeleton className="h-10 w-[180px]" /> {/* Semester Select */}
        <Skeleton className="h-10 w-20" /> {/* Filter Button */}
        <Skeleton className="h-10 w-28" /> {/* Generate COG */}
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {[...Array(7)].map((_, i) => (
                <TableHead key={i}>
                  <Skeleton className="h-4 w-20 mx-auto" />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, rowIdx) => (
              <TableRow key={rowIdx}>
                {[...Array(7)].map((_, colIdx) => (
                  <TableCell key={colIdx} className="text-center">
                    <Skeleton className="h-4 w-24 mx-auto" />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Totals Row Skeleton */}
      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="flex flex-col items-center">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-6 w-20 mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}
