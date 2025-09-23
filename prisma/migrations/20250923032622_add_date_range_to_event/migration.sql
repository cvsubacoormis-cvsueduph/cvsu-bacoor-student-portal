/*
  Warnings:

  - Added the required column `dateFrom` to the `Event` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "dateFrom" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "dateTo" TIMESTAMP(3);
