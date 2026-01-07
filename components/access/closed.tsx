import { Lock } from "lucide-react";
import Link from "next/link";
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

export default function AccessClosedComp() {
    return (
        <div className="flex items-center justify-center min-h-[60vh] p-4">
            <Card className="w-full max-w-md text-center shadow-lg">
                <CardHeader className="flex flex-col items-center space-y-4 pb-2">
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
                    <p className="text-sm text-muted-foreground">
                        Please check back later or wait for the scheduled opening time to view your grades and schedules.
                    </p>
                </CardContent>
                <CardFooter className="flex justify-center pt-2">
                    <Button asChild className="w-full sm:w-auto min-w-[140px] bg-blue-700 hover:bg-blue-600">
                        <SignOutButton>
                            Logout
                        </SignOutButton>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
}
