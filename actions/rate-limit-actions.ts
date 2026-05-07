"use server";

import { checkRateLimitRedis } from "@/lib/rate-limit-redis";

/**
 * Server action to check rate limit for generate_checklist from client components
 * This is a wrapper that can be called from Client Components
 */
export async function checkChecklistRateLimit() {
  try {
    await checkRateLimitRedis({
      action: "generate_checklist",
      limit: 5,
      windowSeconds: 60,
    });
    return { success: true };
  } catch (error: any) {
    // Return error info instead of throwing to preserve error properties on client
    if (error?.code === "RATE_LIMIT_EXCEEDED" || error?.message?.includes("Too many requests")) {
      return { 
        success: false, 
        error: "RATE_LIMIT_EXCEEDED",
        message: error.message || "Too many requests. Please try again in a minute." 
      };
    }
    throw error;
  }
}

/**
 * Server action to check rate limit for generate_cog from client components
 */
export async function checkCOGRateLimit() {
  try {
    await checkRateLimitRedis({
      action: "generate_cog",
      limit: 5,
      windowSeconds: 60,
    });
    return { success: true };
  } catch (error: any) {
    if (error?.code === "RATE_LIMIT_EXCEEDED" || error?.message?.includes("Too many requests")) {
      return { 
        success: false, 
        error: "RATE_LIMIT_EXCEEDED",
        message: error.message || "Too many requests. Please try again in a minute." 
      };
    }
    throw error;
  }
}

/**
 * Server action to check rate limit for generate_cog_admin from client components
 */
export async function checkCOGAdminRateLimit() {
  try {
    await checkRateLimitRedis({
      action: "generate_cog_admin",
      limit: 10,
      windowSeconds: 60,
    });
    return { success: true };
  } catch (error: any) {
    if (error?.code === "RATE_LIMIT_EXCEEDED" || error?.message?.includes("Too many requests")) {
      return { 
        success: false, 
        error: "RATE_LIMIT_EXCEEDED",
        message: error.message || "Too many requests. Please try again in a minute." 
      };
    }
    throw error;
  }
}