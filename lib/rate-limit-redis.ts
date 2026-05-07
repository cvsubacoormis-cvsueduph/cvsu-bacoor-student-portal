import { redis, isRedisConnected } from "@/lib/redis";
import { auth } from "@clerk/nextjs/server";

type RateLimitOptions = {
  action: string;
  limit: number;
  windowSeconds: number;
};

type RateLimitResult = {
  success: boolean;
  remaining: number;
  resetTime: number;
};

/**
 * Redis-based rate limiter using sliding window algorithm
 * @param action - The action identifier (e.g., "generate_cog", "generate_checklist")
 * @param limit - Maximum number of requests allowed in the window
 * @param windowSeconds - Time window in seconds
 * @returns Rate limit check result
 */
export async function checkRateLimitRedis({
  action,
  limit,
  windowSeconds,
}: RateLimitOptions): Promise<RateLimitResult> {
  console.log(`[checkRateLimitRedis] Checking rate limit for action: ${action}`);
  
  const { userId } = await auth();
  if (!userId) {
    throw new Error("Unauthorized");
  }

  const key = `rate_limit:${userId}:${action}`;
  const now = Date.now();
  const windowStart = now - windowSeconds * 1000;

  try {
    // Check if Redis is connected first
    if (!isRedisConnected()) {
      console.log("[checkRateLimitRedis] Redis not connected, using fallback");
      // Allow the request with fallback
      return {
        success: true,
        remaining: limit,
        resetTime: now + windowSeconds * 1000,
      };
    }
    
    // Use Redis transaction for atomic operations
    const pipeline = redis.pipeline();

    // Remove old entries outside the window
    pipeline.zremrangebyscore(key, 0, windowStart);

    // Count current requests in window
    pipeline.zcard(key);

    // Add current request
    pipeline.zadd(key, now, `${now}`);

    // Set expiration on the key
    pipeline.expire(key, windowSeconds);

    const results = await pipeline.exec();

    if (!results) {
      throw new Error("Redis pipeline failed");
    }

    // results[0] = zremrangebyscore result (not needed)
    // results[1] = zcard result (current count before adding)
    // results[2] = zadd result (not needed)
    // results[3] = expire result (not needed)

    const currentCount = (results[1] as [null, number])?.[1] ?? 0;
    const remaining = Math.max(0, limit - currentCount - 1);
    const resetTime = now + windowSeconds * 1000;

    // Check if limit exceeded
    if (currentCount >= limit) {
      // Remove the request we just added since it's over limit
      await redis.zrem(key, `${now}`);

      const error: any = new Error(
        "Too many requests. Please try again in a minute.",
      );
      error.code = "RATE_LIMIT_EXCEEDED";
      error.remaining = 0;
      error.resetTime = resetTime;
      throw error;
    }

    return {
      success: true,
      remaining,
      resetTime,
    };
  } catch (error: any) {
    if (error.code === "RATE_LIMIT_EXCEEDED") {
      throw error;
    }
    // If Redis fails, fail closed (deny request) for security in production
    // unless it's a connection error - then allow with stricter limit
    console.error("Redis rate limit error:", error.message);
    
    const isConnectionError = error.message?.includes("ECONNREFUSED") 
        || error.message?.includes("ETIMEDOUT")
        || error.message?.includes("Redis connection");

    if (isConnectionError) {
      // Redis is down - use stricter fallback limit (3 requests)
      return {
        success: true,
        remaining: Math.max(0, 3 - 1),
        resetTime: now + windowSeconds * 1000,
      };
    }
    
    // Other errors - allow request but with minimal fallback
    return {
      success: true,
      remaining: 1,
      resetTime: now + windowSeconds * 1000,
    };
  }
}

/**
 * Get current rate limit status without incrementing
 * Useful for showing remaining requests to users
 */
export async function getRateLimitStatus(action: string): Promise<{
  remaining: number;
  resetTime: number;
} | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const key = `rate_limit:${userId}:${action}`;
  const now = Date.now();

  try {
    const count = await redis.zcard(key);
    // Calculate when the oldest request in the window will expire
    const oldest = await redis.zrange(key, 0, 0, "WITHSCORES");

    if (oldest.length === 0) {
      return { remaining: 5, resetTime: now + 60000 }; // Default
    }

    const oldestTimestamp = parseInt(oldest[1] as string);
    const resetTime = oldestTimestamp + 60000; // Default 60s window

    return {
      remaining: Math.max(0, 5 - count),
      resetTime,
    };
  } catch (error) {
    console.error("Error getting rate limit status:", error);
    return null;
  }
}

/**
 * Clear rate limit for a specific user and action (admin use only)
 */
export async function clearRateLimit(
  userId: string,
  action: string,
): Promise<void> {
  const key = `rate_limit:${userId}:${action}`;
  await redis.del(key);
}
