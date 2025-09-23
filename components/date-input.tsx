"use client";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format, isValid, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import * as React from "react";

interface DateInputProps {
  value?: Date;
  onChange: (date: Date) => void;
  disabled?: boolean;
  className?: string;
}

export const DateInput: React.FC<DateInputProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const [open, setOpen] = React.useState(false);
  const [inputValue, setInputValue] = React.useState("");

  React.useEffect(() => {
    if (value && isValid(value)) {
      setInputValue(format(value, "yyyy-MM-dd"));
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // Try to parse the input as a date
    const parsedDate = parse(newValue, "yyyy-MM-dd", new Date());
    if (isValid(parsedDate)) {
      onChange(parsedDate);
    }
  };

  const handleCalendarSelect = (date: Date | undefined) => {
    if (date) {
      onChange(date);
      setOpen(false);
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              "text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2",
              "min-h-[32px] sm:min-h-[36px]",
              !value && "text-muted-foreground"
            )}
            disabled={disabled}
          >
            <CalendarIcon className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
            <span className="truncate">
              {value && isValid(value)
                ? format(value, "MMM d, yyyy")
                : "Pick date"}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0 max-w-[95vw]" align="start">
          <Calendar
            mode="single"
            selected={value}
            onSelect={handleCalendarSelect}
            initialFocus
          />
        </PopoverContent>
      </Popover>
      <Input
        type="date"
        value={inputValue}
        onChange={handleInputChange}
        disabled={disabled}
        className="mt-1.5 sm:mt-2 text-xs sm:text-sm h-8 sm:h-9"
      />
    </div>
  );
};

DateInput.displayName = "DateInput";
