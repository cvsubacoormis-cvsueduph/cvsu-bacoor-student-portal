import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import * as React from "react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrinterIcon } from "lucide-react";
import Link from "next/link";
// Define the props for SelectToPrint including studentId
export type SelectToPrintProps = {
  studentId: string;
};

export function SelectToPrint({ studentId }: SelectToPrintProps) {
  const [academicYear, setAcademicYear] = React.useState("");
  const [semester, setSemester] = React.useState("");
  const [yearLevel, setYearLevel] = React.useState("");
  const [purpose, setPurpose] = React.useState("");

  return (
    <div>
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline" className="border-none rounded-full">
            <PrinterIcon className="w-4 h-4" />
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Print Grades</DialogTitle>
            <DialogDescription>Print student grades.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Your selection fields for academicYear, semester, yearLevel, and purpose */}
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Academic Year</Label>
              <Select onValueChange={(value) => setAcademicYear(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Academic Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AY_2024_2025">2024-2025</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Semester</Label>
              <Select onValueChange={(value) => setSemester(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Semester" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIRST">FIRST SEMESTER</SelectItem>
                  <SelectItem value="SECOND">SECOND SEMESTER</SelectItem>
                  <SelectItem value="MIDYEAR">MIDYEAR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Year Level</Label>
              <Select onValueChange={(value) => setYearLevel(value)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select Year Level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FIRST YEAR">FIRST YEAR</SelectItem>
                  <SelectItem value="SECOND YEAR">SECOND YEAR</SelectItem>
                  <SelectItem value="THIRD YEAR">THIRD YEAR</SelectItem>
                  <SelectItem value="FOURTH YEAR">FOURTH YEAR</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label className="text-right">Purpose</Label>
              <Input
                id="purpose"
                className="w-[180px] text-sm"
                placeholder="Enter purpose"
                onChange={(e) => setPurpose(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              className="w-[120px] mt-7 bg-blue-700 hover:bg-blue-900"
              disabled={
                !academicYear ||
                !semester ||
                !yearLevel ||
                !purpose ||
                !studentId
              }
            >
              <Link
                href={`/printgrades-list?academicYear=${academicYear}&semester=${semester}&yearLevel=${yearLevel}&purpose=${purpose}&studentId=${studentId}`}
              >
                Print Grades
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
