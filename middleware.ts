import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { routeAccessMap } from "./lib/settings";

export default clerkMiddleware(async (auth, req) => {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const pathname = req.nextUrl.pathname;

  // Allow public routes
  if (
    pathname === "/sign-in" ||
    pathname === "/sign-up" ||
    pathname === "/pending-approval"
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
