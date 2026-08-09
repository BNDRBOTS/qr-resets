// BNDR. API — public Pending Confirmation Register.
// The public surface intentionally exposes only a name + bounded reason. Full
// contact/source/notes fields remain available only through /api/admin/pending.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await db.pendingResource.findMany({
      orderBy: [{ reason: "asc" }, { name: "asc" }],
      select: { name: true, reason: true },
    });

    const entries = rows.map((row) => ({ name: row.name, reason: row.reason }));
    const reasonCounts = new Map<string, number>();
    for (const entry of entries) {
      reasonCounts.set(entry.reason, (reasonCounts.get(entry.reason) ?? 0) + 1);
    }

    return NextResponse.json({
      entries,
      total: entries.length,
      byReason: Array.from(reasonCounts.entries()).map(([reason, count]) => ({ reason, count })),
    });
  } catch (error) {
    console.error("[api/pending GET]", error);
    return NextResponse.json(
      { error: "Pending register unavailable.", entries: [], total: 0, byReason: [] },
      { status: 500 },
    );
  }
}
