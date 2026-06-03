"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toggleGradeVisibility } from "@/actions/settings";
import toast from "react-hot-toast";
import { Eye, EyeOff } from "lucide-react";

interface GradeVisibilityToggleProps {
  initialVisible: boolean;
}

export default function GradeVisibilityToggle({
  initialVisible,
}: GradeVisibilityToggleProps) {
  const [isVisible, setIsVisible] = useState(initialVisible);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleToggle = async (checked: boolean) => {
    setIsUpdating(true);
    setIsVisible(checked); // Optimistic update

    try {
      const success = await toggleGradeVisibility(checked);
      if (success) {
        toast.success(
          checked
            ? "Grades are now visible to students."
            : "Grades are now hidden from students.",
        );
      } else {
        setIsVisible(!checked);
        toast.error("Failed to update setting. You may not have permission.");
      }
    } catch (error) {
      setIsVisible(!checked);
      toast.error("An unexpected error occurred.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-md">
      {isVisible ? (
        <Eye className="h-4 w-4 text-green-600" />
      ) : (
        <EyeOff className="h-4 w-4 text-orange-600" />
      )}
      <Switch
        id="grade-visibility-toggle"
        checked={isVisible}
        onCheckedChange={handleToggle}
        disabled={isUpdating}
        className="data-[state=checked]:bg-green-600 data-[state=unchecked]:bg-orange-500"
      />
      <Label
        htmlFor="grade-visibility-toggle"
        className="text-sm font-medium cursor-pointer whitespace-nowrap"
      >
        {isVisible ? "Grades Visible" : "Grades Hidden"}
      </Label>
    </div>
  );
}
