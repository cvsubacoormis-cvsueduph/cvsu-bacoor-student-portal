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

export default function AnnouncementsTableSkeleton({
  role,
}: {
  role?: string;
}) {
  return (
    <div className="mt-4">
      <Table className="w-full">
        <TableCaption>Loading announcements...</TableCaption>
        <TableHeader>
          <TableRow className="text-left text-gray-500 text-sm">
            <TableHead className="text-left">Title</TableHead>
            <TableHead className="text-center">Description</TableHead>
            <TableHead className="text-center">Date</TableHead>
            {(role === "admin" || role === "superuser") && (
              <TableHead className="text-center">Actions</TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="h-4 w-32" />
              </TableCell>
              <TableCell className="text-center">
                <Skeleton className="h-4 w-48 mx-auto" />
              </TableCell>
              <TableCell className="text-center">
                <Skeleton className="h-4 w-24 mx-auto" />
              </TableCell>
              {(role === "admin" || role === "superuser") && (
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
