// BNDR. API — Public stats
// ----------------------------------------------------------------------------
// GET /api/stats → published aggregate counts ONLY.
// Operational details (recentAudit, lastPiipass, auditCount) moved to
// authenticated /api/admin/stats.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/types";
import { apiError } from "@/lib/require-admin";

export const dynamic = "force-dynamic";

export interface PublicStats {
  totalResources: number;
  byCategory: { category: string; count: number }[];
  priorityCount: number;
  withPhone: number;
  withEmail: number;
  withWebsite: number;
  categoryContactCoverage: {
    category: string;
    withPhone: number;
    withEmail: number;
    withWebsite: number;
  }[];
}

export async function GET() {
  try {
    const pubFilter = { published: true };
    const total = await db.resource.count({ where: pubFilter });
    const priorityCount = await db.resource.count({
      where: { ...pubFilter, priority: { gte: 1 } },
    });
    const withPhone = await db.resource.count({
      where: { ...pubFilter, phoneNormalized: { not: null } },
    });
    const withEmail = await db.resource.count({
      where: { ...pubFilter, email: { not: null } },
    });
    const withWebsite = await db.resource.count({
      where: { ...pubFilter, website: { not: null } },
    });

    // Per-category totals and contact coverage come directly from the full
    // published dataset. They never inherit the user's current search/filter.
    const [counts, phoneCounts, emailCounts, websiteCounts] = await Promise.all([
      db.resource.groupBy({
        by: ["category"],
        _count: { _all: true },
        where: pubFilter,
      }),
      db.resource.groupBy({
        by: ["category"],
        _count: { _all: true },
        where: { ...pubFilter, phoneNormalized: { not: null } },
      }),
      db.resource.groupBy({
        by: ["category"],
        _count: { _all: true },
        where: { ...pubFilter, email: { not: null } },
      }),
      db.resource.groupBy({
        by: ["category"],
        _count: { _all: true },
        where: { ...pubFilter, website: { not: null } },
      }),
    ]);

    const toCountMap = (rows: typeof counts) =>
      new Map(rows.map((row) => [row.category, row._count._all]));
    const countMap = toCountMap(counts);
    const phoneMap = toCountMap(phoneCounts);
    const emailMap = toCountMap(emailCounts);
    const websiteMap = toCountMap(websiteCounts);

    const byCategory = CATEGORIES.map((c) => ({
      category: c.slug,
      count: countMap.get(c.slug) ?? 0,
    }));
    const categoryContactCoverage = CATEGORIES.map((c) => ({
      category: c.slug,
      withPhone: phoneMap.get(c.slug) ?? 0,
      withEmail: emailMap.get(c.slug) ?? 0,
      withWebsite: websiteMap.get(c.slug) ?? 0,
    }));

    const stats: PublicStats = {
      totalResources: total,
      byCategory,
      priorityCount,
      withPhone,
      withEmail,
      withWebsite,
      categoryContactCoverage,
    };

    return NextResponse.json(stats);
  } catch (err) {
    console.error("[api/stats GET]", err);
    return apiError("INTERNAL", "Failed to compute stats.", 500);
  }
}
