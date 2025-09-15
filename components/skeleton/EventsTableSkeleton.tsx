"use client";

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export default function EventsTableSkeleton({ role }: { role?: string }) {
  return (
    <div className="mt-4">
      <Table className="w-full">
        <TableCaption>Loading events...</TableCaption>
        <TableHeader>
          <TableRow className="text-left text-gray-500 text-sm">
            <TableHead className="text-left">Title</TableHead>
            <TableHead className="text-center">Description</TableHead>
            <TableHead className="text-center">Start Time</TableHead>
            <TableHead className="text-center">End Time</TableHead>
            {role === "admin" && (
              <TableHead className="text-center">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-24" />
              </TableCell>
              <TableCell className="text-center">
                <Skeleton className="h-4 w-40 mx-auto" />
              </TableCell>
              <TableCell className="text-center">
                <Skeleton className="h-4 w-28 mx-auto" />
              </TableCell>
              <TableCell className="text-center">
                <Skeleton className="h-4 w-28 mx-auto" />
              </TableCell>
              {role === "admin" && (
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-2">
                    <Skeleton className="h-8 w-8 rounded" />
                    <Skeleton className="h-8 w-8 rounded" />
                  </div>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
