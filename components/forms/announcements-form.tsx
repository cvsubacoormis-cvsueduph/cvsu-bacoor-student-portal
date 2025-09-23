"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";

import { Button } from "@/components/ui/button";

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";

import {
  announcementSchema,
  type AnnouncementSchema,
} from "@/lib/formValidationSchemas";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, ChevronDownIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { DateRange } from "react-day-picker";

type AnnouncementsFormProps = {
  defaultValues: AnnouncementSchema;
  onSubmit: (data: AnnouncementSchema) => Promise<void>;
  submitButtonText: string;
  isSubmitting: boolean;
  selected?: DateRange | undefined;
  onSelect?: (date: DateRange | undefined) => void;
  dateRange?: DateRange | undefined;
  setDateRange?: (date: Date | undefined) => void;
};

export default function AnnouncementsForm({
  defaultValues,
  onSubmit,
  submitButtonText,
  isSubmitting,
  selected,
  onSelect,
  dateRange,
  setDateRange,
}: AnnouncementsFormProps) {
  const form = useForm<AnnouncementSchema>({
    resolver: zodResolver(announcementSchema),
    defaultValues,
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="gap-2">
        <div className="gap-2">
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
                    className=""
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dateFrom"
            render={({ field }) => (
              <FormItem className="flex flex-col mt-2">
                <FormLabel>Date Range</FormLabel>
                <Popover>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full pl-3 text-left font-normal",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        {form.getValues("dateFrom")
                          ? form.getValues("dateTo")
                            ? `${format(form.getValues("dateFrom"), "PPP")} - ${format(
                                form.getValues("dateTo") ?? new Date(),
                                "PPP"
                              )}`
                            : format(form.getValues("dateFrom"), "PPP")
                          : "Pick a date"}
                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="range"
                      selected={{
                        from: form.getValues("dateFrom"),
                        to: form.getValues("dateTo"),
                      }}
                      onSelect={(range) => {
                        form.setValue("dateFrom", range?.from || new Date());
                        form.setValue("dateTo", range?.to || undefined);
                      }}
                      numberOfMonths={2}
                      className="rounded-lg border shadow-sm"
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="startTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Start Time</FormLabel>
                <FormControl>
                  <Input
                    type="time"
                    placeholder="Enter End Time"
                    value={field.value ? format(field.value, "HH:mm") : ""}
                    className="w-full"
                    onChange={(e) =>
                      field.onChange(
                        new Date(`1970-01-01T${e.target.value}:00`)
                      )
                    }
                  />
                </FormControl>
                <FormDescription>
                  Please use 24-hour format (e.g., 14:30 for 2:30 PM).
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="endTime"
            render={({ field }) => (
              <FormItem>
                <FormLabel>End Time</FormLabel>
                <FormControl>
                  <Input
                    type="time"
                    placeholder="Enter End Time"
                    value={field.value ? format(field.value, "HH:mm") : ""}
                    className="w-full"
                    onChange={(e) =>
                      field.onChange(
                        new Date(`1970-01-01T${e.target.value}:00`)
                      )
                    }
                  />
                </FormControl>
                <FormDescription>
                  Please use 24-hour format (e.g., 14:30 for 2:30 PM).
                </FormDescription>
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
