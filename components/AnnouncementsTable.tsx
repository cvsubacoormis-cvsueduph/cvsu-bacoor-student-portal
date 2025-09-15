"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Announcement } from "@prisma/client";
import DeleteAnnouncements from "./announcements/delete-announcements";
import UpdateAnnouncements from "./announcements/update-announcements";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { useUser } from "@clerk/nextjs";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function AnnouncementsTable() {
  const { user, isLoaded } = useUser();
  const role = isLoaded ? user?.publicMetadata?.role : undefined;

  // Pagination State
  const [page, setPage] = useState(1);
  const limit = 10; // Number of announcements per page

  const { data, error, isLoading } = useSWR(
    `/api/announcements?page=${page}&limit=${limit}`,
    fetcher
  );

  if (isLoading)
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        <p className="ml-4 text-gray-500">Loading...</p>
      </div>
    );

  if (error) {
    return (
      <div className="flex items-center justify-center h-48">
        <p className="text-red-500">Failed to load data</p>
      </div>
    );
  }

  const { announcements, totalPages, currentPage } = data || {
    announcements: [],
    totalPages: 1,
    currentPage: 1,
  };

  return (
    <div>
      {announcements.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500">No announcements available.</p>
        </div>
      ) : (
        <Table className="w-full mt-4">
          <TableCaption>A list of recent announcements.</TableCaption>
          <TableHeader>
            <TableRow className="text-left text-gray-500 text-sm">
              <TableHead className="text-left">Title</TableHead>
              <TableHead className="text-center">Description</TableHead>
              <TableHead className="text-center">Date</TableHead>
              {role === "admin" && (
                <TableHead className="text-center">Actions</TableHead>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {announcements.map((announcement: Announcement) => (
              <TableRow key={announcement.id}>
                <TableCell className="text-left">
                  {announcement.title}
                </TableCell>
                <TableCell className="text-center">
                  {announcement.description}
                </TableCell>
                <TableCell className="text-center">
                  {announcement.date}
                </TableCell>
                <TableCell className="text-right">
                  {(role === "admin" || role === "superuser") && (
                    <div className="flex items-center gap-2 justify-center">
                      <DeleteAnnouncements id={announcement.id} />
                      <UpdateAnnouncements announcement={announcement} />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Pagination Component */}
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            />
          </PaginationItem>
          {Array.from({ length: totalPages }, (_, i) => (
            <PaginationItem key={i}>
              <PaginationLink
                href="#"
                isActive={i + 1 === currentPage}
                onClick={() => setPage(i + 1)}
              >
                {i + 1}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
