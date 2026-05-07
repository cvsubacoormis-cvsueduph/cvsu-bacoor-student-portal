"use server";

import { checkRateLimitRedis } from "@/lib/rate-limit-redis";

/**
 * Server action to check rate limit for generate_checklist from client components
 * This is a wrapper that can be called from Client Components
 */
export async function checkChecklistRateLimit() {
  await checkRateLimitRedis({
    action: "generate_checklist",
    limit: 5,
    windowSeconds: 60,
  });
  return { success: true };
}

/**
 * Server action to check rate limit for generate_cog from client components
 */
export async function checkCOGRateLimit() {
  await checkRateLimitRedis({
    action: "generate_cog",
    limit: 5,
    windowSeconds: 60,
  });
  return { success: true };
}

/**
 * Server action to check rate limit for generate_cog_admin from client components
 */
export async function checkCOGAdminRateLimit() {
  await checkRateLimitRedis({
    action: "generate_cog_admin",
    limit: 10,
    windowSeconds: 60,
  });
  return { success: true };
}