"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { setSetting } from "@/actions/settings";
import toast from "react-hot-toast";

interface FacultyApprovalToggleProps {
  initialEnabled: boolean;
}

export default function FacultyApprovalToggle({
  initialEnabled,
}: FacultyApprovalToggleProps) {
  const [isEnabled, setIsEnabled] = useState(initialEnabled);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setIsUpdating(true);
    setIsEnabled(checked);

    try {
      const success = await setSetting(
        "FACULTY_UPDATE_REQUIRES_APPROVAL",
        checked.toString(),
      );
      if (success) {
        toast.success(
          checked
            ? "Faculty grade updates now require registrar approval."
            : "Faculty grade updates will be applied directly (no approval).",
        );
      } else {
        setIsEnabled(!checked);
        toast.error("Failed to update setting. Please try again.");
      }
    } catch (error) {
      setIsEnabled(!checked);
      toast.error("An unexpected error occurred.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-md">
      <Switch
        id="faculty-approval-toggle"
        checked={isEnabled}
        onCheckedChange={handleToggle}
        disabled={isUpdating}
        className="data-[state=checked]:bg-amber-600"
      />
      <Label
        htmlFor="faculty-approval-toggle"
        className="text-sm font-medium cursor-pointer whitespace-nowrap"
      >
        {isEnabled ? "Faculty Updates Need Approval" : "Faculty Updates Direct"}
      </Label>
    </div>
  );
}
