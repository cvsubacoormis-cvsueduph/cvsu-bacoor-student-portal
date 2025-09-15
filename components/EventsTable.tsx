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

import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

import { Event } from "@prisma/client";
import useSWR from "swr";
import { useState } from "react";
import DeleteEvent from "./events/delete-event";
import UpdateEvent from "./events/update-event";
import { useUser } from "@clerk/nextjs";

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function EventsTable() {
  const { user, isLoaded } = useUser();
  const role = isLoaded ? user?.publicMetadata?.role : undefined;

  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, error, isLoading } = useSWR<{
    events: Event[];
    totalEvents: number;
  }>(`/api/events?page=${page}&limit=${limit}`, fetcher);

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

  const eventsList = data?.events || [];
  const totalPages = Math.ceil((data?.totalEvents || 0) / limit);

  return (
    <div>
      {eventsList.length === 0 ? (
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500">No events available.</p>
        </div>
      ) : (
        <Table className="w-full mt-4">
          <TableCaption>A list of recent events.</TableCaption>
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
            {eventsList.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="text-left">{event.title}</TableCell>
                <TableCell className="text-center">
                  {event.description}
                </TableCell>
                <TableCell className="text-center">{event.startTime}</TableCell>
                <TableCell className="text-center">{event.endTime}</TableCell>
                {role === "admin" && (
                  <TableCell className="text-right">
                    <div className="flex items-center gap-2 justify-center">
                      <DeleteEvent id={event.id} />
                      <UpdateEvent event={event} />
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
            />
          </PaginationItem>

          {Array.from({ length: totalPages }, (_, index) => (
            <PaginationItem key={index}>
              <PaginationLink
                href="#"
                isActive={page === index + 1}
                onClick={() => setPage(index + 1)}
              >
                {index + 1}
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
