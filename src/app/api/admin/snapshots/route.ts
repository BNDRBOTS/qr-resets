// BNDR. API - durable resource snapshots (history of the canonical dataset).
// GET lists snapshot metadata (paginated, newest first). POST captures a
// manual snapshot of the current resource rows. Snapshots are also captured
// automatically before every destructive operation (bulk replace, restore),
// giving the dataset a full audited history with dry-runnable restore.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { readBoundedJson, BODY_LIMITS, BoundedBodyError } from "@/lib/zod-schemas";
import { computeResourceDatasetHash } from "@/lib/verification-core.mjs";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  reason: z.string().trim().min(1).max(500).optional(),
}).strict();

export async function GET(req: NextRequest) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.adminRead);
  if (blocked) return blocked;

  try {
    const sp = req.nextUrl.searchParams;
    const take = Math.min(Math.max(Number(sp.get("take") ?? 50) || 50, 1), 200);
    const skip = Math.max(Number(sp.get("skip") ?? 0) || 0, 0);
    const [total, snapshots] = await Promise.all([
      db.resourceSnapshot.count(),
      db.resourceSnapshot.findMany({
        select: {
          id: true,
          actor: true,
          reason: true,
          trigger: true,
          rowCount: true,
          datasetHash: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        skip,
        take,
      }),
    ]);
    return NextResponse.json({ ok: true, total, snapshots });
  } catch (error) {
    console.error("[api/admin/snapshots GET]", error);
    return apiError("INTERNAL", "Failed to list snapshots.", 500);
  }
}

export async function POST(req: NextRequest) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.resourceMutation);
  if (blocked) return blocked;

  try {
    let body: unknown = {};
    try {
      body = (await readBoundedJson(req, BODY_LIMITS.resourceMutation)) ?? {};
    } catch (error) {
      if (error instanceof BoundedBodyError) {
        return apiError(error.code, error.message, 400);
      }
      throw error;
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid payload.", 400);
    }

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);

    const snapshot = await db.$transaction(async (tx) => {
      const current = await tx.resource.findMany();
      const created = await tx.resourceSnapshot.create({
        data: {
          actor,
          reason: parsed.data.reason ?? "Manual snapshot",
          trigger: "manual",
          rowCount: current.length,
          datasetHash: computeResourceDatasetHash(current),
          dataJson: current as unknown as object,
        },
      });
      await tx.auditLog.create({
        data: {
          action: "snapshot-create",
          actor,
          summary: `Captured resource snapshot (${current.length} rows)`,
          details: JSON.stringify({
            snapshotId: created.id,
            rowCount: current.length,
            datasetHash: created.datasetHash,
          }),
        },
      });
      return created;
    });

    return NextResponse.json(
      {
        ok: true,
        id: snapshot.id,
        rowCount: snapshot.rowCount,
        datasetHash: snapshot.datasetHash,
        createdAt: snapshot.createdAt,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[api/admin/snapshots POST]", error);
    return apiError("INTERNAL", "Failed to create snapshot.", 500);
  }
}
