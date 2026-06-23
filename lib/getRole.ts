/**
 * Extract a user's role from Clerk public metadata with cross-app compatibility.
 *
 * The enrollment system stores "enrollmentRole", the student portal stores "role".
 * This function checks both and normalizes to lowercase.
 */
export function getRole(publicMetadata: Record<string, any> | undefined | null): string {
  const metadata = publicMetadata ?? {}
  const raw = (metadata.role || metadata.enrollmentRole || '') as string
  return raw.toLowerCase()
}

/**
 * Check if a user has an approved status.
 */
export function isApproved(publicMetadata: Record<string, any> | undefined | null): boolean {
  const metadata = publicMetadata ?? {}
  return !!metadata.isApproved
}
