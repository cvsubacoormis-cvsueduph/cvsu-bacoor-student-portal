/*
  Warnings:

  - You are about to drop the column `category` on the `Announcement` table. All the data in the column will be lost.
  - You are about to drop the column `important` on the `Announcement` table. All the data in the column will be lost.
  - Added the required column `dateFrom` to the `Announcement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endTime` to the `Announcement` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `Announcement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Announcement" DROP COLUMN "category",
DROP COLUMN "important",
ADD COLUMN     "dateFrom" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "dateTo" TIMESTAMP(3),
ADD COLUMN     "endTime" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "startTime" TIMESTAMP(3) NOT NULL;
