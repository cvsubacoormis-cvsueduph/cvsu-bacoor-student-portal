export const runtime = "nodejs";

import prisma from "@/lib/prisma";
import { redis, withRedisFallback } from "@/lib/redis";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkApiRateLimit } from "@/lib/api-rate-limit";

export async function GET(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkApiRateLimit("academic_terms", 60, 60);
    if (rl.error) return rl.error;

    const { searchParams } = new URL(request.url);
    const studentNumber = searchParams.get("studentNumber");

    // Try Redis cache for all configured terms (TTL: 1 hour — terms change at most once per semester)
    const cachedTerms = await withRedisFallback(async () => {
      const raw = await redis.get("cache:academicTerms:v1");
      return raw ? (JSON.parse(raw) as { academicYear: string; semester: string }[]) : null;
    }, null);

    let allTerms: { academicYear: string; semester: string }[];
    let studentTerms: { academicYear: string; semester: string }[];

    if (cachedTerms) {
      allTerms = cachedTerms;
      studentTerms = studentNumber
        ? await prisma.grade.findMany({
            where: { studentNumber },
            select: { academicYear: true, semester: true },
            distinct: ["academicYear", "semester"],
          })
        : [];
    } else {
      // Always fetch all configured academic terms as the base set.
      // This ensures admins/registrars can add grades for ANY term,
      // even when a student has no existing grades yet.
      [allTerms, studentTerms] = await Promise.all([
        prisma.academicTerm.findMany({
          select: { academicYear: true, semester: true },
          orderBy: { academicYear: "desc" },
        }),
        studentNumber
          ? prisma.grade.findMany({
              where: { studentNumber },
              select: { academicYear: true, semester: true },
              distinct: ["academicYear", "semester"],
            })
          : Promise.resolve([]),
      ]);

      // Cache for 1 hour (fire-and-forget; Redis failure won't block response)
      withRedisFallback(async () => {
        await redis.set("cache:academicTerms:v1", JSON.stringify(allTerms), "EX", 3600);
      });
    }

    // Merge student-specific terms with all configured terms (deduplicate)
    const termSet = new Map<string, { academicYear: string; semester: string }>();
    for (const t of allTerms) {
      const key = `${t.academicYear}_${t.semester}`;
      termSet.set(key, t);
    }
    for (const t of studentTerms) {
      const key = `${t.academicYear}_${t.semester}`;
      if (!termSet.has(key)) {
        termSet.set(key, t);
      }
    }

    // Sort descending by academicYear
    const terms = Array.from(termSet.values()).sort((a, b) =>
      b.academicYear.localeCompare(a.academicYear),
    );

    // Reference data — safe to cache publicly for 5min (CDN: 1hr, stale-while-revalidate: 24hr)
    // Vary: Accept-Encoding only — prevents Cloudflare cache key fragmentation from RSC headers
    return NextResponse.json(terms, {
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=3600, stale-while-revalidate=86400",
        "Vary": "Accept-Encoding",
      },
    });
  } catch (error) {
    console.error("Error fetching academic terms:", error);
    return NextResponse.json(
      { message: "Error fetching academic terms" },
      { status: 500 }
    );
  }
}
