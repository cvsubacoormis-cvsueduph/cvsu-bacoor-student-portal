import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
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

  const rl = await checkApiRateLimit("total_students_male_female", 30, 60);
  if (rl.error) return rl.error;

  try {
    const maleCount = await prisma.student.count({
      where: { sex: "MALE" },
    });

    const femaleCount = await prisma.student.count({
      where: { sex: "FEMALE" },
    });
    // Cache publicly for 60s browser, 300s CDN, serve stale up to 1hr while revalidating
    const response = NextResponse.json({
      maleCount,
      femaleCount,
      total: maleCount + femaleCount,
    });
    response.headers.set("Cache-Control", "public, max-age=60, s-maxage=300, stale-while-revalidate=3600");
    // Vary: Accept-Encoding only — prevents Cloudflare cache key fragmentation from RSC headers
    response.headers.set("Vary", "Accept-Encoding");
    return response;
  } catch (error) {
    console.error("Error fetching gender counts:", error);
    return NextResponse.json(
      { error: "Failed to fetch gender counts" },
      { status: 500 }
    );
  }
}
