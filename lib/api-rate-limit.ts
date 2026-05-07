import { redis } from "@/lib/redis";
import { RateLimiterRedis } from "rate-limiter-flexible";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const limiterCache = new Map<string, RateLimiterRedis>();

export function getRateLimiter(key: string, points: number, durationSeconds: number) {
  const cacheKey = `${key}:${points}:${durationSeconds}`;
  if (!limiterCache.has(cacheKey)) {
    limiterCache.set(
      cacheKey,
      new RateLimiterRedis({
        storeClient: redis,
        keyPrefix: `rl:api:${key}`,
        points,
        duration: durationSeconds,
      })
    );
  }
  return limiterCache.get(cacheKey)!;
}

export async function checkApiRateLimit(key: string, points: number, durationSeconds: number) {
  const { userId } = await auth();
  if (!userId) return { userId: null, error: null };

  const limiter = getRateLimiter(key, points, durationSeconds);
  try {
    await limiter.consume(userId);
    return { userId, error: null };
  } catch (err: any) {
    return {
      userId,
      error: NextResponse.json(
        {
          error: "Too many requests. Please try again in " +
            Math.ceil((err.msBeforeNext || durationSeconds * 1000) / 1000) + " seconds.",
          retryAfter: Math.ceil((err.msBeforeNext || durationSeconds * 1000) / 1000),
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((err.msBeforeNext || durationSeconds * 1000) / 1000)),
          },
        }
      ),
    };
  }
}
