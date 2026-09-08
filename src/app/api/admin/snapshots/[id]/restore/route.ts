// BNDR. API - audited snapshot restore with mandatory dry-run support.
// POST { dryRun: true } reports exactly what a restore would do without
// writing. A real restore first captures a pre-restore snapshot of the
// current rows (so restores are themselves reversible), then atomically
// replaces the resource table with the snapshot rows and writes an audit
// log entry. Nothing is silently overwritten.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { readBoundedJson, BODY_LIMITS, BoundedBodyError } from "@/lib/zod-schemas";
import { hashSnapshotRows, prepareResourceSnapshot, verifyResourceSnapshot, type SnapshotRow } from "@/lib/resource-snapshot";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const restoreSchema = z.object({
  dryRun: z.boolean().optional(),
}).strict();

function coerceRow(row: SnapshotRow) {
  const piipassAt = row.piipassAt;
  const createdAt = row.createdAt;
  const updatedAt = row.updatedAt;
  return {
    ...row,
    piipassAt: piipassAt ? new Date(String(piipassAt)) : null,
    ...(createdAt ? { createdAt: new Date(String(createdAt)) } : {}),
    ...(updatedAt ? { updatedAt: new Date(String(updatedAt)) } : {}),
  };
}

export async function POST(req: NextRequest, context: RouteContext) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.resourceMutation);
  if (blocked) return blocked;

  try {
    const { id } = await context.params;
    let body: unknown = {};
    try {
      body = (await readBoundedJson(req, BODY_LIMITS.resourceMutation)) ?? {};
    } catch (error) {
      if (error instanceof BoundedBodyError) {
        return apiError(error.code, error.message, 400);
      }
      throw error;
    }
    const parsed = restoreSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid payload.", 400);
    }
    const dryRun = parsed.data.dryRun === true;

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);

    const snapshot = await db.resourceSnapshot.findUnique({ where: { id } });
    if (!snapshot) return apiError("NOT_FOUND", "Snapshot not found.", 404);

    const verifiedSnapshot = verifyResourceSnapshot(snapshot);
    if (!verifiedSnapshot.ok) {
      return apiError("SNAPSHOT_INTEGRITY", verifiedSnapshot.reason, 409);
    }
    const rows = verifiedSnapshot.rows;

    const current = await db.resource.findMany();
    const currentPrepared = prepareResourceSnapshot(current);
    if (dryRun) {
      // Dry run: prove source snapshot integrity and report the exact effect.
      // No rows, snapshots, or audit entries are written.
      return NextResponse.json({
        ok: true,
        dryRun: true,
        snapshotId: snapshot.id,
        snapshotCreatedAt: snapshot.createdAt,
        snapshotHash: verifiedSnapshot.datasetHash,
        currentCount: currentPrepared.rowCount,
        currentHash: currentPrepared.datasetHash,
        wouldRemove: currentPrepared.rowCount,
        wouldRestore: rows.length,
      });
    }

    const result = await db.$transaction(async (tx) => {
      // Restores are reversible: capture the exact current rows and hash first.
      const currentRows = await tx.resource.findMany();
      const preRestorePrepared = prepareResourceSnapshot(currentRows);
      const preRestore = await tx.resourceSnapshot.create({
        data: {
          actor,
          reason: `Automatic snapshot before restoring snapshot ${snapshot.id}`,
          trigger: "pre-restore",
          rowCount: preRestorePrepared.rowCount,
          datasetHash: preRestorePrepared.datasetHash,
          dataJson: preRestorePrepared.rows as unknown as object,
        },
      });
      const removed = (await tx.resource.deleteMany()).count;
      let restored = 0;
      if (rows.length) {
        restored = (
          await tx.resource.createMany({
            data: rows.map(coerceRow) as never[],
          })
        ).count;
      }

      // Proof, not a row-count proxy: re-read the restored database state and
      // require count + canonicalized full-row SHA-256 equality before commit.
      const restoredRows = await tx.resource.findMany();
      const restoredHash = hashSnapshotRows(restoredRows);
      if (restoredRows.length !== snapshot.rowCount || restored !== snapshot.rowCount) {
        throw new Error(
          `SNAPSHOT_RESTORE_COUNT_MISMATCH expected=${snapshot.rowCount} created=${restored} read=${restoredRows.length}`,
        );
      }
      if (restoredHash !== verifiedSnapshot.datasetHash) {
        throw new Error(
          `SNAPSHOT_RESTORE_HASH_MISMATCH expected=${verifiedSnapshot.datasetHash} got=${restoredHash}`,
        );
      }

      await tx.auditLog.create({
        data: {
          action: "snapshot-restore",
          actor,
          summary: `Restored resource snapshot ${snapshot.id} (${restored} rows; exact hash verified)`,
          details: JSON.stringify({
            snapshotId: snapshot.id,
            snapshotHash: verifiedSnapshot.datasetHash,
            preRestoreSnapshotId: preRestore.id,
            preRestoreHash: preRestorePrepared.datasetHash,
            removed,
            restored,
            restoredHash,
            exactRecoveryVerified: true,
          }),
        },
      });
      return {
        removed,
        restored,
        restoredHash,
        expectedHash: verifiedSnapshot.datasetHash,
        exactRecoveryVerified: true,
        preRestoreSnapshotId: preRestore.id,
      };
    });

    return NextResponse.json({ ok: true, snapshotId: snapshot.id, ...result });
  } catch (error) {
    console.error("[api/admin/snapshots/[id]/restore POST]", error);
    return apiError("INTERNAL", "Failed to restore snapshot.", 500);
  }
}
