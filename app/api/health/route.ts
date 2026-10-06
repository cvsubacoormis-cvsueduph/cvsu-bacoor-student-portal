import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Liveness probe for container orchestrators (docker-compose healthcheck, etc.).
 *
 * Deliberately checks nothing but the process itself: no DB, Redis, Clerk, or
 * rate-limiter calls. A liveness probe that depends on downstream services
 * reports the app unhealthy during a transient DB/Redis blip and can trigger a
 * pointless restart loop, turning a brief dependency hiccup into an outage.
 *
 * Intentionally unauthenticated and outside `routeAccessMap` (see
 * lib/settings.ts) so `middleware.ts` never redirects it. A redirect there
 * would break busybox `wget --spider`, which does not follow 3xx.
 */
export async function GET() {
  return NextResponse.json(
    { status: "ok" },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
