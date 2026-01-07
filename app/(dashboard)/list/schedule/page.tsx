import CourseScheduleManager from "@/components/CourseScheduleManager";

export default function SchedulePage() {
    return <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0 h-full">
        {/* TOP */}
        <div className="flex items-center justify-between">
            <h1 className="hidden md:block text-lg font-semibold">
                Logged in Scheduling{" "}
                <span className=" flex text-xs text-gray-500 mb-2">
                    Lists of Schedules
                </span>
            </h1>
        </div>
        <CourseScheduleManager />
    </div>;
}
