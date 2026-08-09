// BNDR. API — authenticated pending-confirmation register.
// Entries are database-backed; no bundled resource register is shipped.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.adminRead);
  if (blocked) return blocked;

  try {
    const rows = await db.pendingResource.findMany({
      orderBy: [{ reason: "asc" }, { name: "asc" }],
    });

    const reasonCounts = new Map<string, number>();
    for (const row of rows) {
      reasonCounts.set(row.reason, (reasonCounts.get(row.reason) ?? 0) + 1);
    }

    return NextResponse.json({
      total: rows.length,
      byReason: [...reasonCounts.entries()].map(([reason, count]) => ({
        reason,
        count,
      })),
      entries: rows.map((row) => ({
        id: row.id,
        name: row.name,
        reason: row.reason,
        website: row.website,
        phone: row.phone,
        sources: row.sources ?? [],
        notes: row.notes,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("[api/admin/pending GET]", error);
    return apiError("INTERNAL", "Failed to load pending resources.", 500);
  }
}
