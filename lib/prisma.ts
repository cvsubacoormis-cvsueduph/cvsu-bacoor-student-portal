import { PrismaClient } from "@prisma/client";

declare const globalThis: {
  prismaGlobal?: PrismaClient;
} & typeof global;

/**
 * Lazy Prisma client.
 *
 * Defers `new PrismaClient()` (which opens the DB connection pool, ~50-100ms
 * on cold start) until the first property access. After the first query, the
 * client is cached on `globalThis` in dev to survive HMR, and reused in prod.
 *
 * Call sites are unchanged: `import prisma from "@/lib/prisma"` and
 * `prisma.student.findMany(...)` still work identically.
 *
 * For cases where the real `PrismaClient` instance is needed (e.g., libraries
 * that check `instanceof PrismaClient`), use `getPrisma()` instead.
 */
export function getPrisma(): PrismaClient {
  if (!globalThis.prismaGlobal) {
    globalThis.prismaGlobal = new PrismaClient();
  }
  return globalThis.prismaGlobal;
}

const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const client = getPrisma();
    const value = (client as any)[prop];
    // Bind methods so `this` refers to the real client (required by Prisma's
    // query builder, transaction API, and `$connect`/`$disconnect`).
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export default prisma;
