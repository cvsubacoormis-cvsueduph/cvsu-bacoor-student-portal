"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { createAcademicTerm } from "@/actions/academic-terms";
import { Loader2, Plus } from "lucide-react";

const formSchema = z.object({
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
    ] as const, {
        required_error: "Please select an academic year",
    }),
    semester: z.enum(["FIRST", "SECOND", "MIDYEAR"] as const, {
        required_error: "Please select a semester",
    }),
});

export function CreateTermDialog() {
    const [open, setOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setIsSubmitting(true);
        try {
            const result = await createAcademicTerm(values);
            if (result.success) {
                toast.success(result.message);
                setOpen(false);
                form.reset();
            } else {
                toast.error(result.message);
            }
        } catch (error) {
            toast.error("Something went wrong");
        } finally {
            setIsSubmitting(false);
        }
    }

    // Helper to format AY enum to readable string
    const formatAY = (ay: string) => {
        return ay.replace("AY_", "AY ").replace("_", "-");
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button size="sm" className="gap-2 bg-blue-700 hover:bg-blue-600">
                    <Plus className="h-4 w-4" />
                    Create Term
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Create Academic Term</DialogTitle>
                    <DialogDescription>
                        Add a new Academic Year and Semester to the system. This allows grades and offerings to be created for this term.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="academicYear"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Academic Year</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Year" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {formSchema.shape.academicYear.options.map((option) => (
                                                <SelectItem key={option} value={option}>
                                                    {formatAY(option)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="semester"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Semester</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select Semester" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="FIRST">First Semester</SelectItem>
                                            <SelectItem value="SECOND">Second Semester</SelectItem>
                                            <SelectItem value="MIDYEAR">Midyear</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <DialogFooter>
                            <Button type="submit" disabled={isSubmitting} className="bg-blue-700 hover:bg-blue-600">
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Term
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
