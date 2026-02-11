"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        console.error(error);
    }, [error]);

    return (
        <html>
            <body className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
                <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                        <AlertCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <h2 className="mb-2 text-2xl font-bold text-gray-900">
                        An error occurred
                    </h2>
                    <p className="mb-6 text-gray-600">
                        An error occurred and the application cannot recover.
                        Please try refreshing the page.
                    </p>
                    <button
                        onClick={() => reset()}
                        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 transition-colors"
                    >
                        Try again
                    </button>
                </div>
            </body>
        </html>
    );
}
