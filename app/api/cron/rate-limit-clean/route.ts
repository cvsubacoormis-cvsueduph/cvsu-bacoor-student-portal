import { NextResponse } from "next/server";
import { Pool } from "pg";
export const runtime = "nodejs";


const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export async function GET(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }
  try {
    await pool.query(`
      DELETE FROM "RateLimit"
      WHERE timestamp < NOW() - INTERVAL '1 hour'
    `);
    return NextResponse.json({
      success: true,
      message: "Expired entries cleaned",
    });
  } catch (error) {
    console.error("Cron cleanup error:", error);
    return NextResponse.json(
      { success: false, error: "Cleanup failed" },
      { status: 500 }
    );
  }
}
