/*
  Warnings:

  - You are about to drop the column `dateTime` on the `Announcement` table. All the data in the column will be lost.
  - Added the required column `category` to the `Announcement` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Announcement" DROP COLUMN "dateTime",
ADD COLUMN     "author" TEXT,
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "important" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
