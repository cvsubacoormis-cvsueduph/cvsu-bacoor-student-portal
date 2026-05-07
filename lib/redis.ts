import Redis from "ioredis";

const redisConfig = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT),
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

// Force connection check
redis.connect().catch((err) => {
  console.error("❌ Redis connection failed:", err.message);
  isConnected = false;
});

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
