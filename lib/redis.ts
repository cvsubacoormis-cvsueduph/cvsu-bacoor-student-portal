import Redis from "ioredis";

export const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
        const delay = Math.min(times * 100, 3000);
        return delay;
    },
    enableOfflineQueue: false, // Fail fast when disconnected
});

// Force connection check
redis.connect().catch((err) => {
    console.error("❌ Redis connection failed:", err.message);
});

redis.on("connect", () => {
    console.log("✅ Redis connected");
});

redis.on("error", (err) => {
    console.error("❌ Redis error:", err.message);
});

/**
 * Check if Redis is connected and ready
 */
export async function isRedisConnected(): Promise<boolean> {
    try {
        const status = redis.status;
        return status === "ready" || status === "connect";
    } catch {
        return false;
    }
}
