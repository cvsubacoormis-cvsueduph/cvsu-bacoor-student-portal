-- CreateEnum
CREATE TYPE "AcademicYear" AS ENUM ('AY_2023_2024', 'AY_2024_2025', 'AY_2025_2026', 'AY_2026_2027', 'AY_2027_2028', 'AY_2028_2029', 'AY_2029_2030', 'AY_2030_2031', 'AY_2031_2032', 'AY_2032_2033', 'AY_2033_2034', 'AY_2034_2035', 'AY_2035_2036', 'AY_2036_2037', 'AY_2037_2038', 'AY_2038_2039', 'AY_2039_2040');

-- CreateEnum
CREATE TYPE "Semester" AS ENUM ('FIRST', 'SECOND', 'MIDYEAR');

-- CreateEnum
CREATE TYPE "Courses" AS ENUM ('BSIT', 'BSCS', 'BSCRIM', 'BSP', 'BSHM', 'BSED', 'BSBA');

-- CreateEnum
CREATE TYPE "yearLevels" AS ENUM ('FIRST', 'SECOND', 'THIRD', 'FOURTH');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('REGULAR', 'IRREGULAR', 'NOT_ANNOUNCED', 'TRANSFEREE', 'RETURNEE');

-- CreateEnum
CREATE TYPE "Major" AS ENUM ('HUMAN_RESOURCE_MANAGEMENT', 'MARKETING_MANAGEMENT', 'ENGLISH', 'MATHEMATICS', 'NONE');

-- CreateEnum
CREATE TYPE "UserSex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'student', 'superuser', 'faculty', 'registrar');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleInit" TEXT,
    "lastName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT NOT NULL,
    "birthday" TEXT NOT NULL,
    "sex" "UserSex" NOT NULL,
    "username" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'admin',

    CONSTRAINT "Admin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleInit" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT NOT NULL,
    "sex" "UserSex" NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "middleInit" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT NOT NULL,
    "sex" "UserSex" NOT NULL,
    "course" "Courses" NOT NULL,
    "major" "Major",
    "status" "Status" NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'student',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPasswordSet" BOOLEAN NOT NULL DEFAULT false,
    "isApproved" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CurriculumChecklist" (
    "id" TEXT NOT NULL,
    "course" "Courses" NOT NULL,
    "major" "Major" NOT NULL,
    "yearLevel" "yearLevels" NOT NULL,
    "semester" "Semester" NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "creditLec" INTEGER NOT NULL DEFAULT 0,
    "creditLab" INTEGER NOT NULL DEFAULT 0,
    "preRequisite" TEXT,

    CONSTRAINT "CurriculumChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectOffering" (
    "id" TEXT NOT NULL,
    "academicYear" "AcademicYear" NOT NULL,
    "semester" "Semester" NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "SubjectOffering_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AcademicTerm" (
    "id" TEXT NOT NULL,
    "academicYear" "AcademicYear" NOT NULL,
    "semester" "Semester" NOT NULL,

    CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grade" (
    "id" TEXT NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "creditUnit" INTEGER NOT NULL,
    "grade" TEXT NOT NULL,
    "reExam" TEXT,
    "remarks" TEXT,
    "instructor" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL DEFAULT 1,
    "isRetaken" BOOLEAN NOT NULL DEFAULT false,
    "retakenAYSem" TEXT,
    "academicYear" "AcademicYear" NOT NULL,
    "semester" "Semester" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subjectOfferingId" TEXT,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeLog" (
    "id" TEXT NOT NULL,
    "studentNumber" TEXT NOT NULL,
    "courseCode" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "remarks" TEXT,
    "instructor" TEXT NOT NULL,
    "academicYear" "AcademicYear" NOT NULL,
    "semester" "Semester" NOT NULL,
    "action" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GradeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "News" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "important" BOOLEAN NOT NULL DEFAULT false,
    "author" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RateLimit" (
    "id" SERIAL NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RateLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "unique_user" ON "User"("username", "email");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentNumber_key" ON "Student"("studentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Student_username_key" ON "Student"("username");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumChecklist_course_yearLevel_semester_courseCode_ma_key" ON "CurriculumChecklist"("course", "yearLevel", "semester", "courseCode", "major");

-- CreateIndex
CREATE UNIQUE INDEX "unique_offering" ON "SubjectOffering"("curriculumId", "academicYear", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "unique_academic_term" ON "AcademicTerm"("academicYear", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "unique_grade_per_term" ON "Grade"("studentNumber", "courseCode", "academicYear", "semester");

-- CreateIndex
CREATE INDEX "RateLimit_userId_action_timestamp_idx" ON "RateLimit"("userId", "action", "timestamp");

-- AddForeignKey
ALTER TABLE "SubjectOffering" ADD CONSTRAINT "SubjectOffering_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "CurriculumChecklist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentNumber_fkey" FOREIGN KEY ("studentNumber") REFERENCES "Student"("studentNumber") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_academicYear_semester_fkey" FOREIGN KEY ("academicYear", "semester") REFERENCES "AcademicTerm"("academicYear", "semester") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_subjectOfferingId_fkey" FOREIGN KEY ("subjectOfferingId") REFERENCES "SubjectOffering"("id") ON DELETE SET NULL ON UPDATE CASCADE;
