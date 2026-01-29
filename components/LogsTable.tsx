"use client";

import { useState, useEffect } from "react";
import { FailedLog, resolveGradeLog, LogsMetadata } from "@/actions/logs";
import { AcademicTerm } from "@prisma/client";
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
import { ChevronLeft, ChevronRight, CheckSquare, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { bulkResolveLogs } from "@/actions/logs";

const formSchema = z.object({
    studentNumber: z.string().min(1, "Student Number: Please enter the student's ID number."),
    courseCode: z.string().min(1, "Course Code: Please enter the course code (e.g., COSC 101)."),
    grade: z.string().min(1, "Grade: Please select a grade."),
    remarks: z.string().optional(),
    instructor: z.string().min(1, "Instructor: Please enter the instructor's name."),
    academicYear: z.enum([
        "AY_2014_2015",
        "AY_2015_2016",
        "AY_2016_2017",
        "AY_2017_2018",
        "AY_2018_2019",
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
    ] as const, {
        required_error: "Academic Year: Please select an academic year.",
    }),
    semester: z.enum(["FIRST", "SECOND", "MIDYEAR"] as const, {
        required_error: "Semester: Please select a semester.",
    }),
    courseTitle: z.string().min(1, "Course Title: Please enter the descriptive title of the course."),
    creditUnit: z.coerce.number().min(0, "Credit Unit: Please enter a valid number (0 or more)."),
});

interface LogsTableProps {
    initialLogs: FailedLog[];
    metadata: LogsMetadata;
    initialTerms: AcademicTerm[];
}

export function LogsTable({ initialLogs, metadata, initialTerms }: LogsTableProps) {
    const [logs, setLogs] = useState<FailedLog[]>(initialLogs);
    const [selectedLog, setSelectedLog] = useState<FailedLog | null>(null);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedLogIds, setSelectedLogIds] = useState<Set<string>>(new Set());
    const [isBulkResolving, setIsBulkResolving] = useState(false);
    const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    const [search, setSearch] = useState(searchParams.get("search") || "");
    const [debouncedSearch] = useDebounce(search, 500);
    const [academicYear, setAcademicYear] = useState(
        searchParams.get("academicYear") || "ALL"
    );
    const [semester, setSemester] = useState(searchParams.get("semester") || "ALL");
    const [page, setPage] = useState(metadata.page);

    useEffect(() => {
        const params = new URLSearchParams(searchParams);

        // Reset to page 1 on filter change
        if (debouncedSearch !== (searchParams.get("search") || "")) {
            params.set("page", "1");
        }

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

    const handlePageChange = (newPage: number) => {
        const params = new URLSearchParams(searchParams);
        params.set("page", newPage.toString());
        router.replace(`${pathname}?${params.toString()}`);
    };

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

    // Schema for Bulk Edit (All optional)
    const bulkFormSchema = z.object({
        courseCode: z.string().optional(),
        academicYear: z.enum([
            "AY_2014_2015", "AY_2015_2016", "AY_2016_2017", "AY_2017_2018", "AY_2018_2019", "AY_2019_2020",
            "AY_2020_2021", "AY_2021_2022", "AY_2022_2023", "AY_2023_2024", "AY_2024_2025", "AY_2025_2026",
            "AY_2026_2027", "AY_2027_2028", "AY_2028_2029", "AY_2029_2030", "AY_2030_2031", "AY_2031_2032",
            "AY_2032_2033", "AY_2033_2034", "AY_2034_2035", "AY_2035_2036", "AY_2036_2037", "AY_2037_2038",
            "AY_2038_2039", "AY_2039_2040",
        ] as const).optional(),
        semester: z.enum(["FIRST", "SECOND", "MIDYEAR"] as const).optional(),
        instructor: z.string().optional(),
    });

    const bulkForm = useForm<z.infer<typeof bulkFormSchema>>({
        resolver: zodResolver(bulkFormSchema),
    });

    const onBulkSubmit = async (values: z.infer<typeof bulkFormSchema>) => {
        setIsBulkResolving(true);
        // Clean up undefined values
        const overrides: Partial<GradeData> = {};
        if (values.courseCode && values.courseCode.trim() !== "") overrides.courseCode = values.courseCode;
        if (values.academicYear) overrides.academicYear = values.academicYear;
        if (values.semester) overrides.semester = values.semester;
        if (values.instructor && values.instructor.trim() !== "") overrides.instructor = values.instructor;

        try {
            const result = await bulkResolveLogs(Array.from(selectedLogIds), overrides);

            if (result.failureCount === 0) {
                toast.success(`Success: All ${result.successCount} logs were resolved successfully.`);
            } else {
                const failureDetails = result.failures
                    .slice(0, 3)
                    .map(f => `• ${f.error} (Student: ${f.studentNumber})`)
                    .join("\n");

                const moreCount = result.failureCount - 3;
                const description = failureDetails + (moreCount > 0 ? `\n...and ${moreCount} more.` : "");

                toast.warning(`Partial Success: Resolved ${result.successCount}. Failed ${result.failureCount}.`, {
                    description: <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4 overflow-x-auto text-xs text-white">{description}</pre>,
                    duration: 5000,
                });
                console.error("Failed logs:", result.failures);
            }

            // Refresh logic
            setSelectedLogIds(new Set());
            setLogs((prev) => prev.filter((l) => !selectedLogIds.has(l.id) || result.failures.some(f => f.id === l.id)));
            setIsBulkEditOpen(false);
            router.refresh();

        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "An unexpected error occurred during bulk resolution.");
        } finally {
            setIsBulkResolving(false);
        }
    };

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
            router.refresh();
        } catch (error: any) {
            console.error(error);
            toast.error(error.message || "Failed to resolve grade. Please check your inputs.");
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <Input
                    placeholder="Search logs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <div className="flex gap-2 items-center">
                    {selectedLogIds.size > 0 && (
                        <div className="flex gap-2">
                            <Button
                                variant="secondary"
                                size="sm"
                                disabled={isBulkResolving}
                                onClick={() => setIsBulkEditOpen(true)}
                            >
                                Bulk Edit & Resolve
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={async () => {
                                    setIsBulkResolving(true);
                                    try {
                                        const result = await bulkResolveLogs(Array.from(selectedLogIds));

                                        if (result.failureCount === 0) {
                                            toast.success(`Success: All ${result.successCount} logs were resolved successfully.`);
                                        } else {
                                            const failureDetails = result.failures
                                                .slice(0, 3)
                                                .map(f => `• ${f.error} (Student: ${f.studentNumber})`)
                                                .join("\n");

                                            const moreCount = result.failureCount - 3;
                                            const description = failureDetails + (moreCount > 0 ? `\n...and ${moreCount} more.` : "");

                                            toast.warning(`Partial Success: Resolved ${result.successCount}. Failed ${result.failureCount}.`, {
                                                description: <pre className="mt-2 w-[340px] rounded-md bg-slate-950 p-4 overflow-x-auto text-xs text-white">{description}</pre>,
                                                duration: 5000,
                                            });
                                            console.error("Failed logs:", result.failures);
                                        }

                                        // Refresh logic
                                        setSelectedLogIds(new Set());
                                        setLogs((prev) => prev.filter((l) => !selectedLogIds.has(l.id) || result.failures.some(f => f.id === l.id)));
                                        router.refresh();

                                    } catch (error: any) {
                                        console.error(error);
                                        toast.error(error.message || "An unexpected error occurred during bulk resolution.");
                                    } finally {
                                        setIsBulkResolving(false);
                                    }
                                }}
                                disabled={isBulkResolving}
                            >
                                {isBulkResolving ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                    <CheckSquare className="mr-2 h-4 w-4" />
                                )}
                                Resolve Selected ({selectedLogIds.size})
                            </Button>
                        </div>
                    )}
                    <Select
                        value={academicYear}
                        onValueChange={setAcademicYear}
                    >
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="Academic Year" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">All Years</SelectItem>
                            {Array.from(new Set(initialTerms.map((t) => t.academicYear))).map((year) => (
                                <SelectItem key={year} value={year}>
                                    {year.replace("AY_", "AY ").replace("_", "-")}
                                </SelectItem>
                            ))}
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
                            {Array.from(new Set(initialTerms.map((t) => t.semester))).map((sem) => (
                                <SelectItem key={sem} value={sem}>
                                    {sem}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-[50px]">
                                <Checkbox
                                    checked={logs.length > 0 && selectedLogIds.size === logs.length}
                                    onCheckedChange={(checked) => {
                                        if (checked) {
                                            setSelectedLogIds(new Set(logs.map((l) => l.id)));
                                        } else {
                                            setSelectedLogIds(new Set());
                                        }
                                    }}
                                />
                            </TableHead>
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
                                <TableCell colSpan={9} className="text-center">
                                    No failed logs found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            logs.map((log) => (
                                <TableRow key={log.id}>
                                    <TableCell>
                                        <Checkbox
                                            checked={selectedLogIds.has(log.id)}
                                            onCheckedChange={(checked) => {
                                                const newSet = new Set(selectedLogIds);
                                                if (checked) {
                                                    newSet.add(log.id);
                                                } else {
                                                    newSet.delete(log.id);
                                                }
                                                setSelectedLogIds(newSet);
                                            }}
                                        />
                                    </TableCell>
                                    <TableCell>
                                        {new Date(log.performedAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell>
                                        <div>{log.studentNumber}</div>
                                        {log.importedName && (
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

            {/* Pagination Controls */}
            <div className="flex items-center justify-between text-sm text-gray-500">
                <div>
                    Showing {Math.min(metadata.total, (metadata.page - 1) * metadata.limit + 1)} to{" "}
                    {Math.min(metadata.total, metadata.page * metadata.limit)} of {metadata.total} entries
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={metadata.page <= 1}
                        onClick={() => handlePageChange(metadata.page - 1)}
                    >
                        <ChevronLeft className="h-4 w-4" />
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={metadata.page >= metadata.totalPages}
                        onClick={() => handlePageChange(metadata.page + 1)}
                    >
                        Next
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
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
                                                    <SelectItem value="S">S</SelectItem>
                                                    <SelectItem value="US">US</SelectItem>
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
                                                    <SelectItem value="S">S</SelectItem>
                                                    <SelectItem value="US">US</SelectItem>
                                                    <SelectItem value="INC">INC</SelectItem>
                                                    <SelectItem value="DRP">DRP</SelectItem>
                                                    <SelectItem value="CON. FAILURE">CON. FAILURE</SelectItem>
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

            <Dialog open={isBulkEditOpen} onOpenChange={setIsBulkEditOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Bulk Edit & Resolve ({selectedLogIds.size} items)</DialogTitle>
                        <DialogDescription>
                            Apply values to all selected logs. Leave fields blank to keep original values.
                            Clicking "Resolve All" will attempt to resolve all selected logs with these changes.
                        </DialogDescription>
                    </DialogHeader>
                    <Form {...bulkForm}>
                        <form onSubmit={bulkForm.handleSubmit(onBulkSubmit)} className="space-y-4">
                            <FormField
                                control={bulkForm.control}
                                name="courseCode"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Course Code (Override)</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Enter Code (e.g. COSC 50)" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <div className="grid grid-cols-2 gap-4">
                                <FormField
                                    control={bulkForm.control}
                                    name="academicYear"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Academic Year (Override)</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Keep Original" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="AY_2014_2015">AY 2014-2015</SelectItem>
                                                    <SelectItem value="AY_2015_2016">AY 2015-2016</SelectItem>
                                                    <SelectItem value="AY_2016_2017">AY 2016-2017</SelectItem>
                                                    <SelectItem value="AY_2017_2018">AY 2017-2018</SelectItem>
                                                    <SelectItem value="AY_2018_2019">AY 2018-2019</SelectItem>
                                                    <SelectItem value="AY_2019_2020">AY 2019-2020</SelectItem>
                                                    <SelectItem value="AY_2020_2021">AY 2020-2021</SelectItem>
                                                    <SelectItem value="AY_2021_2022">AY 2021-2022</SelectItem>
                                                    <SelectItem value="AY_2022_2023">AY 2022-2023</SelectItem>
                                                    <SelectItem value="AY_2023_2024">AY 2023-2024</SelectItem>
                                                    <SelectItem value="AY_2024_2025">AY 2024-2025</SelectItem>
                                                    <SelectItem value="AY_2025_2026">AY 2025-2026</SelectItem>
                                                    <SelectItem value="AY_2026_2027">AY 2026-2027</SelectItem>
                                                    <SelectItem value="AY_2027_2028">AY 2027-2028</SelectItem>
                                                    <SelectItem value="AY_2028_2029">AY 2028-2029</SelectItem>
                                                    <SelectItem value="AY_2029_2030">AY 2029-2030</SelectItem>
                                                    <SelectItem value="AY_2030_2031">AY 2030-2031</SelectItem>
                                                    <SelectItem value="AY_2031_2032">AY 2031-2032</SelectItem>
                                                    <SelectItem value="AY_2032_2033">AY 2032-2033</SelectItem>
                                                    <SelectItem value="AY_2033_2034">AY 2033-2034</SelectItem>
                                                    <SelectItem value="AY_2034_2035">AY 2034-2035</SelectItem>
                                                    <SelectItem value="AY_2035_2036">AY 2035-2036</SelectItem>
                                                    <SelectItem value="AY_2036_2037">AY 2036-2037</SelectItem>
                                                    <SelectItem value="AY_2037_2038">AY 2037-2038</SelectItem>
                                                    <SelectItem value="AY_2038_2039">AY 2038-2039</SelectItem>
                                                    <SelectItem value="AY_2039_2040">AY 2039-2040</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={bulkForm.control}
                                    name="semester"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Semester (Override)</FormLabel>
                                            <Select onValueChange={field.onChange} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Keep Original" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="FIRST">1st Semester</SelectItem>
                                                    <SelectItem value="SECOND">2nd Semester</SelectItem>
                                                    <SelectItem value="MIDYEAR">Midyear</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={bulkForm.control}
                                name="instructor"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Instructor (Override)</FormLabel>
                                        <FormControl>
                                            <Input {...field} placeholder="Enter instructor name to override" />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <DialogFooter>
                                <Button type="submit" disabled={isBulkResolving}>
                                    {isBulkResolving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Resolve All
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
