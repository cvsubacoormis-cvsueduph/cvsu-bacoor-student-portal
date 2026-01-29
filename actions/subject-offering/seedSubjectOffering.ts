"use server";

import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { AcademicYear, Courses, Major, Semester } from "@prisma/client";

interface SeedInput {
  academicYear: AcademicYear;
  semester: Semester;
  courseMajorMap: Record<Courses, Major[]>;
  manualOverrides: string[];
}

export async function seedSubjectOffering({
  academicYear,
  semester,
  courseMajorMap,
  manualOverrides,
}: SeedInput): Promise<{ type: string; message: string }[]> {
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const logs: { type: string; message: string }[] = [];

  logs.push({
    type: "info",
    message: `🚀 Seeding offerings for ${academicYear} - ${semester}...`,
  });

  for (const [course, majors] of Object.entries(courseMajorMap) as [
    Courses,
    Major[]
  ][]) {
    for (const major of majors) {
      const checklistSubjects = await prisma.curriculumChecklist.findMany({
        where: {
          course,
          major,
        },
      });

      for (const subject of checklistSubjects) {
        const isNormalSemester = subject.semester === semester;
        const normalizedOverrides = manualOverrides.map((m) =>
          m.toUpperCase().replace(/\s+/g, "")
        );
        const normalizedSubjectCode = subject.courseCode
          .toUpperCase()
          .replace(/\s+/g, "");
        const isManuallyIncluded =
          normalizedOverrides.includes(normalizedSubjectCode);

        if (!isNormalSemester && !isManuallyIncluded) continue;

        const alreadyOffered = await prisma.subjectOffering.findFirst({
          where: {
            academicYear,
            semester,
            curriculumId: subject.id,
          },
        });

        if (!alreadyOffered) {
          await prisma.subjectOffering.create({
            data: {
              academicYear,
              semester,
              curriculumId: subject.id,
              isActive: true,
            },
          });

          logs.push({
            type: "success",
            message: isManuallyIncluded
              ? `✅ [PETITION] Offered ${subject.courseCode} (${course}${major !== "NONE" ? ` - ${major}` : ""
              }) in ${semester} — originally ${subject.semester}`
              : `✅ Offered ${subject.courseCode} (${course}${major !== "NONE" ? ` - ${major}` : ""
              }) in ${semester}`,
          });
        } else {
          logs.push({
            type: "warning",
            message: `⏭️ Already exists: ${subject.courseCode} (${course}${major !== "NONE" ? ` - ${major}` : ""
              })`,
          });
        }
      }
    }
  }

  logs.push({
    type: "success",
    message: "✅ Subject offering seeding completed.",
  });

  return logs;
}
