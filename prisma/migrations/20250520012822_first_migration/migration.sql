-- CreateEnum
CREATE TYPE "AcademicYear" AS ENUM ('AY_2023_2024', 'AY_2024_2025', 'AY_2025_2026', 'AY_2026_2027');

-- CreateEnum
CREATE TYPE "Semester" AS ENUM ('FIRST', 'SECOND', 'MIDYEAR');

-- CreateEnum
CREATE TYPE "UserSex" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "Courses" AS ENUM ('BSIT', 'BSCS', 'BSCRIM', 'BSP', 'BSHM', 'BSED', 'BSBA');

-- CreateEnum
CREATE TYPE "yearLevels" AS ENUM ('FIRST', 'SECOND', 'THIRD', 'FOURTH');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('REGULAR', 'IRREGULAR', 'NOT_ANNOUNCED', 'TRANSFEREE', 'RETURNEE');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('admin', 'student', 'superuser');

-- CreateEnum
CREATE TYPE "Major" AS ENUM ('HUMAN_RESOURCE_MANAGEMENT', 'MARKETING_MANAGEMENT', 'ENGLISH', 'MATHEMATICS');

-- CreateTable
CREATE TABLE "Admin" (
    "id" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
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
    "img" TEXT,
    "sex" "UserSex" NOT NULL,
    "course" "Courses" NOT NULL,
    "major" "Major",
    "status" "Status" NOT NULL,
    "birthday" TIMESTAMP(3) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'student',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
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
    "creditUnit" INTEGER NOT NULL,
    "courseTitle" TEXT NOT NULL,
    "grade" TEXT NOT NULL,
    "reExam" TEXT,
    "remarks" TEXT,
    "instructor" TEXT NOT NULL,
    "academicYear" "AcademicYear" NOT NULL,
    "semester" "Semester" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Grade_pkey" PRIMARY KEY ("id")
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

-- CreateIndex
CREATE UNIQUE INDEX "Admin_username_key" ON "Admin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentNumber_key" ON "Student"("studentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Student_username_key" ON "Student"("username");

-- CreateIndex
CREATE UNIQUE INDEX "unique_academic_term" ON "AcademicTerm"("academicYear", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "unique_student_course_term" ON "Grade"("studentNumber", "courseCode", "academicYear", "semester");

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_studentNumber_fkey" FOREIGN KEY ("studentNumber") REFERENCES "Student"("studentNumber") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grade" ADD CONSTRAINT "Grade_academicYear_semester_fkey" FOREIGN KEY ("academicYear", "semester") REFERENCES "AcademicTerm"("academicYear", "semester") ON DELETE RESTRICT ON UPDATE CASCADE;
