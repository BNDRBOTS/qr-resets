// BNDR. API — Admin PII cleanup pass.
// POST { mode: "preview" | "apply" }
// Preview is a true dry run: no snapshot, resource, or audit writes.
// Apply recomputes against the current transaction state, captures a durable
// full-row snapshot + SHA-256 before the first mutation, then writes cleanup
// changes and audit evidence atomically.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeResource } from "@/lib/pii";
import { prepareResourceSnapshot } from "@/lib/resource-snapshot";
import type { ResourceInput, CategorySlug, PIIPassReport } from "@/lib/types";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  cleanupCommandSchema,
  readBoundedJson,
  BODY_LIMITS,
  BoundedBodyError,
} from "@/lib/zod-schemas";

export const dynamic = "force-dynamic";

type StoredRow = Awaited<ReturnType<typeof db.resource.findMany>>[number];

type CleanupUpdate = {
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
};

function diffFields(
  stored: Pick<StoredRow, "name" | "phoneNormalized" | "email" | "website" | "description">,
  fresh: {
    name: string;
    phoneNormalized: string | null;
    email: string | null;
    website: string | null;
    description: string | null;
  },
): string[] {
  const diffs: string[] = [];
  if (stored.name !== fresh.name) diffs.push("name normalized");
  if ((stored.phoneNormalized ?? null) !== (fresh.phoneNormalized ?? null)) diffs.push("phoneNormalized changed");
  if ((stored.email ?? null) !== (fresh.email ?? null)) diffs.push("email changed");
  if ((stored.website ?? null) !== (fresh.website ?? null)) diffs.push("website changed");
  if ((stored.description ?? null) !== (fresh.description ?? null)) diffs.push("description changed");
  return diffs;
}

function analyzeRows(all: StoredRow[], ids?: string[]): {
  reports: PIIPassReport[];
  updates: CleanupUpdate[];
} {
  const onlyIds = ids?.length ? new Set(ids) : null;
  const reports: PIIPassReport[] = [];
  const updates: CleanupUpdate[] = [];

  for (const row of all) {
    if (onlyIds && !onlyIds.has(row.id)) continue;
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
      published: row.published,
      sourceNote: row.sourceNote,
    };

    const fresh = normalizeResource(input);
    const diffs = diffFields(row, {
      name: fresh.name,
      phoneNormalized: fresh.phoneNormalized,
      email: fresh.email,
      website: fresh.website,
      description: fresh.description,
    });
    const notes = [...diffs, ...fresh.changes];
    const changed = diffs.length > 0;

    if (changed) {
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
          piipassNotes: notes.join(" | ") || "no changes",
        },
        diffs: notes,
      });
    }

    reports.push({
      resourceId: row.id,
      name: row.name,
      changed,
      changes: notes,
    });
  }

  return { reports, updates };
}

export async function POST(req: Request) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.cleanup);
  if (blocked) return blocked;

  try {
    let body: unknown = {};
    try {
      body = (await readBoundedJson(req, BODY_LIMITS.resourceMutation)) ?? {};
    } catch (error) {
      if (error instanceof BoundedBodyError) return apiError(error.code, error.message, 400);
      throw error;
    }
    const parsed = cleanupCommandSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid cleanup command.", 400);
    }

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);

    if (parsed.data.mode === "preview") {
      const all = await db.resource.findMany();
      const { reports, updates } = analyzeRows(all, parsed.data.ids);
      return NextResponse.json({
        dryRun: true,
        mode: "preview",
        reports,
        changedCount: updates.length,
        total: reports.length,
      });
    }

    const result = await db.$transaction(async (tx) => {
      // Re-read and re-analyze inside the mutation transaction so the snapshot
      // and cleanup are based on the exact same pre-mutation dataset state.
      const current = await tx.resource.findMany();
      const { reports, updates } = analyzeRows(current, parsed.data.ids);
      let snapshotId: string | null = null;
      let snapshotHash: string | null = null;

      if (updates.length > 0) {
        const prepared = prepareResourceSnapshot(current);
        const snapshot = await tx.resourceSnapshot.create({
          data: {
            actor,
            reason: "Automatic snapshot before PII cleanup mutation",
            trigger: "pre-cleanup",
            rowCount: prepared.rowCount,
            datasetHash: prepared.datasetHash,
            dataJson: prepared.rows as unknown as object,
          },
        });
        snapshotId = snapshot.id;
        snapshotHash = prepared.datasetHash;
      }

      for (const update of updates) {
        await tx.resource.update({ where: { id: update.id }, data: update.data });
        await tx.auditLog.create({
          data: {
            action: "piipass-resource",
            resourceId: update.id,
            actor,
            summary: `PII cleanup updated resource: ${update.name}`,
            details: JSON.stringify({ changes: update.diffs, preMutationSnapshotId: snapshotId }),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          action: "piipass",
          actor,
          summary: `PII cleanup apply: ${updates.length}/${reports.length} resource(s) updated.`,
          details: JSON.stringify({
            total: reports.length,
            changedCount: updates.length,
            changedResourceIds: updates.map((update) => update.id),
            preMutationSnapshotId: snapshotId,
            preMutationDatasetHash: snapshotHash,
          }),
        },
      });

      return { reports, updates, snapshotId, snapshotHash };
    }, { timeout: 120000 });

    return NextResponse.json({
      dryRun: false,
      mode: "apply",
      reports: result.reports,
      changedCount: result.updates.length,
      total: result.reports.length,
      snapshotId: result.snapshotId,
      snapshotHash: result.snapshotHash,
    });
  } catch (err) {
    console.error("[api/admin/cleanup POST]", err);
    return NextResponse.json({ error: "Failed to run PII cleanup pass" }, { status: 500 });
  }
}
