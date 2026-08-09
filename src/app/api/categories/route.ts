// BNDR. API — Categories with live counts
// ----------------------------------------------------------------------------
// GET /api/categories → CategoryInfo[] enriched with a live `count` per slug,
//                       ordered by their definition order in CATEGORIES.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Group + count resources by category in one DB round-trip.
    const grouped = await db.resource.groupBy({
      by: ["category"],
      _count: { _all: true },
      where: { published: true },
    });
    const counts = new Map<string, number>();
    for (const g of grouped) {
      counts.set(g.category, g._count._all);
    }

    const out = CATEGORIES.map((c, i) => ({
      ...c,
      sortOrder: i,
      count: counts.get(c.slug) ?? 0,
    }));

    return NextResponse.json(out);
  } catch (err) {
    console.error("[api/categories GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch categories" },
      { status: 500 },
    );
  }
}
