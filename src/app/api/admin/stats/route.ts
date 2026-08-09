// BNDR. API — Admin stats (operational details)
// ----------------------------------------------------------------------------
// GET /api/admin/stats → ADMIN-ONLY. Returns operational audit details:
// recentAudit, auditCount, lastPiipass, plus the public aggregate counts.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { CATEGORIES } from "@/lib/types";
import type { AdminStats } from "@/lib/types";
import { requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  // Admin-only operational details.
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.adminRead);
  if (blocked) return blocked;

  try {
    // All resources (including unpublished) for admin.
    const total = await db.resource.count();
    const priorityCount = await db.resource.count({
      where: { priority: { gte: 1 } },
    });
    const withPhone = await db.resource.count({
      where: { phoneNormalized: { not: null } },
    });
    const withEmail = await db.resource.count({
      where: { email: { not: null } },
    });
    const withWebsite = await db.resource.count({
      where: { website: { not: null } },
    });
    const publishedCount = await db.resource.count({ where: { published: true } });
    const unpublishedCount = await db.resource.count({ where: { published: false } });

    const counts = await db.resource.groupBy({
      by: ["category"],
      _count: { _all: true },
    });
    const countMap = new Map<string, number>();
    for (const row of counts) {
      countMap.set(row.category, row._count._all);
    }
    const byCategory = CATEGORIES.map((c) => ({
      category: c.slug,
      count: countMap.get(c.slug) ?? 0,
    }));

    const recentAuditRows = await db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    const recentAudit = recentAuditRows.map((r) => ({
      id: r.id,
      action: r.action,
      resourceId: r.resourceId,
      actor: r.actor,
      summary: r.summary,
      details: r.details,
      createdAt: r.createdAt.toISOString(),
    }));

    const lastPiipassRow = await db.resource.findFirst({
      where: { piipassAt: { not: null } },
      orderBy: { piipassAt: "desc" },
      select: { piipassAt: true },
    });
    const lastPiipass = lastPiipassRow?.piipassAt
      ? lastPiipassRow.piipassAt.toISOString()
      : null;

    const auditCount = await db.auditLog.count();

    const stats: AdminStats & {
      auditCount: number;
      publishedCount: number;
      unpublishedCount: number;
    } = {
      totalResources: total,
      byCategory,
      priorityCount,
      withPhone,
      withEmail,
      withWebsite,
      recentAudit,
      lastPiipass,
      auditCount,
      publishedCount,
      unpublishedCount,
    };

    return NextResponse.json(stats);
  } catch (err) {
    console.error("[api/admin/stats GET]", err);
    return apiError("INTERNAL", "Failed to compute admin stats.", 500);
  }
}
