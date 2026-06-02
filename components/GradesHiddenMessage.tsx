import { EyeOff, Clock } from "lucide-react";
import {
    Empty,
    EmptyHeader,
    EmptyTitle,
    EmptyDescription,
    EmptyContent,
    EmptyMedia,
} from "@/components/ui/empty";

export function GradesHiddenMessage() {
    return (
        <div className="flex h-full min-h-[50vh] w-full items-center justify-center p-4">
            <Empty className="w-full max-w-lg bg-blue-50/50 border-blue-200/50 shadow-sm rounded-xl">
                <EmptyHeader>
                    <EmptyMedia variant="icon" className="h-14 w-14 bg-blue-100/80 text-blue-600 ring-4 ring-blue-50">
                        <EyeOff className="h-7 w-7" />
                    </EmptyMedia>
                    <EmptyTitle className="text-xl font-semibold mt-4 text-blue-800">
                        Grades Currently Unavailable
                    </EmptyTitle>
                    <EmptyDescription className="mt-2 text-center text-blue-700/80 max-w-sm">
                        <p>
                            Your grades are currently being processed by the faculty.
                            This may happen during grade uploading or updating periods.
                        </p>
                        <p className="mt-3 flex items-center justify-center gap-1.5 text-blue-600">
                            <Clock className="h-4 w-4" />
                            Please check back shortly.
                        </p>
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        </div>
    );
}
