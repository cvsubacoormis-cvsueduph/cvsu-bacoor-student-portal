"use client";

import { Lock, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { SignOutButton } from "@clerk/nextjs";
import Image from "next/image";

export default function AccessClosedComp() {
    const [timeLeft, setTimeLeft] = useState(10);
    const { signOut } = useClerk();

    useEffect(() => {
        if (timeLeft === 0) {
            signOut({ redirectUrl: "/" });
            return;
        }

        const timer = setInterval(() => {
            setTimeLeft((prev) => prev - 1);
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft, signOut]);

    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <Card className="w-full max-w-md text-center shadow-lg">
                <CardHeader className="flex flex-col items-center space-y-4 pb-2">
                    <Image src="/logos.png" alt="Logo" width={200} height={200} />
                    <div className="p-4 bg-blue-700 rounded-full">
                        <Lock className="h-10 w-10 text-white" />
                    </div>
                    <CardTitle className="text-2xl font-bold">
                        Portal Access Closed
                    </CardTitle>
                    <CardDescription className="text-base">
                        The student portal is currently closed for your viewing schedule.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground mb-4">
                        Please check back later or wait for the scheduled opening time to view your grades and schedules.
                    </p>
                    <p className="text-xs text-red-500 font-medium animate-pulse">
                        Auto logging out in {timeLeft} seconds...
                    </p>
                </CardContent>
                <CardFooter className="flex justify-center pt-2">
                    <Button asChild className="w-full sm:w-auto min-w-[140px] bg-blue-700 hover:bg-blue-600 cursor-pointer">
                        <SignOutButton>
                            <span className="flex items-center gap-2">
                                <LogOut className="h-4 w-4" />
                                Log out
                            </span>
                        </SignOutButton>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
