// BNDR. API - recovery/debug/interchange import of verifier v4 artifacts.
//
// This endpoint is NOT the primary verification workflow. The primary
// workflow is automatic: staged imports are queued as persisted verification
// runs and processed by the durable in-app worker, which invokes the bundled
// verifier v4 itself. This upload path exists only for recovery of work from
// an externally executed verifier run (verified_resources.json +
// run_manifest.json), for debugging, and for data interchange.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { readBoundedJson, BODY_LIMITS, BoundedBodyError } from "@/lib/zod-schemas";
import { persistExternalVerifierRun } from "@/lib/verification-pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  verifiedResources: z.array(z.record(z.string(), z.unknown())).min(1).max(5000),
  runManifest: z.record(z.string(), z.unknown()).nullable().optional(),
  filename: z.string().trim().max(300).optional(),
  environmentEgressRestricted: z.boolean().optional(),
}).strict();

export async function POST(req: NextRequest) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.bulkImport);
  if (blocked) return blocked;

  try {
    let body: unknown;
    try {
      body = await readBoundedJson(req, BODY_LIMITS.verificationImport);
    } catch (error) {
      if (error instanceof BoundedBodyError) {
        return apiError(error.code, error.message, 400);
      }
      throw error;
    }
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid verifier artifact payload.",
        400,
      );
    }

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);

    const outcome = await persistExternalVerifierRun({
      actor,
      records: parsed.data.verifiedResources,
      manifest: parsed.data.runManifest ?? null,
      reviewPairs: [],
      egressRestricted: parsed.data.environmentEgressRestricted ?? false,
      filename: parsed.data.filename ?? null,
    });

    return NextResponse.json(
      {
        ok: true,
        recovery: true,
        runId: outcome.runId,
        imported: outcome.imported,
        note:
          "Recovery import complete. This path is for recovery/debug/interchange only; " +
          "normal staging and imports are verified automatically by the in-app pipeline.",
      },
      { status: 202 },
    );
  } catch (error) {
    console.error("[api/admin/verification/import POST]", error);
    return apiError("INTERNAL", "Failed to import verifier artifacts.", 500);
  }
}
