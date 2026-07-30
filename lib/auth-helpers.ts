import { cache } from "react";
import { currentUser } from "@clerk/nextjs/server";

/**
 * Cached version of Clerk's currentUser() that memoizes the result
 * within a single request. Use this instead of calling currentUser()
 * directly when the same user context is needed multiple times in
 * a request lifecycle.
 *
 * Why: currentUser() makes a Clerk API call on every invocation.
 * Within a single request, the result doesn't change. React's cache()
 * ensures we only call Clerk once per request.
 */
export const getCurrentUser = cache(async () => {
  return await currentUser();
});
