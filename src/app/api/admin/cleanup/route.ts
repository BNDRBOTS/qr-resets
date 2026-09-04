// BNDR. API - Admin PII cleanup pass with dry-run and durable pre-mutation
// snapshot.
// ----------------------------------------------------------------------------
// POST /api/admin/cleanup { mode: "preview" | "apply", ids? }
//   Re-runs normalizeResource() over stored resources, compares the fresh
//   normalized output to the stored fields, and treats a row as changed only
//   when a real field-level diff exists (no-op safe - avoids churn).
//   - mode "preview" (the schema default): full report of exactly what an
//     apply WOULD change. Zero writes of any kind.
//   - mode "apply": captures a durable ResourceSnapshot (trigger
//     "pre-cleanup", with row count + canonical dataset hash) of every
//     current row inside the same transaction BEFORE any mutation, then
//     updates changed rows only, writing one audit event per changed
//     resource plus a summary event. The snapshot is restorable (and
//     dry-runnable) via /api/admin/snapshots, so cleanup is fully
//     reversible and audited end to end.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeResource } from "@/lib/pii";
import type { ResourceInput, CategorySlug, PIIPassReport } from "@/lib/types";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  cleanupCommandSchema,
  readBoundedJson,
  BODY_LIMITS,
  BoundedBodyError,
} from "@/lib/zod-schemas";
import { computeResourceDatasetHash } from "@/lib/verification-core.mjs";

export const dynamic = "force-dynamic";

// Compare the freshly-normalized output to what's already stored.
// Returns the list of meaningful diffs (empty = no-op).
function diffFields(
  stored: {
    name: string;
    phoneNormalized: string | null;
    email: string | null;
    website: string | null;
    description: string | null;
  },
  fresh: {
    name: string;
    phoneNormalized: string | null;
    email: string | null;
    website: string | null;
    description: string | null;
  },
): string[] {
  const diffs: string[] = [];
  if (stored.name !== fresh.name) {
    diffs.push("name normalized");
  }
  if ((stored.phoneNormalized ?? null) !== (fresh.phoneNormalized ?? null)) {
    diffs.push("phoneNormalized changed");
  }
  if ((stored.email ?? null) !== (fresh.email ?? null)) {
    diffs.push("email changed");
  }
  if ((stored.website ?? null) !== (fresh.website ?? null)) {
    diffs.push("website changed");
  }
  if ((stored.description ?? null) !== (fresh.description ?? null)) {
    diffs.push(`description changed`);
  }
  return diffs;
}

