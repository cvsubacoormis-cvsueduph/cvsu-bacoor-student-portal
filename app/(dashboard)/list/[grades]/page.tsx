"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getGrades } from "@/actions/student-grades/student-grades";
import { RedirectToSignIn, SignedIn, SignedOut } from "@clerk/nextjs";
import { GradesPageSkeleton } from "@/components/skeleton/GradesPageSkeleton";
import Grades from "@/components/GradesTable";

export default function GradesPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [grades, setGrades] = useState<any[]>([]);
  const [availableYears, setAvailableYears] = useState<string[]>([]);
  const [availableSemesters, setAvailableSemesters] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const year = searchParams.get("year") || "";
  const semester = searchParams.get("semester") || "";

  useEffect(() => {
    let isMounted = true;
    const fetchAllGrades = async () => {
      try {
        const allGrades = await getGrades(undefined, undefined);
        if (isMounted) {
          setGrades(allGrades);
          setAvailableYears(
            Array.from(new Set(allGrades.map((g) => g.academicYear))).sort(
              (a, b) => b.localeCompare(a)
            )
          );
          setAvailableSemesters(
            Array.from(new Set(allGrades.map((g) => g.semester))).sort(
              (a, b) => {
                const order = { FIRST: 1, SECOND: 2, MIDYEAR: 3 };
                return (
                  (order[a as keyof typeof order] || 4) -
                  (order[b as keyof typeof order] || 4)
                );
              }
            )
          );
          setError(null);
        }
      } catch (err) {
        if (isMounted) {
          setError(
            "Failed to fetch grades data. Please try again in a moment."
          );
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchAllGrades();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleFilterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const params = new URLSearchParams();
    const yearValue = formData.get("year") as string;
    const semesterValue = formData.get("semester") as string;
    if (yearValue) params.set("year", yearValue);
    if (semesterValue) params.set("semester", semesterValue);
    router.push(`?${params.toString()}`);
  };

  if (loading) return <GradesPageSkeleton />;

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <>
      <SignedIn>
        <Grades
          grades={grades}
          availableYears={availableYears}
          availableSemesters={availableSemesters}
          year={year}
          semester={semester}
          handleFilterSubmit={handleFilterSubmit}
        />
      </SignedIn>
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
    </>
  );
}
