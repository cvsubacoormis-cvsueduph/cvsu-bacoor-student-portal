"use client";

import { useState } from "react";
import { mutate } from "swr";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { type EventSchema } from "@/lib/formValidationSchemas";
import { Event } from "@prisma/client";
import { PencilIcon } from "lucide-react";
import toast from "react-hot-toast";
import EventForm from "../forms/events-form";

export default function UpdateEvent({ event }: { event: Event }) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDialogOpen, setDialogOpen] = useState(false);

  const onSubmit = async (data: EventSchema) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/events", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...data, id: event.id }),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData.message || "Failed to update event");
      }

      setErrorMessage("");
      setDialogOpen(false);
      mutate("/api/events");
      toast.success("Event updated successfully", { duration: 3000 });
    } catch (error) {
      console.error("Error updating event:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unxpected error occurred";
      setErrorMessage(errorMessage);
      toast.error(errorMessage, { duration: 3000 });
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="sm:max-w-3xl lg:max-w-5xl">
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button className="bg-blue-600 hover:bg-blue-500">
            <PencilIcon />
            Edit
          </Button>
        </DialogTrigger>
        <DialogContent className="space-y-6 px-6 py-4 lg:px-8 lg:py-6">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-md font-semibold">
              Update Event
            </DialogTitle>
          </DialogHeader>
          {errorMessage && (
            <div className="text-red-500 text-sm mb-4">{errorMessage}</div>
          )}
          <EventForm
            defaultValues={{
              title: event.title,
              description: event.description ?? "",
              dateFrom: event.dateFrom,
              dateTo: event.dateTo ?? undefined,
              startTime: event.startTime,
              endTime: event.endTime,
            }}
            onSubmit={onSubmit}
            submitButtonText="Update"
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
