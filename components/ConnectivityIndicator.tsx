"use client";

import { useEffect, useState } from "react";
import { WifiOff, Wifi } from "lucide-react";

export default function ConnectivityIndicator() {
    const [isOnline, setIsOnline] = useState(true);
    const [showReconnected, setShowReconnected] = useState(false);

    useEffect(() => {
        setIsOnline(navigator.onLine);

        const handleOnline = () => {
            setIsOnline(true);
            setShowReconnected(true);
            setTimeout(() => setShowReconnected(false), 3000);
        };

        const handleOffline = () => {
            setIsOnline(false);
            setShowReconnected(false);
        };

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);

        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, []);

    if (isOnline && !showReconnected) return null;

    return (
        <>
            {!isOnline && (
                <div className="fixed inset-0 z-[9998] flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm text-center p-6">
                    <WifiOff className="h-16 w-16 text-gray-400 mb-4" />
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">No Internet Connection</h2>
                    <p className="text-gray-500 mb-6">
                        It looks like you're offline. Please check your internet connection.
                    </p>
                    <button
                        onClick={() => window.location.reload()}
                        className="rounded-lg bg-blue-700 px-6 py-2 text-white hover:bg-blue-600 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            )}
            <div
                className={`fixed bottom-4 right-4 z-[9999] flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-all duration-300 ${!isOnline
                    ? "bg-red-500 text-white"
                    : "bg-green-500 text-white"
                    }`}
            >
                {!isOnline ? <WifiOff className="h-5 w-5" /> : <Wifi className="h-5 w-5" />}
            </div>
        </>
    );
}
