// BNDR. API — Search suggestions / autocomplete
// ----------------------------------------------------------------------------
// GET /api/suggest?q=<text>&limit=8
//   Returns categorized suggestions as the user types:
//     { categories: [{slug, name, shortName, count}],
//       tags:       [{tag, count}],
//       names:      [{id, name, acronym, category}] }
//
// Used by the search autocomplete dropdown. Source-faithful: only suggests
// categories/tags/names that already exist in the DB — never invents.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CATEGORIES, type CategorySlug } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
    const requestedLimit = Number.parseInt(
      req.nextUrl.searchParams.get("limit") ?? "8",
      10,
    );
    const limit = Number.isFinite(requestedLimit)
      ? Math.max(1, Math.min(requestedLimit, 20))
      : 8;

    if (q.length < 2) {
      return NextResponse.json({ categories: [], tags: [], names: [] });
    }

    // ---- Categories matching the typed text --------------------------------
    const categories = CATEGORIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.shortName.toLowerCase().includes(q),
    ).slice(0, 4);

    // Get live counts for the matched categories in one query.
    // Let Prisma infer the generic groupBy payload. An explicit result annotation
    // here contextually types the generic call and triggers TS2345 with Prisma 6.19.2.
    const categoryCounts =
      categories.length > 0
        ? await db.resource.groupBy({
            by: ["category"],
            _count: { _all: true },
            where: {
              published: true,
              category: { in: categories.map((c) => c.slug) },
            },
          })
        : [];
    const countMap = new Map(
      categoryCounts.map((c) => [c.category, c._count._all]),
    );
    const categoriesOut = categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      shortName: c.shortName,
      count: countMap.get(c.slug) ?? 0,
    }));

    // ---- Provider-neutral tags and names ----------------------------------
    // SQLite does not expose Prisma's PostgreSQL `mode: "insensitive"` filter.
    // With only 114 canonical rows, fetching the small published projection and
    // filtering in memory is deterministic, fast, and backend-independent.
    const publishedRows = await db.resource.findMany({
      where: { published: true },
      select: { id: true, name: true, acronym: true, category: true, priority: true, tags: true },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });

    const tagCounts = new Map<string, number>();
    for (const row of publishedRows) {
      if (!row.tags) continue;
      for (const t of row.tags.split(",")) {
        const tag = t.trim().toLowerCase();
        if (!tag || !tag.includes(q)) continue;
        tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
      }
    }
    const tags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }));

    const names = publishedRows
      .filter((r) => r.name.toLowerCase().includes(q) || (r.acronym ?? "").toLowerCase().includes(q))
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        name: r.name,
        acronym: r.acronym,
        category: r.category as CategorySlug,
        priority: r.priority,
      }));

    return NextResponse.json({ categories: categoriesOut, tags, names });
  } catch (err) {
    console.error("[api/suggest GET]", err);
    return NextResponse.json(
      { error: "Failed to generate suggestions", categories: [], tags: [], names: [] },
      { status: 500 },
    );
  }
}
