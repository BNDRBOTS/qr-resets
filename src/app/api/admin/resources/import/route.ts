// BNDR. API — authenticated, transactional resource import.
// TXT, Markdown, JSON, and XML converge on the same Resource write pipeline.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { formatPhoneDisplay, normalizeResource } from "@/lib/pii";
import {
  prepareResourceBatch,
  prepareResourceDocument,
  ResourceIngestionError,
  type PreparedResourceCandidate,
  type ResourceInputFormat,
} from "@/lib/resource-ingestion";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { stageVerificationRun } from "@/lib/verification-pipeline";
import { computeResourceDatasetHash } from "@/lib/verification-core.mjs";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  readBoundedJson,
  BODY_LIMITS,
  BoundedBodyError,
} from "@/lib/zod-schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const datasetSchema = z.object({
  filename: z.string().trim().min(1).max(500),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  rowCount: z.number().int().positive(),
}).strict();

const envelopeFields = {
  backupVersion: z.number().int().positive().optional(),
  exportedAt: z.string().datetime().optional(),
  dataset: datasetSchema.optional(),
  mode: z.enum(["append", "replace"]).default("append"),
  confirmReplace: z.boolean().optional(),
  dryRun: z.boolean().optional(),
};

const objectEnvelopeSchema = z.object({
  ...envelopeFields,
  resources: z.array(z.record(z.string(), z.unknown())).min(1).max(1000),
}).strict();

const documentEnvelopeSchema = z.object({
  ...envelopeFields,
  content: z.string().min(1).max(BODY_LIMITS.bulkImport),
  format: z.enum(["txt", "markdown", "json", "xml"]).optional(),
  filename: z.string().trim().max(500).optional().default(""),
}).strict();

const importMetadataSchema = z.object({
  id: z.string().trim().min(1).max(200).optional(),
  sourceCategory: z.string().trim().max(300).nullable().optional(),
  phoneDisplay: z.string().trim().max(200).nullable().optional(),
  piipassAt: z.string().datetime().nullable().optional(),
  piipassNotes: z.string().trim().max(5000).nullable().optional(),
  sourceDatasetHash: z.string().trim().max(128).nullable().optional(),
  sourceRow: z.number().int().positive().nullable().optional(),
  createdAt: z.string().datetime().nullable().optional(),
  updatedAt: z.string().datetime().nullable().optional(),
}).strict();

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

    const parsedObject = objectEnvelopeSchema.safeParse(body);
    const parsedDocument = parsedObject.success ? null : documentEnvelopeSchema.safeParse(body);
    if (!parsedObject.success && !parsedDocument?.success) {
      const issue = parsedDocument?.error.issues[0] ?? parsedObject.error.issues[0];
      return apiError("VALIDATION_ERROR", issue?.message ?? "Invalid import payload.", 400);
    }

    let envelope: z.infer<typeof objectEnvelopeSchema> | z.infer<typeof documentEnvelopeSchema>;
    let prepared: PreparedResourceCandidate[];
    if (parsedObject.success) {
      envelope = parsedObject.data;
      prepared = prepareResourceBatch(parsedObject.data.resources);
    } else {
      if (!parsedDocument?.success) {
        return apiError("VALIDATION_ERROR", "Invalid import payload.", 400);
      }
      envelope = parsedDocument.data;
      prepared = prepareResourceDocument(
        parsedDocument.data.content,
        parsedDocument.data.format as ResourceInputFormat | undefined,
        parsedDocument.data.filename,
      ).resources;
    }

    const { mode, confirmReplace, dataset } = envelope;
    const dryRun = envelope.dryRun === true;
    if (dataset && dataset.rowCount !== prepared.length) {
      return apiError(
        "DATASET_COUNT_MISMATCH",
        `Dataset metadata declares ${dataset.rowCount} rows but the parsed input contains ${prepared.length}.`,
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

    const metadata = prepared.map(readMetadata);
    const ids = metadata.flatMap((item) => item.id ? [item.id] : []);
    if (new Set(ids).size !== ids.length) {
      throw new ResourceIngestionError(
        "DUPLICATE_RESOURCE_ID",
        "The import contains a duplicate resource ID; no rows were written.",
      );
    }

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);

    const existing = await db.resource.findMany({
      select: { id: true, name: true, email: true, website: true, phoneNormalized: true },
    });

    if (dryRun) {
      // Destructive-operation dry run: report exactly what would happen and
      // write nothing (no rows, no staging, no snapshots, no audit entries).
      return NextResponse.json({
        ok: true,
        dryRun: true,
        mode,
        currentRows: existing.length,
        wouldRemove: mode === "replace" ? existing.length : 0,
        wouldInsert: mode === "replace" ? prepared.length : 0,
        wouldStage: mode === "append" ? prepared.length : 0,
      });
    }

    if (mode === "append") {
      // Append mode is the automatic verification pipeline: candidates are
      // staged as a durable queued verification run, verified by the bundled
      // verifier v4, classified (strong/ambiguous dedupe, issues, evidence-
      // gated admission), and then reviewed/published from the admin
      // Verification tab. Nothing is written to the canonical Resource table
      // here, so identity overlaps with existing rows are classified per
      // record (canonical_match/held) instead of failing the whole batch.
      const existingIds = new Set(existing.map((item) => item.id));
      if (ids.some((id) => existingIds.has(id))) {
        throw new ResourceIngestionError(
          "DUPLICATE_RESOURCE_ID",
          "The import contains an existing resource ID; no rows were staged.",
        );
      }
      const run = await stageVerificationRun({
        actor,
        origin: "bulk-import",
        candidates: prepared.map((candidate) => ({
          source: candidate.original as Record<string, unknown>,
        })),
      });
      return NextResponse.json({
        ok: true,
        mode,
        removed: 0,
        inserted: 0,
        staged: prepared.length,
        runId: run.id,
        runStatus: run.status,
      });
    }

    const rows = prepared.map((candidate, index) => buildRow(candidate, metadata[index], dataset));

    const result = await db.$transaction(async (tx) => {
      if (mode === "replace") {
        // Durable pre-destruction snapshot: full-row history with audited,
        // dry-runnable restore via /api/admin/snapshots.
        const current = await tx.resource.findMany();
        await tx.resourceSnapshot.create({
          data: {
            actor,
            reason: "Automatic snapshot before bulk replace import",
            trigger: "pre-replace-import",
            rowCount: current.length,
            datasetHash: computeResourceDatasetHash(current),
            dataJson: current as unknown as object,
          },
        });
      }
      const removed = mode === "replace" ? (await tx.resource.deleteMany()).count : 0;
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
            viability: prepared.reduce<Record<string, number>>((counts, item) => {
              counts[item.viability] = (counts[item.viability] ?? 0) + 1;
              return counts;
            }, {}),
          }),
        },
      });

      return { removed, inserted };
    });

    return NextResponse.json({ ok: true, mode, ...result });
  } catch (error) {
    if (error instanceof ResourceIngestionError) {
      const status = error.code.startsWith("DUPLICATE_") ? 409 : 400;
      return apiError(error.code, error.message, status);
    }
    console.error("[api/admin/resources/import POST]", error);
    return apiError("INTERNAL", "Failed to import resources.", 500);
  }
}

