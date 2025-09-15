"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export default function PrintGradesSelector() {
  // State to store the selected academic year and semester
  const [academicYear, setAcademicYear] = useState("");
  const [semester, setSemester] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [purpose, setPurpose] = useState("");

  return (
    <div className="bg-white p-4 rounded-md flex-1 m-4 mt-0">
      <h1 className="hidden md:block text-lg font-semibold">Print Grades</h1>
      <span className="text-xs flex text-gray-500 font-semibold">
        Print your grades
      </span>
      <div className="mt-4 flex flex-row gap-4 items-center">
        <div>
          <h1 className="text-sm font-semibold mb-2">Select Academic Year</h1>
          <Select onValueChange={(value) => setAcademicYear(value)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Academic Year" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Academic Year</SelectLabel>
                <SelectItem value="AY_2024_2025">2024-2025</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div>
          <h1 className="text-sm font-semibold mb-2">Select Semester</h1>
          <Select onValueChange={(value) => setSemester(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Semester" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Semester</SelectLabel>
                <SelectItem value="FIRST">FIRST</SelectItem>
                <SelectItem value="SECOND">SECOND</SelectItem>
                <SelectItem value="MIDYEAR">MID YEAR</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div>
          <h1 className="text-sm font-semibold mb-2">Select Year Level</h1>
          <Select onValueChange={(value) => setYearLevel(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Year Level" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Year Level</SelectLabel>
                <SelectItem value="FIRST YEAR">FIRST</SelectItem>
                <SelectItem value="SECOND YEAR">SECOND</SelectItem>
                <SelectItem value="THIRD YEAR">THIRD</SelectItem>
                <SelectItem value="FOURTH YEAR">FOURTH</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div>
          <h1 className="text-sm font-semibold mb-2">Select Purpose</h1>
          <Select onValueChange={(value) => setPurpose(value)}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Purpose" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Purpose</SelectLabel>
                <SelectItem value="ENROLLMENT/EVALUATION PURPOSES">
                  ENROLLMENT/EVALUATION PURPOSES
                </SelectItem>
                <SelectItem value="WORK PURPOSES">WORK PURPOSES</SelectItem>
                <SelectItem value="SCHOLARSHIP">SCHOLARSHIP</SelectItem>
                <SelectItem value="PERSONAL COPY">PERSONAL COPY</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        {/* Only enable the button when both values are selected */}
        <Button
          className="w-[120px] mt-7 bg-blue-500 hover:bg-blue-700"
          disabled={!academicYear || !semester || !yearLevel || !purpose}
        >
          <Link
            href={`/printgrades?academicYear=${encodeURIComponent(
              academicYear
            )}&semester=${encodeURIComponent(
              semester
            )}&yearLevel=${encodeURIComponent(
              yearLevel
            )}&purpose=${encodeURIComponent(purpose)}`}
          >
            Print Grades
          </Link>
        </Button>
      </div>
      <span className="text-sm mt-2 font-semibold underline">
        Note: Year Level is based on your current year standing only
      </span>
    </div>
  );
}
