import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { readBoundedJson, BODY_LIMITS, BoundedBodyError } from "@/lib/zod-schemas";
import { hashSnapshotRows, verifyResourceSnapshot, type SnapshotRow } from "@/lib/resource-snapshot";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };
const bodySchema = z.object({ snapshotId: z.string().min(1) }).strict();

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
    let body: unknown;
    try {
      body = await readBoundedJson(req, BODY_LIMITS.resourceMutation);
    } catch (error) {
      if (error instanceof BoundedBodyError) return apiError(error.code, error.message, 400);
      throw error;
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid restore payload.", 400);
    }

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);

    const snapshot = await db.resourceSnapshot.findUnique({ where: { id: parsed.data.snapshotId } });
    if (!snapshot) return apiError("NOT_FOUND", "Recovery snapshot not found.", 404);
    if (snapshot.trigger !== "pre-delete") {
      return apiError("INVALID_RECOVERY_SNAPSHOT", "This snapshot was not created for a resource deletion.", 409);
    }

    const verified = verifyResourceSnapshot(snapshot);
    if (!verified.ok) return apiError("SNAPSHOT_INTEGRITY", verified.reason, 409);
    const priorRow = verified.rows.find((row) => String(row.id ?? "") === id);
    if (!priorRow) return apiError("RECOVERY_ROW_MISSING", "The deleted resource is not present in the recovery snapshot.", 409);
    const expectedRowHash = hashSnapshotRows([priorRow]);

    const result = await db.$transaction(async (tx) => {
      const current = await tx.resource.findUnique({ where: { id } });
      if (current) {
        throw new Error("RESOURCE_ALREADY_EXISTS");
      }
      await tx.resource.create({ data: coerceRow(priorRow) as never });
      const restored = await tx.resource.findUnique({ where: { id } });
      if (!restored) throw new Error("RESTORE_READBACK_MISSING");
      const restoredRowHash = hashSnapshotRows([restored]);
      if (restoredRowHash !== expectedRowHash) {
        throw new Error(`RESTORE_ROW_HASH_MISMATCH expected=${expectedRowHash} got=${restoredRowHash}`);
      }
      await tx.auditLog.create({
        data: {
          action: "delete-undo",
          resourceId: id,
          actor,
          summary: `Restored permanently deleted resource from verified snapshot: ${String(priorRow.name ?? id)}`,
          details: JSON.stringify({
            snapshotId: snapshot.id,
            snapshotHash: verified.datasetHash,
            expectedRowHash,
            restoredRowHash,
            exactRecoveryVerified: true,
          }),
        },
      });
      return { restored, restoredRowHash };
    });

    return NextResponse.json({
      ok: true,
      id,
      snapshotId: snapshot.id,
      expectedRowHash,
      restoredRowHash: result.restoredRowHash,
      exactRecoveryVerified: true,
      resource: result.restored,
    });
  } catch (error) {
    if (error instanceof Error && error.message === "RESOURCE_ALREADY_EXISTS") {
      return apiError("RESOURCE_ALREADY_EXISTS", "Undo stopped because a resource with this exact ID already exists.", 409);
    }
    console.error("[api/admin/resources/:id/restore-deleted POST]", error);
    return apiError("INTERNAL", "Failed to restore the deleted resource.", 500);
  }
}
