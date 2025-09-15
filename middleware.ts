import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { routeAccessMap } from "./lib/settings";

export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl.clone();
  const pathname = url.pathname;

  const { sessionClaims, userId } = await auth();
  const role = (sessionClaims?.metadata as { role?: string })?.role;

  if (!role) {
    return NextResponse.redirect(new URL("/sign-in", req.url));
  }

  if (!userId) return NextResponse.redirect(new URL("/sign-in", req.url));

  if (role === "student") {
    const res = await fetch(`${req.nextUrl.origin}/api/check-approval`, {
      headers: {
        "x-user-id": userId,
      },
    });

    const data = await res.json();

    if (!data.isApproved && url.pathname !== "/pending-approval") {
      url.pathname = "/pending-approval";
      return NextResponse.redirect(url);
    }

    if (data.isApproved && url.pathname === "/pending-approval") {
      url.pathname = "/student";
      return NextResponse.redirect(url);
    }
  }

  // 🔁 2. Skip infinite redirect to homepage only AFTER approval check
  if (pathname === `/${role}`) {
    return NextResponse.next();
  }

  // 🔒 3. Role-based access
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
    "/((?!_next|.*\\.(?:js|css|png|jpg|jpeg|svg|ico|json)|sign-in|sign-up|favicon.ico|api/check-approval).*)",
  ],
};
