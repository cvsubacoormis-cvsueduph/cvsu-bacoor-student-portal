/**
 * Role gates for Certificate of Grades (COG) work.
 *
 * Kept in a dependency-free module so server actions, route handlers and client
 * components share one definition instead of repeating (and drifting from) an
 * inline array.
 *
 * There are deliberately TWO gates here, because COG generation and bulk grade
 * export are different privileges:
 *
 *  - Generation is day-to-day registrar work: a registrar clerk issues a
 *    certificate for a walk-in student. `registrar_staff` therefore qualifies.
 *  - Bulk export hands over the whole term's grade data for offline editing.
 *    That is restricted more tightly, to `admin` and `registrar`.
 *
 * Collapsing these into one list previously removed a capability registrar
 * staff had always had.
 */

/** Roles that may generate a single student's COG. */
export const COG_GENERATION_ROLES = [
  "admin",
  "registrar",
  "registrar_staff",
] as const;

/** Roles that may download every grade in a term. Narrower, by design. */
export const GRADE_EXPORT_ROLES = ["admin", "registrar"] as const;

export type CogGenerationRole = (typeof COG_GENERATION_ROLES)[number];
export type GradeExportRole = (typeof GRADE_EXPORT_ROLES)[number];

/** True when the role may generate a COG. */
export function canGenerateCOG(role: unknown): role is CogGenerationRole {
  return COG_GENERATION_ROLES.includes(role as CogGenerationRole);
}

/** True when the role may bulk-export a term's grades. */
export function canExportGrades(role: unknown): role is GradeExportRole {
  return GRADE_EXPORT_ROLES.includes(role as GradeExportRole);
}

export const COG_FORBIDDEN_MESSAGE =
  "Forbidden: only admins, registrars and registrar staff can generate a Certificate of Grades";

export const GRADE_EXPORT_FORBIDDEN_MESSAGE =
  "Forbidden: only admins and registrars can export grades";
