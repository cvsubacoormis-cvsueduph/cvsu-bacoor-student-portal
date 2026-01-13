"use client";

import { useState, useEffect } from "react";
import { FailedLog, resolveGradeLog } from "@/actions/logs";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { GradeData } from "@/actions/grades";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useDebounce } from "use-debounce";

const formSchema = z.object({
    studentNumber: z.string().min(1, "Student number is required"),
    courseCode: z.string().min(1, "Course code is required"),
    grade: z.string().min(1, "Grade is required"),
    remarks: z.string().optional(),
    instructor: z.string().min(1, "Instructor is required"),
    academicYear: z.enum([
        "AY_2019_2020",
        "AY_2020_2021",
        "AY_2021_2022",
        "AY_2022_2023",
        "AY_2023_2024",
        "AY_2024_2025",
        "AY_2025_2026",
        "AY_2026_2027",
        "AY_2027_2028",
        "AY_2028_2029",
        "AY_2029_2030",
        "AY_2030_2031",
        "AY_2031_2032",
        "AY_2032_2033",
        "AY_2033_2034",
        "AY_2034_2035",
        "AY_2035_2036",
        "AY_2036_2037",
        "AY_2037_2038",
        "AY_2038_2039",
        "AY_2039_2040",
    ] as const),
    semester: z.enum(["FIRST", "SECOND", "MIDYEAR"] as const),
    courseTitle: z.string().min(1, "Course title is required"),
    creditUnit: z.coerce.number().min(0, "Credit unit must be a number"),
});

interface LogsTableProps {
    initialLogs: FailedLog[];
}

