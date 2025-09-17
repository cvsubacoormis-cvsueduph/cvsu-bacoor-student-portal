"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Button } from "../ui/button";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";

import {
  announcementSchema,
  AnnouncementSchema,
} from "@/lib/formValidationSchemas";
import { Textarea } from "../ui/textarea";

type AnnouncementsFormProps = {
  defaultValues: AnnouncementSchema;
  onSubmit: (data: AnnouncementSchema) => Promise<void>;
  submitButtonText: string;
  isSubmitting: boolean;
};

export default function AnnouncementsForm({
  defaultValues,
  onSubmit,
  submitButtonText,
  isSubmitting,
}: AnnouncementsFormProps) {
  const form = useForm<AnnouncementSchema>({
    resolver: zodResolver(announcementSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-2"
      >
        <div className="flex justify-between flex-wrap gap-2">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Title</FormLabel>
                <FormControl>
                  <Input placeholder="Enter Title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Enter Description"
                    {...field}
                    className="resize-none ml-2"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dateTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input
                    type="date"
                    {...field}
                    value={
                      field.value ? field.value.toISOString().split("T")[0] : ""
                    }
                    className="mr-9"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <Button
          className="w-full mt-4 bg-blue-700 hover:bg-blue-900"
          disabled={isSubmitting}
          type="submit"
        >
          {submitButtonText}
        </Button>
      </form>
    </Form>
  );
}
