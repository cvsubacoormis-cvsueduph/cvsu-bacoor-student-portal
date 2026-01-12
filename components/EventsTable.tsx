"use client";

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
import EventsTableSkeleton from "./skeleton/EventsTableSkeleton";
import { format } from "date-fns";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CalendarDays, Clock } from "lucide-react";

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

  if (isLoading) return <EventsTableSkeleton />;

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
    <div className="space-y-6">
      {eventsList.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed rounded-lg bg-gray-50">
          <p className="text-gray-500 text-lg font-medium">No events found</p>
          <p className="text-sm text-gray-400">Check back later for updates.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {eventsList.map((event) => (
            <Card key={event.id} className="flex flex-col h-full hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="space-y-1">
                  <CardTitle className="line-clamp-2 text-lg font-bold leading-tight text-blue-900">
                    {event.title}
                  </CardTitle>
                  <div className="flex items-center text-xs text-muted-foreground gap-1">
                    <CalendarDays className="h-3 w-3" />
                    {event.dateFrom
                      ? event.dateTo
                        ? `${format(new Date(event.dateFrom), "MMM d, yyyy")} - ${format(
                          new Date(event.dateTo),
                          "MMM d, yyyy"
                        )}`
                        : format(new Date(event.dateFrom), "MMM d, yyyy")
                      : "No Date"}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                <p className="text-sm text-gray-600 line-clamp-4 leading-relaxed">
                  {event.description}
                </p>
              </CardContent>
              <CardFooter className="pt-4 border-t bg-gray-50/50 flex flex-col gap-3 items-start">
                <div className="w-full flex items-center justify-between text-xs font-medium text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>
                      {event.startTime
                        ? format(new Date(event.startTime), "p")
                        : "--:--"}
                      {" - "}
                      {event.endTime
                        ? format(new Date(event.endTime), "p")
                        : "--:--"}
                    </span>
                  </div>
                </div>

                {(role === "admin" || role === "superuser") && (
                  <div className="w-full flex justify-end gap-2 mt-2">
                    <UpdateEvent event={event} />
                    <DeleteEvent id={event.id} />
                  </div>
                )}
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

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

            {Array.from({ length: totalPages }, (_, index) => (
              <PaginationItem key={index}>
                <PaginationLink
                  href="#"
                  isActive={page === index + 1}
                  onClick={(e) => {
                    e.preventDefault();
                    setPage(index + 1);
                  }}
                >
                  {index + 1}
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
