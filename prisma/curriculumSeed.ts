import { curriculumChecklistData } from "./curriculum";
import { Major, PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding Curriculum Checklist...");

  for (const subject of curriculumChecklistData) {
    const existing = await prisma.curriculumChecklist.findFirst({
      where: {
        course: subject.course,
        yearLevel: subject.yearLevel,
        semester: subject.semester,
        courseCode: subject.courseCode,
        major: subject.major as Major,
      },
    });

    if (existing) {
      await prisma.curriculumChecklist.update({
        where: { id: existing.id },
        data: {
          courseTitle: subject.courseTitle,
          creditLec: subject.creditLec,
          creditLab: subject.creditLab,
          preRequisite: subject.preRequisite,
        },
      });
    } else {
      await prisma.curriculumChecklist.create({
        data: {
          course: subject.course,
          yearLevel: subject.yearLevel,
          semester: subject.semester,
          courseCode: subject.courseCode,
          courseTitle: subject.courseTitle,
          major: subject.major as Major,
          creditLec: subject.creditLec,
          creditLab: subject.creditLab,
          preRequisite: subject.preRequisite,
        },
      });
    }
  }

  console.log("✅ Done seeding Curriculum Checklist.");
}

main()
  .catch((e) => {
    console.error("❌ Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
