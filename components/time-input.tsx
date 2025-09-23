"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format, isValid } from "date-fns";
import * as React from "react";

interface TimeInputProps {
  value?: Date;
  onChange: (date: Date) => void;
  disabled?: boolean;
  className?: string;
}

export const TimeInput: React.FC<TimeInputProps> = ({
  value,
  onChange,
  disabled = false,
  className,
}) => {
  const [timeValue, setTimeValue] = React.useState("");

  React.useEffect(() => {
    if (value && isValid(value)) {
      setTimeValue(format(value, "HH:mm"));
    }
  }, [value]);

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTimeValue = e.target.value;
    setTimeValue(newTimeValue);

    if (newTimeValue && value) {
      // Parse the time string (HH:mm format)
      const [hours, minutes] = newTimeValue.split(":").map(Number);

      if (
        !isNaN(hours) &&
        !isNaN(minutes) &&
        hours >= 0 &&
        hours <= 23 &&
        minutes >= 0 &&
        minutes <= 59
      ) {
        const newDate = new Date(value);
        newDate.setHours(hours, minutes, 0, 0);
        onChange(newDate);
      }
    }
  };

  return (
    <div className={cn("relative", className)}>
      <Input
        type="time"
        value={timeValue}
        onChange={handleTimeChange}
        disabled={disabled}
        className="w-full text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
        step="60" // 1 minute steps
      />
    </div>
  );
};

TimeInput.displayName = "TimeInput";
