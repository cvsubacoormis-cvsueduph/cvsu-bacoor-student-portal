"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function CurriculumChecklistSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex gap-2">
          <Skeleton className="h-10 w-40" /> {/* Year Select */}
          <Skeleton className="h-10 w-40" /> {/* Generate PDF button */}
        </div>
      </div>

      {/* Progress Summary Skeleton */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Skeleton className="h-5 w-5 rounded-full" /> {/* Icon */}
            <Skeleton className="h-5 w-48" /> {/* Title */}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div
                key={i}
                className="text-center p-4 bg-gray-50 rounded-lg flex flex-col items-center"
              >
                <Skeleton className="h-6 w-12 mb-2" /> {/* Number */}
                <Skeleton className="h-4 w-24" /> {/* Label */}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Year Level + Semester Skeleton */}
      {[...Array(2)].map((_, yearIdx) => (
        <Card key={yearIdx}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Skeleton className="h-5 w-5 rounded-full" />
              <Skeleton className="h-5 w-32" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            {[...Array(2)].map((_, semIdx) => (
              <div key={semIdx} className="mb-6">
                <Skeleton className="h-4 w-32 mb-3" /> {/* Semester Title */}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr>
                        {[...Array(8)].map((_, i) => (
                          <th key={i} className="py-2 px-2">
                            <Skeleton className="h-4 w-16" />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...Array(3)].map((_, rowIdx) => (
                        <tr key={rowIdx} className="border-b border-gray-100">
                          {[...Array(8)].map((_, cellIdx) => (
                            <td key={cellIdx} className="py-2 px-2">
                              <Skeleton className="h-4 w-20" />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Legend Skeleton */}
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-5 w-24 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <Skeleton className="h-4 w-4 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
