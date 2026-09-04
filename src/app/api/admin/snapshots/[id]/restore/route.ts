// BNDR. API - audited snapshot restore with mandatory dry-run support and
// cryptographic restore proof. POST { dryRun: true } reports exactly what a
// restore would do without writing. A real restore first verifies the
// snapshot's own integrity (row count AND canonical dataset hash - row count
// alone is never treated as integrity), captures a pre-restore snapshot of
// the current rows (so restores are themselves reversible), atomically
// replaces the resource table, then RE-READS the persisted rows and proves
// count + hash equality with the snapshot before the transaction is allowed
// to commit. Nothing is silently overwritten.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { readBoundedJson, BODY_LIMITS, BoundedBodyError } from "@/lib/zod-schemas";
import { computeResourceDatasetHash } from "@/lib/verification-core.mjs";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const restoreSchema = z.object({
  dryRun: z.boolean().optional(),
}).strict();

type SnapshotRow = Record<string, unknown> & {
  piipassAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

class RestoreVerificationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RestoreVerificationError";
  }
}

function coerceRow(row: SnapshotRow) {
  return {
    ...row,
    piipassAt: row.piipassAt ? new Date(String(row.piipassAt)) : null,
    ...(row.createdAt ? { createdAt: new Date(String(row.createdAt)) } : {}),
    ...(row.updatedAt ? { updatedAt: new Date(String(row.updatedAt)) } : {}),
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
        if (error.code === "INVALID_JSON" && error.message === "Request body is required.") {
          body = {};
        } else {
          return apiError(error.code, error.message, 400);
        }
      } else {
        throw error;
      }
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

    // Snapshot integrity: count AND content hash must both verify before any
    // restore (dry or real). Row count alone is not integrity.
    const rows = (Array.isArray(snapshot.dataJson) ? snapshot.dataJson : []) as SnapshotRow[];
    if (rows.length !== snapshot.rowCount) {
      return apiError(
        "SNAPSHOT_INTEGRITY",
        `Snapshot row payload (${rows.length}) does not match its recorded rowCount (${snapshot.rowCount}).`,
        409,
      );
    }
    if (!snapshot.datasetHash) {
      return apiError(
        "SNAPSHOT_INTEGRITY",
        "Snapshot has no recorded datasetHash, so restoration cannot be proven. Capture a fresh snapshot with the current build.",
        409,
      );
    }
    const payloadHash = computeResourceDatasetHash(rows);
    if (payloadHash !== snapshot.datasetHash) {
      return apiError(
        "SNAPSHOT_INTEGRITY",
        `Snapshot payload hash ${payloadHash.slice(0, 16)} does not match its recorded datasetHash ${snapshot.datasetHash.slice(0, 16)}.`,
        409,
      );
    }

    const currentCount = await db.resource.count();
    if (dryRun) {
      // Dry run: report the exact effect, write nothing.
      return NextResponse.json({
        ok: true,
        dryRun: true,
        snapshotId: snapshot.id,
        snapshotCreatedAt: snapshot.createdAt,
        wouldRemove: currentCount,
        wouldRestore: rows.length,
        datasetHash: snapshot.datasetHash,
        hashVerified: true,
      });
    }

    const result = await db.$transaction(async (tx) => {
      // Restores are reversible: capture the current rows first.
      const current = await tx.resource.findMany();
      const preRestore = await tx.resourceSnapshot.create({
        data: {
          actor,
          reason: `Automatic snapshot before restoring snapshot ${snapshot.id}`,
          trigger: "pre-restore",
          rowCount: current.length,
          datasetHash: computeResourceDatasetHash(current),
          dataJson: current as unknown as object,
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
      // Restoration proof: re-read what the database actually persisted and
      // require exact count AND canonical-hash equality with the snapshot.
      // Any mismatch aborts the transaction (nothing is committed).
      const persisted = await tx.resource.findMany();
      const persistedHash = computeResourceDatasetHash(persisted);
      if (persisted.length !== snapshot.rowCount || persistedHash !== snapshot.datasetHash) {
        throw new RestoreVerificationError(
          `Post-restore verification failed: persisted ${persisted.length}/${snapshot.rowCount} rows, hash ${persistedHash.slice(0, 16)} vs ${snapshot.datasetHash.slice(0, 16)}. Transaction rolled back.`,
        );
      }
      await tx.auditLog.create({
        data: {
          action: "snapshot-restore",
          actor,
          summary: `Restored resource snapshot ${snapshot.id} (${restored} rows; ${removed} replaced; hash verified)`,
          details: JSON.stringify({
            snapshotId: snapshot.id,
            preRestoreSnapshotId: preRestore.id,
            removed,
            restored,
            verifiedRowCount: persisted.length,
            verifiedDatasetHash: persistedHash,
          }),
        },
      });
      return {
        removed,
        restored,
        preRestoreSnapshotId: preRestore.id,
        verified: { rowCount: persisted.length, datasetHash: persistedHash },
      };
    });

    return NextResponse.json({ ok: true, snapshotId: snapshot.id, ...result });
  } catch (error) {
    if (error instanceof RestoreVerificationError) {
      console.error("[api/admin/snapshots/[id]/restore POST] verification", error);
      return apiError("RESTORE_VERIFICATION_FAILED", error.message, 500);
    }
    console.error("[api/admin/snapshots/[id]/restore POST]", error);
    return apiError("INTERNAL", "Failed to restore snapshot.", 500);
  }
}
