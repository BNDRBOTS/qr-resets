// BNDR. API — All tags with counts (for tag-cloud browsing)
// ----------------------------------------------------------------------------
// GET /api/tags  → returns all tags across all resources, with occurrence
//   counts, sorted by count descending. Used by the tag-cloud on the About
//   modal for visual discovery.
//
// Source-faithful: only returns tags that already exist in the DB.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.resource.findMany({
      where: { published: true },
      select: { tags: true },
    });

    const counts = new Map<string, number>();
    for (const row of rows) {
      if (!row.tags) continue;
      for (const t of row.tags.split(",")) {
        const tag = t.trim();
        if (!tag) continue;
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }

    const tags = Array.from(counts.entries())
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count);

    return NextResponse.json({ tags, total: tags.length });
  } catch (err) {
    console.error("[api/tags GET]", err);
    return NextResponse.json(
      { error: "Failed to load tags", tags: [], total: 0 },
      { status: 500 },
    );
  }
}
