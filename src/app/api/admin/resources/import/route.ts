// BNDR. API — authenticated bulk resource import.
// Accepts validated JSON only. "replace" requires explicit confirmation and
// runs in one transaction, so a bad row cannot partially replace the dataset.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { normalizeResource } from "@/lib/pii";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  resourceInputSchema,
  readBoundedJson,
  BODY_LIMITS,
  BoundedBodyError,
} from "@/lib/zod-schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const optionalNullableString = (max: number) =>
  z.string().trim().max(max).nullable().optional();

const importResourceSchema = resourceInputSchema.extend({
  id: z.string().trim().min(1).max(200).optional(),
  sourceCategory: optionalNullableString(300),
  phoneNormalized: optionalNullableString(200),
  phoneDisplay: optionalNullableString(200),
  piipassAt: z.string().datetime().nullable().optional(),
  piipassNotes: optionalNullableString(5000),
  sourceDatasetHash: optionalNullableString(128),
  sourceRow: z.number().int().positive().nullable().optional(),
  createdAt: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime().nullable().optional(),
});

const importSchema = z
  .object({
    backupVersion: z.number().int().positive().optional(),
    exportedAt: z.string().datetime().optional(),
    dataset: z
      .object({
        filename: z.string().trim().min(1).max(500),
        sha256: z.string().regex(/^[a-f0-9]{64}$/i),
        rowCount: z.number().int().positive(),
      })
      .strict()
      .optional(),
    mode: z.enum(["append", "replace"]).default("append"),
    confirmReplace: z.boolean().optional(),
    resources: z.array(importResourceSchema).min(1).max(1000),
  })
  .strict();

export async function POST(req: NextRequest) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.bulkImport);
  if (blocked) return blocked;

  try {
    let body: unknown;
    try {
      body = await readBoundedJson(req, BODY_LIMITS.bulkImport);
    } catch (error) {
      if (error instanceof BoundedBodyError) {
        return apiError(error.code, error.message, 400);
      }
      throw error;
    }

    const parsed = importSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid import payload.",
        400,
      );
    }

    const { mode, confirmReplace, resources, dataset } = parsed.data;
    if (dataset && dataset.rowCount !== resources.length) {
      return apiError(
        "DATASET_COUNT_MISMATCH",
        `Dataset metadata declares ${dataset.rowCount} rows but the payload contains ${resources.length}.`,
        400,
      );
    }
    if (mode === "replace" && confirmReplace !== true) {
      return apiError(
        "REPLACE_CONFIRMATION_REQUIRED",
        "Set confirmReplace to true to replace all resource rows.",
        409,
      );
    }

    const rows = resources.map((input) => {
      const normalized = normalizeResource(input);
      return {
        ...(input.id ? { id: input.id } : {}),
        name: normalized.name,
        acronym: input.acronym,
        description: normalized.description,
        category: input.category,
        sourceCategory: input.sourceCategory ?? null,
        subcategory: input.subcategory,
        phoneRaw: input.phoneRaw,
        phoneNormalized: input.phoneNormalized ?? normalized.phoneNormalized,
        phoneDisplay: input.phoneDisplay ?? null,
        email: normalized.email,
        address: input.address,
        website: normalized.website,
        tags: input.tags,
        priority: input.priority,
        verified: input.verified,
        published: input.published,
        sourceNote: input.sourceNote,
        piipassAt: input.piipassAt ? new Date(input.piipassAt) : new Date(),
        piipassNotes:
          input.piipassNotes ??
          (normalized.changes.length
            ? normalized.changes.join(" | ")
            : "no changes"),
        sourceDatasetHash:
          input.sourceDatasetHash ?? dataset?.sha256.toLowerCase() ?? null,
        sourceRow: input.sourceRow ?? null,
        ...(input.createdAt ? { createdAt: new Date(input.createdAt) } : {}),
        ...(input.updatedAt ? { updatedAt: new Date(input.updatedAt) } : {}),
      };
    });

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);

    const result = await db.$transaction(async (tx) => {
      const removed =
        mode === "replace" ? (await tx.resource.deleteMany()).count : 0;
      const inserted = (await tx.resource.createMany({ data: rows })).count;

      await tx.auditLog.create({
        data: {
          action: mode === "replace" ? "bulk-replace" : "bulk-import",
          actor,
          summary:
            mode === "replace"
              ? `Replaced ${removed} resource(s) with ${inserted} validated resource(s)`
              : `Imported ${inserted} validated resource(s)`,
          details: JSON.stringify({
            mode,
            removed,
            inserted,
            dataset: dataset ?? null,
          }),
        },
      });

      return { removed, inserted };
    });

    return NextResponse.json({ ok: true, mode, ...result });
  } catch (error) {
    console.error("[api/admin/resources/import POST]", error);
    return apiError("INTERNAL", "Failed to import resources.", 500);
  }
}
