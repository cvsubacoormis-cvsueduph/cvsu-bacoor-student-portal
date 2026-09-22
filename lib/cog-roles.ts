/**
 * Role gate for Certificate of Grades (COG) generation.
 *
 * Kept in a dependency-free module so server actions and route handlers share
 * one definition instead of repeating (and drifting from) an inline array.
 *
 * Per product decision, COG generation is available to `admin` and `registrar`
 * ONLY. `superuser` and `registrar_staff` are intentionally excluded.
 */
export const COG_GENERATION_ROLES = ["admin", "registrar"] as const;

export type CogGenerationRole = (typeof COG_GENERATION_ROLES)[number];

export function canGenerateCOG(role: unknown): role is CogGenerationRole {
  return COG_GENERATION_ROLES.includes(role as CogGenerationRole);
}

/** Human-readable message used when the role check fails. */
export const COG_FORBIDDEN_MESSAGE =
  "Forbidden: only admins and registrars can generate a Certificate of Grades";
