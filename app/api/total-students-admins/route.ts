import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
export const runtime = "nodejs";


export async function GET() {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (sessionClaims?.metadata as { role?: string })?.role;
  const allowedRoles = ["admin", "superuser", "registrar", "registrar_staff", "faculty"];
  if (!role || !allowedRoles.includes(role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const totalStudents = await prisma.student.count();
    const totalAdmins = await prisma.admin.count();
    // Cache publicly for 60s browser, 300s CDN, serve stale up to 1hr while revalidating
    const response = NextResponse.json({ totalStudents, totalAdmins });
    response.headers.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=3600");
    // Vary: Accept-Encoding only — prevents Cloudflare cache key fragmentation from RSC headers
    response.headers.set("Vary", "Accept-Encoding");
    return response;
  } catch (error) {
    console.error("Error fetching totals:", error);
    return NextResponse.json(
      { error: "Failed to fetch totals" },
      { status: 500 }
    );
  }
}
