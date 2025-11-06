-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AcademicYear" ADD VALUE 'AY_2019_2020';
ALTER TYPE "AcademicYear" ADD VALUE 'AY_2020_2021';
ALTER TYPE "AcademicYear" ADD VALUE 'AY_2021_2022';
ALTER TYPE "AcademicYear" ADD VALUE 'AY_2022_2023';
