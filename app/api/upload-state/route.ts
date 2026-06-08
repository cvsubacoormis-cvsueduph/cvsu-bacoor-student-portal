import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { redis, withRedisFallback } from "@/lib/redis";
import { z } from "zod";

export const runtime = "nodejs";

// ── Redis key ──────────────────────────────────────────────────────────────
const getStateKey = (userId: string) => `upload-state:${userId}`;
const STATE_TTL = 24 * 60 * 60; // 24 hours

// ── Validation schema for POST body ────────────────────────────────────────
const persistedStateSchema = z.object({
  fileName: z.string().optional(),
  fileSize: z.number().optional(),
  previewData: z.array(z.record(z.unknown())).optional(),
  academicYear: z.string().optional(),
  semester: z.string().optional(),
  allowLegacy: z.boolean().optional(),
  uploadResults: z.array(z.record(z.unknown())).optional(),
  logs: z
    .array(
      z.object({
        type: z.enum(["success", "error", "warning"]),
        message: z.string(),
        timestamp: z.string(),
      })
    )
    .optional(),
  hasValidated: z.boolean().optional(),
  progress: z.number().optional(),
  processedCount: z.number().optional(),
  totalRecords: z.number().optional(),
  timestamp: z.number().optional(),
});

// ── GET: Load persisted upload state ──────────────────────────────────────
export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const data = await withRedisFallback(async () => {
      const raw = await redis.get(getStateKey(userId));
      return raw ? JSON.parse(raw) : null;
    });

    if (!data) {
      return NextResponse.json({ state: null });
    }

    return NextResponse.json({ state: data });
  } catch (err: unknown) {
    console.error("❌ GET /api/upload-state error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// ── POST: Save / update persisted upload state ────────────────────────────
export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse JSON body — return 400 on malformed JSON
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const parsed = persistedStateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const stored = await withRedisFallback(async () => {
      // Merge with existing state (partial updates)
      const existingRaw = await redis.get(getStateKey(userId));
      const existing = existingRaw ? JSON.parse(existingRaw) : {};
      const merged = { ...existing, ...parsed.data, timestamp: Date.now() };
      await redis.set(
        getStateKey(userId),
        JSON.stringify(merged),
        "EX",
        STATE_TTL
      );
      return merged;
    });

    return NextResponse.json({ state: stored });
  } catch (err: unknown) {
    console.error("❌ POST /api/upload-state error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

// ── DELETE: Clear persisted upload state ──────────────────────────────────
export async function DELETE() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await withRedisFallback(async () => {
      await redis.del(getStateKey(userId));
    });

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error("❌ DELETE /api/upload-state error:", err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
