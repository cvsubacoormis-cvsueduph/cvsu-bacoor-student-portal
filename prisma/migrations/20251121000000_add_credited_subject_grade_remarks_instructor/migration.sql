-- Adds the "grade", "remarks" and "instructor" fields to CreditedSubject.
--
-- A credited subject is one the student took at another institution. Until now
-- only the school name was recorded, so the grade earned there, the remark and
-- the instructor were lost. They mirror the same three columns on the Grade
-- model, so a credited subject can be read like a grade record.
--
-- All three are nullable and additive: existing rows keep their values and gain
-- NULLs, so no backfill is required and no data is rewritten.
--
-- Generated with:
--   npx prisma migrate diff \
--     --from-schema-datamodel <previous schema> \
--     --to-schema-datamodel prisma/schema.prisma --script

-- AlterTable
ALTER TABLE "CreditedSubject" ADD COLUMN     "grade" TEXT,
ADD COLUMN     "instructor" TEXT,
ADD COLUMN     "remarks" TEXT;
