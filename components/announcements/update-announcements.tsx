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

import { type AnnouncementSchema } from "@/lib/formValidationSchemas";
import { Announcement } from "@prisma/client";
import { PencilIcon } from "lucide-react";
import toast from "react-hot-toast";
import AnnouncementsForm from "../forms/announcements-form";

export default function UpdateAnnouncements({
  announcement,
}: {
  announcement: Announcement;
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isDialogOpen, setDialogOpen] = useState(false);

  const onSubmit = async (data: AnnouncementSchema) => {
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/announcements", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ...data, id: announcement.id }),
      });
      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(
          responseData.message || "Failed to update announcement"
        );
      }

      setErrorMessage("");
      setDialogOpen(false);
      mutate("/api/announcements");
      toast.success("Announcements updated successfully", { duration: 3000 });
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
      <Dialog open={isDialogOpen} onOpenChange={setDialogOpen} modal={false}>
        <DialogTrigger asChild>
          <Button className="bg-blue-700 hover:bg-blue-900">
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
          <AnnouncementsForm
            defaultValues={{
              title: announcement.title,
              description: announcement.description ?? "",
              dateFrom: new Date(announcement.dateFrom),
              dateTo: announcement.dateTo
                ? new Date(announcement.dateTo)
                : undefined,
              startTime: new Date(announcement.startTime),
              endTime: new Date(announcement.endTime),
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