function readMetadata(candidate: PreparedResourceCandidate) {
  const source = candidate.original;
  const parsed = importMetadataSchema.safeParse({
    id: source.id,
    sourceCategory: source.sourceCategory,
    phoneDisplay: source.phoneDisplay,
    piipassAt: source.piipassAt,
    piipassNotes: source.piipassNotes,
    sourceDatasetHash: source.sourceDatasetHash,
    sourceRow: source.sourceRow,
    createdAt: source.createdAt,
    updatedAt: source.updatedAt,
  });
  if (!parsed.success) {
    throw new ResourceIngestionError(
      "MALFORMED_RESOURCE_METADATA",
      parsed.error.issues[0]?.message ?? "Resource metadata is malformed.",
    );
  }
  return parsed.data;
}

function buildRow(
  candidate: PreparedResourceCandidate,
  metadata: z.infer<typeof importMetadataSchema>,
  dataset: z.infer<typeof datasetSchema> | undefined,
) {
  const normalized = normalizeResource(candidate.input);
  const firstPhone = candidate.phoneNormalized?.split("|")[0]?.trim() ?? null;
  return {
    ...(metadata.id ? { id: metadata.id } : {}),
    name: normalized.name,
    acronym: candidate.input.acronym,
    description: normalized.description,
    category: candidate.input.category,
    sourceCategory: metadata.sourceCategory ?? null,
    subcategory: candidate.input.subcategory,
    phoneRaw: candidate.input.phoneRaw,
    phoneNormalized: candidate.phoneNormalized,
    phoneDisplay: metadata.phoneDisplay ?? formatPhoneDisplay(firstPhone),
    email: normalized.email,
    address: candidate.input.address,
    website: normalized.website,
    tags: candidate.input.tags,
    priority: candidate.input.priority,
    verified: candidate.input.verified,
    published: candidate.input.published,
    sourceNote: candidate.input.sourceNote,
    piipassAt: metadata.piipassAt ? new Date(metadata.piipassAt) : new Date(),
    piipassNotes: metadata.piipassNotes ?? (candidate.changes.length ? candidate.changes.join(" | ") : "no changes"),
    sourceDatasetHash: metadata.sourceDatasetHash ?? dataset?.sha256.toLowerCase() ?? null,
    sourceRow: metadata.sourceRow ?? null,
    ...(metadata.createdAt ? { createdAt: new Date(metadata.createdAt) } : {}),
    ...(metadata.updatedAt ? { updatedAt: new Date(metadata.updatedAt) } : {}),
  };
}
