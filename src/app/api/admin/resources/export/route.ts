// BNDR. API — authenticated, lossless, re-importable resource backup.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.adminRead);
  if (blocked) return blocked;

  try {
    const rows = await db.resource.findMany({
      orderBy: [{ priority: "desc" }, { name: "asc" }],
    });

    const body = {
      backupVersion: 1,
      exportedAt: new Date().toISOString(),
      mode: "replace",
      confirmReplace: true,
      resources: rows.map((row) => ({
        id: row.id,
        name: row.name,
        acronym: row.acronym,
        description: row.description,
        category: row.category,
        sourceCategory: row.sourceCategory,
        subcategory: row.subcategory,
        phoneRaw: row.phoneRaw,
        phoneNormalized: row.phoneNormalized,
        phoneDisplay: row.phoneDisplay,
        email: row.email,
        address: row.address,
        website: row.website,
        tags: row.tags,
        priority: row.priority,
        verified: row.verified,
        published: row.published,
        sourceNote: row.sourceNote,
        piipassAt: row.piipassAt?.toISOString() ?? null,
        piipassNotes: row.piipassNotes,
        sourceDatasetHash: row.sourceDatasetHash,
        sourceRow: row.sourceRow,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
    const date = new Date().toISOString().slice(0, 10);
    return NextResponse.json(body, {
      headers: {
        "Content-Disposition": `attachment; filename="bndr-resource-backup-${date}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[api/admin/resources/export GET]", error);
    return apiError("INTERNAL", "Failed to export resources.", 500);
  }
}
