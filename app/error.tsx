"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error(error);
    }, [error]);

    return (
        <div className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center">
            <div className="mb-4 rounded-full bg-red-100 p-3 dark:bg-red-900/20">
                <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="mb-2 text-2xl font-bold tracking-tight">
                Something went wrong!
            </h2>
            <p className="mb-6 text-muted-foreground">
                We apologize for the inconvenience. An unexpected error occurred.
            </p>
            <div className="flex gap-4">
                <Button onClick={() => window.location.href = '/'} variant="outline">
                    Go Home
                </Button>
                <Button className="bg-blue-700 hover:bg-blue-600" onClick={() => reset()}>Try again</Button>
            </div>
        </div>
    );
}
