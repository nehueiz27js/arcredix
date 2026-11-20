import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getDatabase();
    const [result] = await sql`
      SELECT
        current_database() AS database_name,
        EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = 'public'
            AND table_name = 'plans'
        ) AS catalog_ready
    `;

    return NextResponse.json({
      status: "ok",
      database: "connected",
      catalog: result?.catalog_ready ? "ready" : "missing",
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json(
      {
        status: "error",
        database: "unavailable",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
