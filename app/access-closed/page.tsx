export default function AccessClosed() {
    return (
        <div className="flex h-screen items-center justify-center">
            <div className="text-center space-y-2">
                <h1 className="text-xl font-bold">Access Not Available</h1>
                <p>
                    Your course is not scheduled to access the portal at this time.
                </p>
                <p className="text-muted-foreground">
                    Please check the official grade release schedule.
                </p>
            </div>
        </div>
    );
}
