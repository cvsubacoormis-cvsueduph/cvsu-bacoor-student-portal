/**
 * Enrollment system database client (READ-ONLY via raw SQL).
 *
 * We use a raw pg.Pool instead of Prisma because the portal and enrollment
 * systems have DIFFERENT Prisma schemas. A generated PrismaClient can only
 * connect to one schema at a time.
 *
 * All queries use parameterized SQL ($1, $2, ...) to prevent SQL injection.
 * Never import this in client components — it will leak DB credentials.
 *
 * Security:
 * - Uses ENROLLMENT_DATABASE_URL from env
 * - The credential used should ideally have SELECT-only permissions
 * - Pool is a singleton to avoid connection exhaustion
 * - All queries are parameterized
 */

import { Pool, type QueryResultRow } from "pg";

const globalForEnrollment = globalThis as unknown as {
  enrollmentPool: Pool | undefined;
};

function createEnrollmentPool(): Pool {
  const dbUrl = process.env.ENROLLMENT_DATABASE_URL;
  if (!dbUrl) {
    throw new Error(
      "ENROLLMENT_DATABASE_URL is not set. Add it to .env to enable the enrollment bridge."
    );
  }

  return new Pool({
    connectionString: dbUrl,
    max: 5, // minimize connections since we only do read queries
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: dbUrl.includes("sslmode=require") ? { rejectUnauthorized: false } : undefined,
  });
}

/** Read-only PostgreSQL pool connected to the cvsub-enrollment database */
export const enrollmentPool: Pool =
  globalForEnrollment.enrollmentPool ?? createEnrollmentPool();

if (process.env.NODE_ENV !== "production") {
  globalForEnrollment.enrollmentPool = enrollmentPool;
}

/**
 * Execute a parameterized query on the enrollment database.
 * Always use this instead of raw string interpolation.
 */
export async function enrollmentQuery<T extends QueryResultRow = QueryResultRow>(
  queryText: string,
  params: unknown[] = []
): Promise<T[]> {
  const client = await enrollmentPool.connect();
  try {
    const result = await client.query<T>(queryText, params);
    return result.rows;
  } finally {
    client.release();
  }
}

/**
 * Execute a query that returns exactly one row, or null.
 */
export async function enrollmentQueryOne<T extends QueryResultRow = QueryResultRow>(
  queryText: string,
  params: unknown[] = []
): Promise<T | null> {
  const rows = await enrollmentQuery<T>(queryText, params);
  return rows[0] ?? null;
}

/**
 * Check if the enrollment database connection is healthy.
 */
export async function checkEnrollmentDbConnection(): Promise<boolean> {
  try {
    await enrollmentQuery("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

/**
 * Gracefully close all pool connections (for testing / shutdown).
 */
export async function closeEnrollmentPool(): Promise<void> {
  await enrollmentPool.end();
}
