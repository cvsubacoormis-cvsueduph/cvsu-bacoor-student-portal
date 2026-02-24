"use client";

import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { setSetting } from "@/actions/settings";
import toast from "react-hot-toast";

interface AdminUploadToggleProps {
    initialEnabled: boolean;
}

export default function AdminUploadToggle({ initialEnabled }: AdminUploadToggleProps) {
    const [isEnabled, setIsEnabled] = useState(initialEnabled);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleToggle = async (checked: boolean) => {
        setIsUpdating(true);
        setIsEnabled(checked); // Optimistic update

        try {
            const success = await setSetting("UPLOAD_GRADES_ENABLED", checked.toString());
            if (success) {
                toast.success(`Grade uploading has been ${checked ? 'enabled' : 'disabled'}.`);
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
                id="upload-toggle"
                checked={isEnabled}
                onCheckedChange={handleToggle}
                disabled={isUpdating}
                className="data-[state=checked]:bg-blue-600"
            />
            <Label htmlFor="upload-toggle" className="text-sm font-medium cursor-pointer">
                {isEnabled ? "Uploads Enabled" : "Uploads Disabled"}
            </Label>
        </div>
    );
}
