"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { DateRange } from "react-day-picker";
import { Schedule } from "@/lib/types";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon } from "lucide-react";
import { Calendar } from "./ui/calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "./ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

const courses = ["BSIT", "BSCS", "BSCRIM", "BSP", "BSHM", "BSED", "BSBA"];

export default function CourseScheduleManager() {
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [course, setCourse] = useState<string>(courses[0]);

    // Pagination & Search State
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState("");
    const [debouncedSearch, setDebouncedSearch] = useState("");

    // Debounce Search
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setCurrentPage(1); // Reset to page 1 on search
        }, 500);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    // Use DateRange for selection
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: new Date(),
        to: new Date(),
    });

    const [startTime, setStartTime] = useState<string>("07:00");
    const [endTime, setEndTime] = useState<string>("10:00");
    const [loading, setLoading] = useState(false);

    const [editingSchedule, setEditingSchedule] = useState<Schedule | null>(null);
    const [scheduleToDelete, setScheduleToDelete] = useState<Schedule | null>(null);

    async function fetchSchedules() {
        try {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: "10",
                search: debouncedSearch,
            });

            const res = await fetch(`/api/schedules?${params.toString()}`);
            const data = await res.json();

            if (data.schedules && Array.isArray(data.schedules)) {
                setSchedules(data.schedules);
                if (data.meta) {
                    setTotalPages(data.meta.totalPages);
                }
            } else {
                setSchedules([]);
            }

        } catch (err) {
            console.error(err);
            toast.error("Failed to load schedules");
            setSchedules([]);
        }
    }

    useEffect(() => {
        fetchSchedules();
    }, [currentPage, debouncedSearch]);

    async function handleSave() {
        if (!course || !dateRange?.from || !startTime || !endTime) {
            toast.error("Course, Date Range (From), Start Time, and End Time are required");
            return;
        }

        setLoading(true);
        try {
            // If "to" is missing, use "from" (single day)
            const endDate = dateRange.to || dateRange.from;

            const res = await fetch("/api/schedules", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    course,
                    startDate: format(dateRange.from, "yyyy-MM-dd"),
                    endDate: format(endDate, "yyyy-MM-dd"),
                    startTime,
                    endTime,
                }),
            });
            const data = await res.json();
            if (!res.ok) toast.error(data.error || "Failed to save schedule");
            else {
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

    async function handleEdit() {
        if (!editingSchedule) return;
        setLoading(true);
        try {
            const res = await fetch("/api/schedules", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    course: editingSchedule.course,
                    accessDate: editingSchedule.accessDate, // Identifier
                    newTaskDate: dateRange?.from ? format(dateRange.from, "yyyy-MM-dd") : undefined, // Potential Move
                    startTime,
                    endTime,
                    isActive: true,
                }),
            });
            const data = await res.json();
            if (!res.ok) toast.error(data.error || "Failed to update schedule");
            else {
                toast.success("Schedule updated!");
                setEditingSchedule(null);
                fetchSchedules();
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to update schedule");
        } finally {
            setLoading(false);
        }
    }

    function handleDelete(schedule: Schedule) {
        setScheduleToDelete(schedule);
    }

    async function confirmDelete() {
        if (!scheduleToDelete) return;

        setLoading(true);
        try {
            const params = new URLSearchParams({
                course: scheduleToDelete.course,
                accessDate: scheduleToDelete.accessDate,
            });
            const res = await fetch(`/api/schedules?${params.toString()}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (!res.ok) toast.error(data.error || "Failed to delete schedule");
            else {
                toast.success("Schedule deleted!");
                fetchSchedules();
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete schedule");
        } finally {
            setLoading(false);
            setScheduleToDelete(null);
        }
    }

    return (
        <div className="p-6 space-y-6">
            {/* Create / Add Schedule */}
            <div className="flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block mb-1 font-medium">Course</label>
                    <Select value={course} onValueChange={setCourse} disabled={!!editingSchedule}>
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
                    <label className="block mb-1 font-medium">
                        {editingSchedule ? "Date (Single)" : "Date Range"}
                    </label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className="w-[300px] justify-start text-left font-normal"
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {dateRange?.from ? (
                                    dateRange.to ? (
                                        <>
                                            {format(dateRange.from, "LLL dd, y")} -{" "}
                                            {format(dateRange.to, "LLL dd, y")}
                                        </>
                                    ) : (
                                        format(dateRange.from, "LLL dd, y")
                                    )
                                ) : (
                                    <span>Pick a date</span>
                                )}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                initialFocus
                                mode="range"
                                defaultMonth={dateRange?.from}
                                selected={dateRange}
                                onSelect={setDateRange}
                                numberOfMonths={2}
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

                <div>
                    <label className="block mb-1 font-medium opacity-0">Action</label>
                    <Button
                        variant="outline"
                        onClick={() => {
                            setStartTime("00:00");
                            setEndTime("23:59");
                        }}
                        title="Set to 24 Hours (00:00 - 23:59)"
                    >
                        24H / Full Day
                    </Button>
                </div>


                <div className="flex gap-2">
                    <Button
                        className="bg-blue-700 hover:bg-blue-600"
                        onClick={editingSchedule ? handleEdit : handleSave}
                        disabled={loading}
                    >
                        {loading ? "Saving..." : editingSchedule ? "Update Schedule" : "Save Schedule"}
                    </Button>
                    {editingSchedule && (
                        <Button
                            variant="secondary"
                            onClick={() => {
                                setEditingSchedule(null);
                                setDateRange({ from: new Date(), to: new Date() });
                                setStartTime("07:00");
                                setEndTime("10:00");
                            }}
                        >
                            Cancel Edit
                        </Button>
                    )}
                </div>
            </div>

            {/* Existing Schedules */}
            <div className="mt-6">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-xl font-semibold">Existing Schedules</h2>
                    <div className="w-[250px]">
                        <Input
                            placeholder="Search Course..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                </div>

                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Course</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Start Time</TableHead>
                                <TableHead>End Time</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {schedules.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center h-24">
                                        No schedules found
                                    </TableCell>
                                </TableRow>
                            ) : (
                                schedules.map((s) => (
                                    <TableRow key={s.id}>
                                        <TableCell className="font-medium">{s.course}</TableCell>
                                        <TableCell>{s.accessDate.split("T")[0]}</TableCell>
                                        <TableCell>{s.startTime}</TableCell>
                                        <TableCell>{s.endTime}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => {
                                                        setEditingSchedule(s);
                                                        setCourse(s.course);
                                                        // Set range to single day
                                                        setDateRange({
                                                            from: new Date(s.accessDate),
                                                            to: new Date(s.accessDate),
                                                        });
                                                        setStartTime(s.startTime);
                                                        setEndTime(s.endTime);
                                                    }}
                                                >
                                                    Edit
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="destructive"
                                                    onClick={() => handleDelete(s)}
                                                >
                                                    Delete
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination Controls */}
                <div className="flex items-center justify-end space-x-2 py-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                    >
                        Previous
                    </Button>
                    <div className="text-sm font-medium">
                        Page {currentPage} of {totalPages || 1}
                    </div>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                        disabled={currentPage >= totalPages}
                    >
                        Next
                    </Button>
                </div>
            </div>
            <Dialog open={!!scheduleToDelete} onOpenChange={(open) => !open && setScheduleToDelete(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Confirm Delete</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        Are you sure you want to delete the schedule for{" "}
                        <span className="font-bold">{scheduleToDelete?.course}</span> on{" "}
                        <span className="font-bold">
                            {scheduleToDelete?.accessDate && format(new Date(scheduleToDelete.accessDate), "PPP")}
                        </span>
                        ?
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setScheduleToDelete(null)}>
                            Cancel
                        </Button>
                        <Button variant="destructive" onClick={confirmDelete} disabled={loading}>
                            {loading ? "Deleting..." : "Delete"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
