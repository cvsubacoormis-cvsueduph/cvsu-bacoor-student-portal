import Redis from "ioredis";

export const redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    lazyConnect: true,
    maxRetriesPerRequest: 10,
    enableOfflineQueue: true,
});

redis.on("connect", () => {
    console.log("✅ Redis connected");
});

redis.on("error", (err) => {
    console.error("❌ Redis error:", err.message);
});
