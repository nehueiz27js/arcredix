import { NextResponse } from "next/server";

import { getDatabase } from "@/lib/db/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sql = getDatabase();
    const plans = await sql`
      SELECT
        code,
        name,
        monthly_price_usd::text AS monthly_price_usd,
        connection_limit,
        features
      FROM public.plans
      WHERE is_active = true
      ORDER BY monthly_price_usd ASC
    `;

    return NextResponse.json(
      { plans, currency: "USD", billing_interval: "month" },
      {
        headers: {
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
        },
      },
    );
  } catch (error) {
    const details = error instanceof Error ? error.message : String(error);
    console.error("ARCREDIX public plans GET failed:", details);

    return NextResponse.json(
      {
        error: "No se pudo consultar el catálogo de planes.",
        ...(process.env.NODE_ENV === "development" ? { details } : {}),
      },
      { status: 503 },
    );
  }
}
