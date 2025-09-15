"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getCurriculumChecklist } from "@/actions/curriculum-actions";
import { CurriculumItem } from "@/lib/types";
import { getStudentData } from "@/actions/getStudentData";

export default function PrintChecklist() {
  const router = useRouter();
  const [checklistData, setChecklistData] = useState<CurriculumItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentData, setStudentData] = useState<{
    fullName: string;
    studentNumber: string;
    address: string;
    phone: string;
    course: string;
    major: string | null;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const student = await getStudentData();

        setStudentData({
          fullName: `${student.firstName} ${student.middleInit} ${student.lastName}`,
          studentNumber: student.studentNumber,
          address: student.address || "",
          phone: student.phone || "",
          course: student.course,
          major: student.major,
        });

        const curriculum = await getCurriculumChecklist(
          student.course,
          student.major
        );

        const curriculumWithGrades = curriculum.map((item) => {
          const gradeInfo = student.grades.find(
            (g) => g.courseCode === item.courseCode
          );
          return {
            ...item,
            grade: gradeInfo?.grade || "",
            instructor: gradeInfo?.instructor || "", // Now using actual instructor field
            academicYear: gradeInfo?.academicYear || "",
            semesterTaken: gradeInfo?.semester || "",
          };
        });

        setChecklistData(curriculumWithGrades);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    const handlePrint = () => {
      if (studentData?.fullName) {
        document.title = `${studentData.fullName} - Checklist of Courses`;
      }
      const printTimeout = setTimeout(() => {
        const cleanup = () => {
          window.removeEventListener("afterprint", handleAfterPrint);
          clearTimeout(fallbackTimeout);
        };

        const handleAfterPrint = () => {
          cleanup();
          router.back();
        };

        const fallbackTimeout = setTimeout(() => {
          cleanup();
          router.back();
        }, 3000); // Fallback after 5 seconds

        window.addEventListener("afterprint", handleAfterPrint);
        window.print();
      }, 3500);

      return () => clearTimeout(printTimeout);
    };

    handlePrint();
  }, [studentData, router]);

  const hasMidYear = (yearLevel: string) => {
    return checklistData.some(
      (item) => item.yearLevel === yearLevel && item.semester === "MIDYEAR"
    );
  };

  const getCourseTitle = () => {
    if (!studentData) return "";

    switch (studentData.course) {
      case "BSCS":
        return "BACHELOR OF SCIENCE IN COMPUTER SCIENCE";
      case "BSIT":
        return "BACHELOR OF SCIENCE IN INFORMATION TECHNOLOGY";
      case "BSHM":
        return "BACHELOR OF SCIENCE IN HOSPITALITY MANAGEMENT";
      case "BSCRIM":
        return "BACHELOR OF SCIENCE IN CRIMINOLOGY";
      case "BSP":
        return "BACHELOR OF SCIENCE IN PSYCHOLOGY";
      case "BSBA":
        if (studentData.major === "MARKETING_MANAGEMENT") {
          return "BACHELOR OF SCIENCE IN BUSINESS ADMINISTRATION - MARKETING MANAGEMENT";
        } else if (studentData.major === "HUMAN_RESOURCE_MANAGEMENT") {
          return "BACHELOR OF SCIENCE IN BUSINESS ADMINISTRATION - HUMAN RESOURCE MANAGEMENT";
        }
        return "BACHELOR OF SCIENCE IN BUSINESS ADMINISTRATION";
      case "BSED":
        if (studentData.major === "ENGLISH") {
          return "BACHELOR OF SCIENCE IN SECONDARY EDUCATION - Major in English";
        } else if (studentData.major === "MATH") {
          return "BACHELOR OF SCIENCE IN SECONDARY EDUCATION - Major in Mathematics";
        }
        return "BACHELOR OF SCIENCE IN SECONDARY EDUCATION";
      default:
        return "";
    }
  };
  return (
    <div>
      <div
        id="checklist-container"
        className="pt-[10px] h-[2,480px] w-[3,508px]"
      >
        <div className="flex items-center mb-2 justify-center">
          <Image src="/logo.png" alt="CSU Logo" width={50} height={50} />
          <div className="text-center ml-[10px]">
            <p className="text-[12px]">Republic of the Philippines</p>
            <h1 className="text-[12px] font-bold uppercase">
              Cavite State University
            </h1>
            <p className="text-[12px]">Bacoor City Campus</p>
            <p className="font-semibold text-[12px] uppercase">
              {getCourseTitle()}
            </p>
            <h1 className="text-sm font-bold uppercase">
              Checklist of Courses
            </h1>
          </div>
        </div>

        <table className="w-full mb-3">
          <tbody>
            <tr>
              <td className="text-[10px]">
                Name of Student : {studentData?.fullName}
              </td>
              <td className="text-[10px]">Date of Admission :</td>
            </tr>
            <tr>
              <td className="text-[10px]">
                Student Number : {studentData?.studentNumber}
              </td>
              <td className="text-[10px]">
                Contact Number : {studentData?.phone}
              </td>
            </tr>
            <tr>
              <td className="text-[10px]">Address : {studentData?.address}</td>
              <td className="text-[10px]">Name of Adviser :</td>
            </tr>
          </tbody>
        </table>

        <table className="border-collapse w-full">
          <thead>
            <tr>
              <th
                rowSpan={2}
                className="border border-black w-[80px] text-center text-[10px]"
              >
                Course Code
              </th>
              <th
                rowSpan={2}
                className="border border-black w-[900px] text-center text-[14px]"
              >
                Course Title
              </th>
              <th
                colSpan={2}
                className="border border-black text-center text-[10px]"
              >
                Credit Unit
              </th>
              <th
                colSpan={2}
                className="border border-black text-center text-[10px]"
              >
                Contact Hrs
              </th>
              <th
                rowSpan={2}
                className="border border-black w-[250px] text-center text-[11px]"
              >
                Pre-Requisite
              </th>
              <th
                rowSpan={2}
                className="border border-black w-[70px] text-center text-[10px]"
              >
                SEMESTER / SY TAKEN
              </th>
              <th
                rowSpan={2}
                className="border border-black w-[45px] text-center text-[10px]"
              >
                Final Grade
              </th>
              <th
                rowSpan={2}
                className="border border-black w-[500px] text-center text-[14px]"
              >
                Instructor
              </th>
            </tr>
            <tr>
              <th className="border border-black text-center text-[10px]">
                Lec
              </th>
              <th className="border border-black text-center text-[10px]">
                Lab
              </th>
              <th className="border border-black text-center text-[10px]">
                Lec
              </th>
              <th className="border border-black text-center text-[10px]">
                Lab
              </th>
            </tr>
          </thead>
          <tbody>
            {["FIRST", "SECOND", "THIRD", "FOURTH"].map((yearLevel) => (
              <React.Fragment key={yearLevel}>
                <tr>
                  <td
                    colSpan={10}
                    className="text-center font-bold text-[10px] pt-[10px]"
                  >
                    {yearLevel === "FIRST" && "First Year"}
                    {yearLevel === "SECOND" && "Second Year"}
                    {yearLevel === "THIRD" && "Third Year"}
                    {yearLevel === "FOURTH" && "Fourth Year"}
                  </td>
                </tr>
                {["FIRST", "SECOND"].map((semester) => (
                  <React.Fragment key={`${yearLevel}-${semester}`}>
                    <tr>
                      <td colSpan={10} className="text-left text-[10px] p-2">
                        {semester === "FIRST" && "First Semester"}
                        {semester === "SECOND" && "Second Semester"}
                      </td>
                    </tr>
                    {checklistData
                      .filter(
                        (item: CurriculumItem) =>
                          item.yearLevel === yearLevel &&
                          item.semester === semester
                      )
                      .map((item) => (
                        <tr key={item.id}>
                          <td className="border border-black text-center text-[8px]">
                            {item.courseCode}
                          </td>
                          <td className="border border-black text-[8px]">
                            {item.courseTitle}
                          </td>
                          <td className="border border-black text-center text-[8px]">
                            {item.creditUnit.lec}
                          </td>
                          <td className="border border-black text-center text-[8px]">
                            {item.creditUnit.lab}
                          </td>
                          <td className="border border-black text-center text-[8px]">
                            {item.contactHrs.lec}
                          </td>
                          <td className="border border-black text-center text-[8px]">
                            {item.contactHrs.lab}
                          </td>
                          <td className="border border-black text-center text-[8px]">
                            {item.preRequisite || "-"}
                          </td>
                          <td className="border border-black text-center text-[8px]">
                            {item.semesterTaken && item.academicYear
                              ? `${
                                  item.semesterTaken === "FIRST"
                                    ? "First semester"
                                    : item.semesterTaken === "SECOND"
                                    ? "Second semester"
                                    : item.semesterTaken === "MIDYEAR"
                                    ? "Mid year"
                                    : item.semesterTaken
                                } ${item.academicYear}`
                              : "-"}
                          </td>
                          <td className="border border-black text-center text-[8px]">
                            {item.grade || "-"}
                          </td>
                          <td className="border border-black text-center text-[8px]">
                            {item.instructor || "-"}
                          </td>
                        </tr>
                      ))}
                  </React.Fragment>
                ))}
                {hasMidYear(yearLevel) && (
                  <React.Fragment key={`${yearLevel}-MIDYEAR`}>
                    <tr>
                      <td colSpan={10} className="text-left text-[10px] p-2">
                        Mid-year
                      </td>
                    </tr>
                    {checklistData
                      .filter(
                        (item) =>
                          item.yearLevel === yearLevel &&
                          item.semester === "MIDYEAR"
                      )
                      .map((item) => (
                        <tr key={item.id}>
                          <td className="border border-black text-center text-[8px]">
                            {item.courseCode}
                          </td>
                          <td className="border border-black text-[8px]">
                            {item.courseTitle}
                          </td>
                          <td className="border border-black text-center text-[8px]">
                            {item.creditUnit.lec}
                          </td>
                          <td className="border border-black text-center text-[8px]">
                            {item.creditUnit.lab}
                          </td>
                          <td className="border border-black text-center text-[8px]">
                            {item.contactHrs.lec}
                          </td>
                          <td className="border border-black text-center text-[8px]">
                            {item.contactHrs.lab}
                          </td>
                          <td className="border border-black text-center text-[8px]">
                            {item.preRequisite || "-"}
                          </td>
                          <td className="border border-black text-center text-[8px]"></td>
                          <td className="border border-black text-center text-[8px]">
                            {item.grade || "-"}
                          </td>
                          <td className="border border-black text-center text-[8px]"></td>
                        </tr>
                      ))}
                  </React.Fragment>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
