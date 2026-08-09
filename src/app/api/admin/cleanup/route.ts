// BNDR. API — Admin PII cleanup pass
// ----------------------------------------------------------------------------
// POST /api/admin/cleanup → { reports: PIIPassReport[], changedCount, total }
//   Re-runs normalizeResource() over EVERY stored resource, compares the fresh
//   normalized output to the stored fields, and only updates rows where there
//   is an actual diff (no-op safe — avoids churn). Writes one audit event per changed resource plus a summary event in the
//   same database transaction as the cleanup writes.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { normalizeResource } from "@/lib/pii";
import type { ResourceInput, CategorySlug, PIIPassReport } from "@/lib/types";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";

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
    const all = await db.resource.findMany();
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

      // `fresh.changes` from the pipeline is informational (e.g. it always
      // can note that phone normalization ran whenever a phoneRaw exists, even if
      // the normalized output already matches the stored value). We only
      // treat the row as genuinely CHANGED when a field-level diff exists,
      // so we avoid no-op churn. We still surface the pipeline notes in the
      // report for admin context.
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

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);

    await db.$transaction(async (tx) => {
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
          }),
        },
      });
    }, { timeout: 120000 });

    return NextResponse.json({
      reports,
      changedCount,
      total: all.length,
    });
  } catch (err) {
    console.error("[api/admin/cleanup POST]", err);
    return NextResponse.json(
      { error: "Failed to run PII cleanup pass" },
      { status: 500 },
    );
  }
}
