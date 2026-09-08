// ResourceCite API — public search suggestions.
// Returns only visitor-useful category and resource-name suggestions. Internal
// tags continue to improve the primary search engine but are not exposed as
// public taxonomy/metadata.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CATEGORIES, type CategorySlug } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
    const requestedLimit = Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "8", 10);
    const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 20)) : 8;

    if (q.length < 2) {
      return NextResponse.json({ categories: [], names: [] });
    }

    const categories = CATEGORIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.shortName.toLowerCase().includes(q),
    ).slice(0, 4);

    const categoryCounts = categories.length
      ? await db.resource.groupBy({
          by: ["category"],
          _count: { _all: true },
          where: { published: true, category: { in: categories.map((c) => c.slug) } },
        })
      : [];
    const countMap = new Map(categoryCounts.map((c) => [c.category, c._count._all]));
    const categoriesOut = categories.map((c) => ({
      slug: c.slug,
      name: c.name,
      shortName: c.shortName,
      count: countMap.get(c.slug) ?? 0,
    }));

    const publishedRows = await db.resource.findMany({
      where: { published: true },
      select: { id: true, name: true, acronym: true, category: true },
      orderBy: { name: "asc" },
    });
    const names = publishedRows
      .filter((r) => r.name.toLowerCase().includes(q) || (r.acronym ?? "").toLowerCase().includes(q))
      .slice(0, limit)
      .map((r) => ({
        id: r.id,
        name: r.name,
        acronym: r.acronym,
        category: r.category as CategorySlug,
      }));

    return NextResponse.json({ categories: categoriesOut, names });
  } catch (err) {
    console.error("[api/suggest GET]", err);
    return NextResponse.json(
      { error: "Failed to generate suggestions", categories: [], names: [] },
      { status: 500 },
    );
  }
}
