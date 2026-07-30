import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/api-rate-limit";
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

  const rl = await checkApiRateLimit("courses_total", 30, 60);
  if (rl.error) return rl.error;

  try {
    const coursesCount = await prisma.student.groupBy({
      by: ["course"],
      _count: {
        course: true,
      },
    });
    // Cache publicly for 60s browser, 300s CDN, serve stale up to 1hr while revalidating
    const response = NextResponse.json({ data: coursesCount });
    response.headers.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=3600");
    // Vary: Accept-Encoding only — prevents Cloudflare cache key fragmentation from RSC headers
    response.headers.set("Vary", "Accept-Encoding");
    return response;
  } catch (error) {
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
}
