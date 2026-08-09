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

    const counts = await db.resource.groupBy({
      by: ["category"],
      _count: { _all: true },
      where: pubFilter,
    });
    const countMap = new Map<string, number>();
    for (const row of counts) {
      countMap.set(row.category, row._count._all);
    }
    const byCategory = CATEGORIES.map((c) => ({
      category: c.slug,
      count: countMap.get(c.slug) ?? 0,
    }));

    const stats: PublicStats = {
      totalResources: total,
      byCategory,
      priorityCount,
      withPhone,
      withEmail,
      withWebsite,
    };

    return NextResponse.json(stats);
  } catch (err) {
    console.error("[api/stats GET]", err);
    return apiError("INTERNAL", "Failed to compute stats.", 500);
  }
}
