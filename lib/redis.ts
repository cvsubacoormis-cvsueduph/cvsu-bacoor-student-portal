import Redis from "ioredis";

// `Number(undefined)` is NaN, and ioredis throws synchronously on an invalid
// port during `new Redis(...)`. That turned a missing env var into a stream of
// "Port should be >= 0 and < 65536" errors on every page that imports this
// module during `next build`. Redis is optional here (lib/rate-limit-postgres.ts
// is the fallback), so default to 6379 rather than constructing a broken client.
const parsedPort = Number(process.env.REDIS_PORT);
const redisPort = Number.isInteger(parsedPort) && parsedPort > 0 && parsedPort < 65536
  ? parsedPort
  : 6379;

const redisConfig = {
  host: process.env.REDIS_HOST || "127.0.0.1",
  port: redisPort,
  password: process.env.REDIS_PASSWORD,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
  retryStrategy(times: any) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  enableOfflineQueue: true, // Queue operations when disconnected
  connectTimeout: 10000,
  commandTimeout: 5000,
};

export const redis = new Redis(redisConfig);

// Track connection state
let isConnected = false;

// Connect lazily on first use instead of eagerly at import time. Pages import
// this module, so an eager connect fired during `next build` static generation
// — against the build machine's network rather than the app network — and
// logged a connection failure for every page Next rendered. At runtime the
// first Redis command triggers the connection via the offline queue.
const isBuilding = process.env.NEXT_PHASE === "phase-production-build";

if (!isBuilding) {
  redis.connect().catch((err) => {
    console.error("❌ Redis connection failed:", err.message);
    isConnected = false;
  });
}

redis.on("connect", () => {
  console.log("✅ Redis connected");
  isConnected = true;
});

redis.on("ready", () => {
  console.log("✅ Redis ready");
  isConnected = true;
});

redis.on("close", () => {
  console.log("⚠️ Redis connection closed");
  isConnected = false;
});

redis.on("error", (err) => {
  console.error("❌ Redis error:", err.message);
  isConnected = false;
});

/**
 * Check if Redis is connected and ready
 */
export function isRedisConnected(): boolean {
  return (
    isConnected && (redis.status === "ready" || redis.status === "connect")
  );
}

/**
 * Execute Redis operation with graceful fallback
 * Returns null if Redis is unavailable
 */
export async function withRedisFallback<T>(
  operation: () => Promise<T>,
  fallback: T | null = null,
): Promise<T | null> {
  if (!isRedisConnected()) {
    return fallback;
  }
  try {
    return await operation();
  } catch (error) {
    console.error("Redis operation failed:", error);
    return fallback;
  }
}

/**
 * Invalidate all cache keys matching a SCAN pattern.
 * Uses SCAN + DEL to avoid blocking the Redis server.
 * Failures are silently caught so callers don't need try/catch.
 */
export async function invalidateByPattern(pattern: string): Promise<void> {
  await withRedisFallback(async () => {
    let cursor = "0";
    do {
      const [nextCursor, keys] = await redis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        "100"
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== "0");
  });
}
