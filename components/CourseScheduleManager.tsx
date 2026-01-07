"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";
import { Schedule } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "./ui/calendar";

const courses = ["BSIT", "BSCS", "BSCRIM", "BSP", "BSHM", "BSED", "BSBA"];

export default function CourseScheduleManager() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [course, setCourse] = useState<string>(courses[0]);
    const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
    const [startTime, setStartTime] = useState<string>("07:00");
    const [endTime, setEndTime] = useState<string>("10:00");
    const [loading, setLoading] = useState(false);

    async function fetchSchedules() {
        try {
            const res = await fetch("/api/schedules");
            const data = await res.json();

            // ✅ Ensure schedules is always an array
            if (!Array.isArray(data.schedules)) {
                setSchedules([]);
            } else {
                setSchedules(data.schedules);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load schedules");
            setSchedules([]);
        }
    }

    useEffect(() => {
        fetchSchedules();
    }, []);

    async function handleSave() {
        if (!course || !date || !startTime || !endTime) {
            toast.error("All fields are required");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/schedules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ course, accessDate: date, startTime, endTime }),
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Failed to save schedule");
            } else {
                toast.success("Schedule saved!");
                fetchSchedules();
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to save schedule");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="p-6 space-y-6">
            <div className="flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block mb-1 font-medium">Course</label>
                    <Select value={course} onValueChange={setCourse}>
                        <SelectTrigger className="w-[150px]">
                            <SelectValue placeholder="Select course" />
                        </SelectTrigger>
                        <SelectContent>
                            {courses.map((c) => (
                                <SelectItem key={c} value={c}>
                                    {c}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="flex flex-col">
                    <label className="block mb-1 font-medium">Date</label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className="w-[240px] justify-start text-left font-normal"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {date ? format(new Date(date), "PPP") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={date ? new Date(date) : undefined}
                                onSelect={(d) => setDate(d ? format(d, "yyyy-MM-dd") : "")}
                                captionLayout="dropdown"
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                <div>
                    <label className="block mb-1 font-medium">Start Time</label>
                    <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
                </div>

                <div>
                    <label className="block mb-1 font-medium">End Time</label>
                    <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
                </div>

                <Button onClick={handleSave} disabled={loading}>
                    {loading ? "Saving..." : "Save Schedule"}
                </Button>
            </div>

            {/* Existing Schedules */}
            <div className="mt-6">
                <h2 className="text-xl font-semibold mb-2">Existing Schedules</h2>
                <div className="overflow-x-auto border rounded">
                    <table className="min-w-full table-auto">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="px-4 py-2 text-left">Course</th>
                                <th className="px-4 py-2 text-left">Date</th>
                                <th className="px-4 py-2 text-left">Start Time</th>
                                <th className="px-4 py-2 text-left">End Time</th>
                            </tr>
                        </thead>
                        <tbody>
                            {schedules.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="text-center py-4">
                                        No schedules yet
                                    </td>
                                </tr>
                            ) : (
                                schedules.map((s) => (
                                    <tr key={s.id} className="border-t">
                                        <td className="px-4 py-2">{s.course}</td>
                                        <td className="px-4 py-2">{s.accessDate.split("T")[0]}</td>
                                        <td className="px-4 py-2">{s.startTime}</td>
                                        <td className="px-4 py-2">{s.endTime}</td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
