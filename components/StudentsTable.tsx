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
import { Prisma } from "@prisma/client";
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import DeleteStudent from "./DeleteStudent";
import UpdateStudent from "./students/update-student";
import { useUser } from "@clerk/nextjs";
import { useEffect, useState, useCallback } from "react";
import { Skeleton } from "@/components/ui/skeleton";

type Student = Prisma.StudentGetPayload<{}>;

export default function StudentsTable({
  query,
  page,
  setPage,
  course,
  status,
}: {
  query: string;
  page: number;
  setPage: (value: number) => void;
  course?: string;
  status?: string;
}) {
  const { user } = useUser();
  const role = user?.publicMetadata?.role as string;
  const [data, setData] = useState<Student[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const refreshData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        query,
        page: page.toString(),
        limit: "10",
      });

      if (course && course !== "ALL") params.append("course", course);
      if (status && status !== "ALL") params.append("status", status);

      const res = await fetch(`/api/students/get-student?${params.toString()}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });
      const { data, totalPages, currentPage } = await res.json();
      setData(data);
      setTotalPages(totalPages);
      setCurrentPage(currentPage);
    } catch (error) {
      console.error("Failed to fetch students:", error);
    } finally {
      setIsLoading(false);
    }
  }, [page, query, course, status]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return (
    <div>
      <Table className="w-full mt-4">
        <TableCaption>A list of your recent students.</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead className="text-left">Name</TableHead>
            <TableHead className="hidden sm:table-cell text-center">
              Student Number
            </TableHead>
            <TableHead className="hidden md:table-cell text-center">
              Course
            </TableHead>
            <TableHead className="hidden md:table-cell text-center">
              Status
            </TableHead>
            <TableHead className="hidden lg:table-cell text-center">
              Phone
            </TableHead>
            <TableHead className="hidden lg:table-cell text-center">
              Address
            </TableHead>
            <TableHead>Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading ? (
            Array.from({ length: 10 }).map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-3 w-[100px] sm:hidden" />
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-center">
                  <Skeleton className="h-4 w-[100px] mx-auto" />
                </TableCell>
                <TableCell className="hidden md:table-cell text-center">
                  <Skeleton className="h-4 w-[80px] mx-auto" />
                </TableCell>
                <TableCell className="hidden md:table-cell text-center">
                  <Skeleton className="h-4 w-[80px] mx-auto" />
                </TableCell>
                <TableCell className="hidden lg:table-cell text-center">
                  <Skeleton className="h-4 w-[120px] mx-auto" />
                </TableCell>
                <TableCell className="hidden lg:table-cell text-center">
                  <Skeleton className="h-4 w-[200px] mx-auto" />
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-8 w-8 rounded-full" />
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            data.map((student, index) => (
              <TableRow key={student.id}>
                <TableCell>
                  {student.firstName} {student.lastName}
                  <div className="sm:hidden text-xs text-gray-500">
                    {student.studentNumber}
                  </div>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-center">
                  {student.studentNumber}
                </TableCell>
                <TableCell className="hidden md:table-cell text-center">
                  {student.course}
                </TableCell>
                <TableCell className="hidden md:table-cell text-center">
                  {student.status}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-center">
                  {student.phone}
                </TableCell>
                <TableCell className="hidden lg:table-cell text-center">
                  {student.address}
                </TableCell>
                <TableCell className="text-right">
                  {(role === "admin" || role === "superuser") && (
                    <div className="flex items-center gap-2">
                      <DeleteStudent id={student.id} />
                      <UpdateStudent
                        student={{
                          ...student,
                          username: student.username,
                          id: student.id,
                          studentNumber: student.studentNumber,
                          firstName: student.firstName,
                          lastName: student.lastName,
                          middleInit: student.middleInit || undefined,
                          email: student.email || undefined,
                          phone: student.phone || undefined,
                          address: student.address,
                          sex: student.sex,
                          course: student.course,
                          major: student.major || undefined,
                          status: student.status,
                        }}
                      />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <Pagination className="cursor-pointer">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => {
                setPage(Math.max(currentPage - 1, 1));
              }}
            />
          </PaginationItem>

          {Array.from({ length: totalPages }, (_, index) => {
            // Show first page, last page, and pages around current page
            if (
              index === 0 || // First page
              index === totalPages - 1 || // Last page
              (index >= currentPage - 2 && index <= currentPage) || // 2 pages before current
              (index >= currentPage && index <= currentPage + 1) // 1 page after current
            ) {
              return (
                <PaginationItem key={index + 1}>
                  <PaginationLink
                    onClick={() => {
                      setPage(index + 1);
                    }}
                    className={currentPage === index + 1 ? "font-bold" : ""}
                  >
                    {index + 1}
                  </PaginationLink>
                </PaginationItem>
              );
            } else if (
              index === 1 || // Show ellipsis after first page
              index === totalPages - 2 // Show ellipsis before last page
            ) {
              return (
                <PaginationItem key={index + 1}>
                  <PaginationEllipsis />
                </PaginationItem>
              );
            }
            return null;
          })}

          <PaginationItem>
            <PaginationNext
              onClick={() => {
                setPage(Math.min(currentPage + 1, totalPages));
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
