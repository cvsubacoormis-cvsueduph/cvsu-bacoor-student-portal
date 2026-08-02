import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { routeAccessMap } from "./lib/settings";

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export default clerkMiddleware(async (auth, req) => {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const pathname = req.nextUrl.pathname;

  // CSRF protection: validate Origin header for state-changing API requests.
  // Server actions in Next.js 15 have built-in same-origin enforcement via
  // encrypted action IDs, so this only applies to custom API routes.
  // Page routes (server actions, form submissions) are excluded.
  if (pathname.startsWith("/api/") && STATE_CHANGING_METHODS.has(req.method)) {
    const origin = req.headers.get("origin");
    const host = req.headers.get("host");
    if (!origin || !host) {
      return NextResponse.json(
        { error: "Forbidden: origin header required" },
        { status: 403 }
      );
    }
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return NextResponse.json(
          { error: "Forbidden: cross-origin request blocked" },
          { status: 403 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Forbidden: invalid origin" },
        { status: 403 }
      );
    }
  }

  // Allow public routes
  if (
    pathname === "/sign-in" ||
    pathname === "/sign-up"
  ) {
    return NextResponse.next();
  }

  // Redirect to sign-in if no role
  if (!role) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  // Allow role homepage
  if (pathname === `/${role}`) {
    return NextResponse.next();
  }

  // Role-based access control
  for (const pattern in routeAccessMap) {
    const regex = new RegExp(`^${pattern}$`);
    if (regex.test(pathname)) {
      const allowedRoles = routeAccessMap[pattern];
      if (!allowedRoles.includes(role)) {
        return NextResponse.redirect(new URL(`/${role}`, req.url));
      }
      break;
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  ],
};
