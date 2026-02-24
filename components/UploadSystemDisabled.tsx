import { AlertCircle } from "lucide-react";
import {
    Empty,
    EmptyHeader,
    EmptyTitle,
    EmptyDescription,
    EmptyContent,
    EmptyMedia,
} from "@/components/ui/empty";

export function UploadSystemDisabled() {
    return (
        <div className="flex h-full min-h-[50vh] w-full items-center justify-center p-4">
            <Empty className="w-full max-w-lg bg-yellow-50/50 border-yellow-200/50 shadow-sm rounded-xl">
                <EmptyHeader>
                    <EmptyMedia variant="icon" className="h-14 w-14 bg-yellow-100/80 text-yellow-600 ring-4 ring-yellow-50">
                        <AlertCircle className="h-7 w-7" />
                    </EmptyMedia>
                    <EmptyTitle className="text-xl font-semibold mt-4 text-yellow-800">
                        Upload System Disabled
                    </EmptyTitle>
                    <EmptyDescription className="mt-2 text-center text-yellow-700/80 max-w-sm">
                        You cannot upload grades right now because the deadline has exceeded
                        or the system has been locked by an administrator. Please contact
                        the MIS for assistance.
                    </EmptyDescription>
                </EmptyHeader>
            </Empty>
        </div>
    );
}
