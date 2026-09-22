-- Supports the term-scoped grades export, which filters on
-- (academicYear, semester) and then pages with
-- ORDER BY (studentNumber, courseCode).
--
-- Before this index the sort had no supporting index, so PostgreSQL had to
-- sort the entire term for EVERY page of the export. Because the export pages
-- through the term, total sort work grew with (pages x term rows) — i.e.
-- quadratically in the term size. With the index the planner can satisfy both
-- the filter and the ordering from a single index range scan, and each page
-- reads only the rows it returns.
--
-- The index name is Prisma's default for @@index([academicYear, semester,
-- studentNumber, courseCode]) on the Grade model, so the schema and database
-- stay in sync without an explicit map:.
--
-- CONCURRENTLY is deliberately NOT used: Prisma runs each migration inside a
-- transaction, where CREATE INDEX CONCURRENTLY is not permitted. If your Grade
-- table is very large and a brief write lock is a concern, apply it manually
-- instead:
--   CREATE INDEX CONCURRENTLY "Grade_academicYear_semester_studentNumber_courseCode_idx"
--     ON "Grade" ("academicYear", "semester", "studentNumber", "courseCode");
-- then mark this migration as already applied with `prisma migrate resolve`.

CREATE INDEX "Grade_academicYear_semester_studentNumber_courseCode_idx"
  ON "Grade" ("academicYear", "semester", "studentNumber", "courseCode");
