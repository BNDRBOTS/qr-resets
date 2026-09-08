// BNDR. API - verification run queue (read-only listing).
// Runs are persisted queue rows claimed by the durable worker; this endpoint
// exposes their status, attempts, and error trail to the admin Verification
// tab, plus aggregate publish-state counts for the review queue header.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.adminRead);
  if (blocked) return blocked;

  try {
    const rawTake = Number.parseInt(req.nextUrl.searchParams.get("take") ?? "50", 10);
    const take = Math.min(Number.isFinite(rawTake) && rawTake > 0 ? rawTake : 50, 200);
    const [rows, groups] = await Promise.all([
      db.verificationRun.findMany({
        orderBy: { createdAt: "desc" },
        take,
        include: { _count: { select: { results: true } } },
      }),
      db.verificationResult.groupBy({
        by: ["publishState"],
        _count: { _all: true },
      }),
    ]);
    const runs = rows.map((row) => {
      const { _count, ...run } = row;
      return { ...run, resultCount: _count.results };
    });
    const publishStateCounts = Object.fromEntries(
      groups.map((group) => [group.publishState, group._count._all]),
    );
    return NextResponse.json({ ok: true, runs, publishStateCounts });
  } catch (error) {
    console.error("[api/admin/verification/runs GET]", error);
    return apiError("INTERNAL", "Failed to load verification runs.", 500);
  }
}
