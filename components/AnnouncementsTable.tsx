"use client";

import { useState } from "react";
import useSWR from "swr";
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
import AnnouncementsTableSkeleton from "./skeleton/AnnouncementsTableSkeleton";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, MapPin } from "lucide-react";

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

  if (isLoading) return <AnnouncementsTableSkeleton />;

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
    <div className="space-y-6">
      {announcements.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg bg-gray-50">
          <p className="text-gray-500 text-lg font-medium">No announcements found</p>
          <p className="text-sm text-gray-400">Check back later for updates.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {announcements.map((announcement: Announcement) => (
            <Card key={announcement.id} className="flex flex-col h-full hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-4">
                  <div className="space-y-1">
                    <CardTitle className="line-clamp-2 text-lg font-bold leading-tight text-blue-900">
                      {announcement.title}
                    </CardTitle>
                    <div className="flex items-center text-xs text-muted-foreground gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {announcement.dateFrom ? format(new Date(announcement.dateFrom), "MMM d, yyyy") : "No Date"}
                      {announcement.dateTo && ` - ${format(new Date(announcement.dateTo), "MMM d, yyyy")}`}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                <p className="text-sm text-gray-600 line-clamp-4 leading-relaxed">
                  {announcement.description}
                </p>
              </CardContent>
              <CardFooter className="pt-4 border-t bg-gray-50/50 flex flex-col gap-3 items-start">
                <div className="w-full flex items-center justify-between text-xs font-medium text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {announcement.startTime
                        ? format(new Date(announcement.startTime), "p")
                        : "--:--"}
                      {" - "}
                      {announcement.endTime
                        ? format(new Date(announcement.endTime), "p")
                        : "--:--"}
                    </span>
                  </div>
                </div>

                {(role === "admin" || role === "superuser") && (
                  <div className="w-full flex justify-end gap-2 mt-2">
                    <UpdateAnnouncements announcement={announcement} />
                    <DeleteAnnouncements id={announcement.id} />
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Component */}
      {totalPages > 1 && (
        <Pagination className="mt-8">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((prev) => Math.max(prev - 1, 1));
                }}
              />
            </PaginationItem>
            {Array.from({ length: totalPages }, (_, i) => (
              <PaginationItem key={i}>
                <PaginationLink
                  href="#"
                  isActive={i + 1 === currentPage}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(i + 1);
                  }}
                >
                  {i + 1}
                </PaginationLink>
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setPage((prev) => Math.min(prev + 1, totalPages));
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      )}
    </div>
  );
}