export async function POST(req: Request) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.cleanup);
  if (blocked) return blocked;

  try {
    let body: unknown = { mode: "preview" };
    try {
      body = await readBoundedJson(req, BODY_LIMITS.command);
    } catch (error) {
      if (error instanceof BoundedBodyError) {
        if (error.code === "INVALID_JSON" && error.message === "Request body is required.") {
          // Legacy bare POST: treated as a read-only preview, never an apply.
          body = { mode: "preview" };
        } else {
          return apiError(error.code, error.message, 400);
        }
      } else {
        throw error;
      }
    }
    const parsed = cleanupCommandSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid payload.",
        400,
      );
    }
    const { mode, ids } = parsed.data;
    const dryRun = mode !== "apply";

    const all = await db.resource.findMany(
      ids && ids.length > 0 ? { where: { id: { in: ids } } } : undefined,
    );
    const reports: PIIPassReport[] = [];
    const updates: Array<{
      id: string;
      name: string;
      data: {
        name: string;
        phoneNormalized: string | null;
        email: string | null;
        website: string | null;
        description: string | null;
        piipassAt: Date;
        piipassNotes: string;
      };
      diffs: string[];
    }> = [];
    let changedCount = 0;

    for (const row of all) {
      // Reconstruct a ResourceInput from the stored row (using stored raw
      // fields, not the normalized ones) so the pipeline runs cleanly.
      const input: ResourceInput = {
        name: row.name,
        acronym: row.acronym,
        description: row.description,
        category: row.category as CategorySlug,
        subcategory: row.subcategory,
        phoneRaw: row.phoneRaw,
        email: row.email,
        address: row.address,
        website: row.website,
        tags: row.tags,
        priority: row.priority,
        verified: row.verified,
        sourceNote: row.sourceNote,
      };

      const fresh = normalizeResource(input);

      const stored = {
        name: row.name,
        phoneNormalized: row.phoneNormalized,
        email: row.email,
        website: row.website,
        description: row.description,
      };
      const freshComparable = {
        name: fresh.name,
        phoneNormalized: fresh.phoneNormalized,
        email: fresh.email,
        website: fresh.website,
        description: fresh.description,
      };

      const diffs = diffFields(stored, freshComparable);

      // `fresh.changes` from the pipeline is informational (it can note that
      // normalization ran even when the output already matches the stored
      // value). A row is only genuinely CHANGED when a field-level diff
      // exists, so no-op churn is avoided while the pipeline notes are still
      // surfaced in the report for admin context.
      const pipelineNotes = fresh.changes;
      const hasChange = diffs.length > 0;

      if (hasChange) {
        changedCount++;
        updates.push({
          id: row.id,
          name: row.name,
          data: {
            name: fresh.name,
            phoneNormalized: fresh.phoneNormalized,
            email: fresh.email,
            website: fresh.website,
            description: fresh.description,
            piipassAt: new Date(),
            piipassNotes:
              [...diffs, ...pipelineNotes].join(" | ") || "no changes",
          },
          diffs: [...diffs, ...pipelineNotes],
        });
      }

      reports.push({
        resourceId: row.id,
        name: row.name,
        changed: hasChange,
        changes: [...diffs, ...pipelineNotes],
      });
    }

    if (dryRun) {
      // Dry run: report exactly what an apply would change. Zero writes.
      return NextResponse.json({
        ok: true,
        dryRun: true,
        mode,
        reports,
        changedCount,
        total: all.length,
        wouldUpdate: updates.map((update) => update.id),
      });
    }

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);

    let snapshotId: string | null = null;
    await db.$transaction(
      async (tx) => {
        if (updates.length > 0) {
          // Durable pre-mutation snapshot: cleanup rewrites rows in place, so
          // the full pre-cleanup dataset (row count + canonical dataset hash)
          // is preserved first, with audited, dry-runnable restore via
          // /api/admin/snapshots.
          const current = await tx.resource.findMany();
          const snapshot = await tx.resourceSnapshot.create({
            data: {
              actor,
              reason: "Automatic snapshot before PII cleanup pass",
              trigger: "pre-cleanup",
              rowCount: current.length,
              datasetHash: computeResourceDatasetHash(current),
              dataJson: current as unknown as object,
            },
          });
          snapshotId = snapshot.id;
        }
        for (const update of updates) {
          await tx.resource.update({ where: { id: update.id }, data: update.data });
          await tx.auditLog.create({
            data: {
              action: "piipass-resource",
              resourceId: update.id,
              actor,
              summary: `PII cleanup updated resource: ${update.name}`,
              details: JSON.stringify({ changes: update.diffs }),
            },
          });
        }
        await tx.auditLog.create({
          data: {
            action: "piipass",
            actor,
            summary: `PII cleanup pass: ${changedCount}/${all.length} resource(s) updated.`,
            details: JSON.stringify({
              total: all.length,
              changedCount,
              changedResourceIds: updates.map((update) => update.id),
              preCleanupSnapshotId: snapshotId,
            }),
          },
        });
      },
      { timeout: 120000 },
    );

    return NextResponse.json({
      ok: true,
      dryRun: false,
      mode,
      reports,
      changedCount,
      total: all.length,
      snapshotId,
    });
  } catch (err) {
    console.error("[api/admin/cleanup POST]", err);
    return NextResponse.json(
      { error: "Failed to run PII cleanup pass" },
      { status: 500 },
    );
  }
}
