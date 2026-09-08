// BNDR. API - verification results listing for the admin review queue.
// Supports filtering by run, publish state, review state, and free text,
// with total count + skip/take paging.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

function intParam(value: string | null, fallback: number, max: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 0) return fallback;
  return Math.min(parsed, max);
}

export async function GET(req: NextRequest) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.adminRead);
  if (blocked) return blocked;

  try {
    const params = req.nextUrl.searchParams;
    const runId = params.get("runId")?.trim() || undefined;
    const publishState = params.get("publishState")?.trim() || undefined;
    const reviewState = params.get("reviewState")?.trim() || undefined;
    const q = params.get("q")?.trim() || undefined;
    const take = intParam(params.get("take"), 100, 200) || 100;
    const skip = intParam(params.get("skip"), 0, 100_000);

    const where = {
      ...(runId ? { runId } : {}),
      ...(publishState ? { publishState } : {}),
      ...(reviewState ? { reviewState } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { suggestedName: { contains: q } },
              { recordId: { contains: q } },
              { organizationStatus: { contains: q } },
            ],
          }
        : {}),
    };

    const [total, results] = await Promise.all([
      db.verificationResult.count({ where }),
      db.verificationResult.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip,
        take,
        include: {
          issues: true,
          run: { select: { id: true, origin: true, status: true, createdAt: true } },
        },
      }),
    ]);

    return NextResponse.json({ ok: true, total, results });
  } catch (error) {
    console.error("[api/admin/verification/results GET]", error);
    return apiError("INTERNAL", "Failed to load verification results.", 500);
  }
}
