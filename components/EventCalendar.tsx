"use client";

import React, { useEffect, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTrigger,
} from "./ui/dialog";
import { DialogTitle } from "@radix-ui/react-dialog";
import { Ellipsis } from "lucide-react";
import { CalendarSkeleton } from "./skeleton/CalendarSkeleton";
import { EventsSkeleton } from "./skeleton/EventsSkeleton";
import { format } from "date-fns";

type Event = {
  id: number;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  dateFrom: string;
  dateTo: string;
  createdAt: string;
};

export default function EventCalendar() {
  const [events, setEvents] = useState<Event[]>([]);
  const [value, onChanges] = useState<Date>(new Date()); // Ensuring value is a single Date
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchEvents() {
      try {
        const response = await fetch("/api/events");
        const data = await response.json();

        // Ensure data is an array, or set an empty array as fallback
        if (Array.isArray(data)) {
          setEvents(data);
        } else if (data.events && Array.isArray(data.events)) {
          setEvents(data.events); // Adjust if API returns an object { events: [] }
        } else {
          setEvents([]); // Ensure events is always an array
        }
      } catch (error) {
        console.log("Error fetching events:", error);
        setEvents([]); // Set an empty array on error
      } finally {
        setLoading(false);
      }
    }

    fetchEvents();
  }, []);

  const renderEvents = (eventsList: Event[]) => {
    if (eventsList.length === 0) {
      return <p className="text-gray-400">No events available</p>;
    }

    return eventsList.map((event) => (
      <div
        className="p-5 rounded-md border-2 border-gray-100 border-t-4 odd:border-t-blue-700 even:border-t-blue-900 transition-shadow duration-200 ease-in-out"
        key={event.id}
      >
        <div className="flex items-center justify-between">
          <h1 className="font-semibold text-gray-600">{event.title} </h1>
          <span className="text-gray-800 text-xs">
            {event.startTime
              ? format(new Date(event.startTime), "p")
                  .replace("a.m.", "AM")
                  .replace("p.m.", "PM")
              : "—"}{" "}
            -{" "}
            {event.endTime
              ? format(new Date(event.endTime), "p")
                  .replace("a.m.", "AM")
                  .replace("p.m.", "PM")
              : "—"}
          </span>
        </div>
        {event.description && (
          <p className="mt-2 text-gray-800 text-sm">{event.description}</p>
        )}
        <p className="mt-2 text-gray-500 text-xs">
          <span className="text-gray-600 text-xs font-normal">
            {event.dateFrom
              ? event.dateTo
                ? `(${format(new Date(event.dateFrom), "PPP")} - ${format(
                    new Date(event.dateTo),
                    "PPP"
                  )})`
                : `(${format(new Date(event.dateFrom), "PPP")}`
              : "—"}
          </span>
        </p>
      </div>
    ));
  };

  return (
    <div className="bg-white p-4 rounded-md">
      {loading ? (
        <CalendarSkeleton />
      ) : (
        <Calendar
          onChange={(value) => {
            if (value instanceof Date) {
              onChanges(value);
            }
          }}
          value={value}
        />
      )}
      {/* onChange expects a Date or Date[] */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold my-4">Events</h1>
        <Dialog>
          <DialogTrigger asChild>
            <Ellipsis height={20} width={20} cursor={"pointer"} />
          </DialogTrigger>
          <DialogContent className="bg-white shadow-lg rounded-lg">
            <DialogHeader className="border-b border-gray-200 pb-4 mb-4">
              <DialogTitle className="text-xl font-bold text-gray-700">
                All Events
              </DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4">
              {events.length === 0 ? (
                <p className="text-gray-400">No events available</p>
              ) : (
                events.map((event) => (
                  <div
                    className="p-5 rounded-md border-2 border-gray-100 border-t-4 odd:border-t-blue-700 even:border-t-blue-900 transition-shadow duration-200 ease-in-out"
                    key={event.id}
                  >
                    <div className="flex items-center justify-between">
                      <h1 className="font-semibold text-gray-800">
                        {event.title}
                      </h1>
                      <span className="text-gray-800 text-xs">
                        {event.startTime
                          ? format(new Date(event.startTime), "p")
                              .replace("a.m.", "AM")
                              .replace("p.m.", "PM")
                          : "—"}{" "}
                        -{" "}
                        {event.endTime
                          ? format(new Date(event.endTime), "p")
                              .replace("a.m.", "AM")
                              .replace("p.m.", "PM")
                          : "—"}
                      </span>
                    </div>
                    {event.description && (
                      <p className="mt-2 text-gray-800 text-sm">
                        {event.description}
                      </p>
                    )}
                    <p className="mt-2 text-gray-500 text-xs">
                      <span className="text-gray-600 text-xs font-normal">
                        {event.dateFrom
                          ? event.dateTo
                            ? `(${format(new Date(event.dateFrom), "PPP")} - ${format(
                                new Date(event.dateTo),
                                "PPP"
                              )})`
                            : `(${format(new Date(event.dateFrom), "PPP")}`
                          : "—"}
                      </span>
                    </p>
                  </div>
                ))
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      {loading ? (
        <>
          <EventsSkeleton />{" "}
        </>
      ) : (
        <div className="flex flex-col gap-4">{renderEvents(events)}</div>
      )}
    </div>
  );
}