export function LogsTable({ initialLogs }: LogsTableProps) {
    const [logs, setLogs] = useState<FailedLog[]>(initialLogs);
    const [selectedLog, setSelectedLog] = useState<FailedLog | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [search, setSearch] = useState(searchParams.get("search") || "");
    const [debouncedSearch] = useDebounce(search, 500);
    const [academicYear, setAcademicYear] = useState(
        searchParams.get("academicYear") || "ALL"
    );
    const [semester, setSemester] = useState(searchParams.get("semester") || "ALL");

    useEffect(() => {
        const params = new URLSearchParams(searchParams);
        if (debouncedSearch) {
            params.set("search", debouncedSearch);
        } else {
            params.delete("search");
        }
        if (academicYear && academicYear !== "ALL") {
            params.set("academicYear", academicYear);
        } else {
            params.delete("academicYear");
        }
        if (semester && semester !== "ALL") {
            params.set("semester", semester);
        } else {
            params.delete("semester");
        }
        router.replace(`${pathname}?${params.toString()}`);
    }, [debouncedSearch, academicYear, semester, pathname, router, searchParams]);

    useEffect(() => {
        setLogs(initialLogs);
    }, [initialLogs]);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            studentNumber: "",
            courseCode: "",
            grade: "",
            remarks: "",
            instructor: "",
            courseTitle: "",
            creditUnit: 0,
        },
    });

    const handleResolveClick = (log: FailedLog) => {
        setSelectedLog(log);
        form.reset({
            studentNumber: log.studentNumber,
            courseCode: log.courseCode,
            grade: log.grade,
            remarks: log.remarks || "",
            instructor: log.instructor,
            academicYear: log.academicYear as any,
            semester: log.semester as any,
            courseTitle: log.courseTitle,
            creditUnit: log.creditUnit,
        });
        setIsOpen(true);
    };

    const onSubmit = async (values: z.infer<typeof formSchema>) => {
        if (!selectedLog) return;

        try {
            const gradeData: GradeData = {
                ...values,
                reExam: undefined,
                firstName: "",
                lastName: "",
                isResolved: false
            };

            await resolveGradeLog(selectedLog.id, gradeData);
            toast.success("Grade resolved successfully");
            setIsOpen(false);

            // Optimistic update or refresh
            setLogs((prev) => prev.filter((l) => l.id !== selectedLog.id));
            router.refresh();
        } catch (error) {
            console.error(error);
            toast.error("Failed to resolve grade");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <Input
                    placeholder="Search logs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                />
                <div className="flex gap-2">
                    <Select
                        value={academicYear}
                        onValueChange={setAcademicYear}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Academic Year" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Years</SelectItem>
                            <SelectItem value="AY_2023_2024">AY 2023-2024</SelectItem>
                            <SelectItem value="AY_2024_2025">AY 2024-2025</SelectItem>
                            {/* Add more years as needed or map from enum */}
                        </SelectContent>
                    </Select>
                    <Select
                        value={semester}
                        onValueChange={setSemester}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Semester" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Semesters</SelectItem>
                            <SelectItem value="FIRST">First Semester</SelectItem>
                            <SelectItem value="SECOND">Second Semester</SelectItem>
                            <SelectItem value="MIDYEAR">Midyear</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Student Number</TableHead>
                            <TableHead>Course Code</TableHead>
                            <TableHead>Course Title</TableHead>
                            <TableHead>Grade</TableHead>
                            <TableHead>Remarks</TableHead>
                            <TableHead>Error</TableHead>
                            <TableHead>Action</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {logs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={8} className="text-center">
                                    No failed logs found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>
                                        {new Date(log.performedAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <div>{log.studentNumber}</div>
                                        {log.importedName && log.studentNumber === "UNKNOWN" && (
                                            <div className="text-xs text-blue-600 font-medium">{log.importedName}</div>
                                        )}
                                    </TableCell>
                                    <TableCell>{log.courseCode}</TableCell>
                                    <TableCell>{log.courseTitle}</TableCell>
                                    <TableCell>{log.grade}</TableCell>
                                    <TableCell>{log.remarks}</TableCell>
                                    <TableCell className="text-red-500 font-medium">
                                        {log.action}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleResolveClick(log)}
                                        >
                                            Resolve
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Resolve Failed Upload</DialogTitle>
                        <DialogDescription>
                            Correct the details below to re-upload the grade.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="studentNumber"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Student Number</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="courseCode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Course Code</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="grade"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Grade</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select grade" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="1.00">1.00</SelectItem>
                                                    <SelectItem value="1.25">1.25</SelectItem>
                                                    <SelectItem value="1.50">1.50</SelectItem>
                                                    <SelectItem value="1.75">1.75</SelectItem>
                                                    <SelectItem value="2.00">2.00</SelectItem>
                                                    <SelectItem value="2.25">2.25</SelectItem>
                                                    <SelectItem value="2.50">2.50</SelectItem>
                                                    <SelectItem value="2.75">2.75</SelectItem>
                                                    <SelectItem value="3.00">3.00</SelectItem>
                                                    <SelectItem value="4.00">4.00</SelectItem>
                                                    <SelectItem value="5.00">5.00</SelectItem>
                                                    <SelectItem value="INC">INC</SelectItem>
                                                    <SelectItem value="DRP">DRP</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="remarks"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Remarks</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select remarks" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="PASSED">PASSED</SelectItem>
                                                    <SelectItem value="FAILED">FAILED</SelectItem>
                                                    <SelectItem value="LACK OF REQ.">LACK OF REQ.</SelectItem>
                                                    <SelectItem value="DROPPED">DROPPED</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={form.control}
                                    name="courseTitle"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Course Title</FormLabel>
                                            <FormControl>
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="creditUnit"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Credit Unit</FormLabel>
                                            <Select onValueChange={(value) => field.onChange(parseFloat(value))} value={field.value?.toString()}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Select credit unit" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="1">1</SelectItem>
                                                    <SelectItem value="2">2</SelectItem>
                                                    <SelectItem value="3">3</SelectItem>
                                                    <SelectItem value="4">4</SelectItem>
                                                    <SelectItem value="5">5</SelectItem>
                                                    <SelectItem value="6">6</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="instructor"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Instructor</FormLabel>
                                        <FormControl>
                                            <Input {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="submit">Re-upload</Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
