import {
  PrismaClient,
  AcademicYear,
  Semester,
  Courses,
  Major,
} from "@prisma/client";

const prisma = new PrismaClient();

const targetSemester = "FIRST" as Semester;
const academicYear = "AY_2025_2026" as AcademicYear;

const courseMajorMap: Record<Courses, (Major | null)[]> = {
  BSIT: ["NONE"],
  BSCS: ["NONE"],
  BSCRIM: ["NONE"],
  BSP: ["NONE"],
  BSHM: ["NONE"],
  BSED: ["ENGLISH", "MATHEMATICS"],
  BSBA: ["MARKETING_MANAGEMENT", "HUMAN_RESOURCE_MANAGEMENT"],
};

// ✅ Subjects you want to force into this semester (even if in another semester)
const manualOverrides: string[] = [""];

async function main() {
  console.log(
    `🚀 Seeding offerings for ${academicYear} - ${targetSemester}...`
  );

  for (const [course, majors] of Object.entries(courseMajorMap)) {
    for (const major of majors) {
      const checklistSubjects = await prisma.curriculumChecklist.findMany({
        where: {
          course: course as Courses,
          major: major as Major,
        },
      });

      for (const subject of checklistSubjects) {
        const isNormalSemester = subject.semester === targetSemester;
        const isManuallyIncluded = manualOverrides.includes(subject.courseCode);

        if (!isNormalSemester && !isManuallyIncluded) continue;

        const alreadyOffered = await prisma.subjectOffering.findFirst({
          where: {
            academicYear,
            semester: targetSemester,
            curriculumId: subject.id,
          },
        });

        if (!alreadyOffered) {
          await prisma.subjectOffering.create({
            data: {
              academicYear,
              semester: targetSemester,
              curriculumId: subject.id,
              isActive: true,
            },
          });

          if (isManuallyIncluded) {
            console.log(
              `✅ [PETITION] Offered ${subject.courseCode} (${course}${
                major ? ` - ${major}` : ""
              }) in ${targetSemester} — originally ${subject.semester}`
            );
          } else {
            console.log(
              `✅ Offered ${subject.courseCode} (${course}${
                major ? ` - ${major}` : ""
              }) in ${targetSemester}`
            );
          }
        } else {
          console.log(
            `⏭️ Already exists: ${subject.courseCode} (${course}${
              major ? ` - ${major}` : ""
            })`
          );
        }
      }
    }
  }

  console.log("✅ Subject offering seeding completed.");
}

main()
  .catch((e) => {
    console.error("❌ Error during subject offering seed:", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
