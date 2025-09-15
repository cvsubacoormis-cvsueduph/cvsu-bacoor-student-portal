"use client";

import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { eventSchema, EventSchema } from "@/lib/formValidationSchemas";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { mutate } from "swr";
import toast from "react-hot-toast";
import EventForm from "../forms/events-form";
import { PlusCircleIcon } from "lucide-react";

export default function CreateEvents() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [DialogOpen, setDialogOpen] = useState(false);

  const form = useForm<EventSchema>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      title: "",
      description: "",
      startTime: "",
      endTime: "",
    },
  });

  const onSubmit = async (data: EventSchema) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/events", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      const responseData = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || "Failed to create event");
      }
      form.reset();
      setDialogOpen(false);
      mutate("/api/events");
      toast.success("Event created successfully");
      setErrorMessage("");
    } catch (error) {
      console.error("Error creating event:", error);
      const errorMessage =
        error instanceof Error ? error.message : "An unxpected error occurred";
      setErrorMessage(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };
  return (
    <div className="sm:max-w-3xl lg:max-w-5xl">
      <Dialog open={DialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button className="bg-blue-700 hover:bg-blue-900">
            <PlusCircleIcon className="mr-2 h-4 w-4" /> Create
          </Button>
        </DialogTrigger>
        <DialogContent className="space-y-6 px-6 py-4 lg:px-8 lg:py-6">
          <DialogHeader className="space-y-2">
            <DialogTitle className="text-md font-semibold">
              Create Event
            </DialogTitle>
            <DialogDescription className="text-sm">
              Create a new event
            </DialogDescription>
          </DialogHeader>
          {errorMessage && (
            <div className="text-red-500 text-sm mb-4">{errorMessage}</div>
          )}
          <EventForm
            defaultValues={form.getValues()}
            onSubmit={onSubmit}
            isSubmitting={isSubmitting}
            submitButtonText="Create Event"
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
