// BNDR. API - stage a re-verification pass over existing canonical resources.
// Report-only: results land in the review queue; nothing mutates canonical
// rows automatically (no silent overwrite of canonical facts). The staged run
// is a persisted queue row processed by the durable verification worker.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { readBoundedJson, BODY_LIMITS, BoundedBodyError } from "@/lib/zod-schemas";
import { verifyExistingResources } from "@/lib/verification-pipeline";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  resourceIds: z.array(z.string().trim().min(1).max(200)).max(1000).optional(),
}).strict();

export async function POST(req: NextRequest) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.resourceMutation);
  if (blocked) return blocked;

  try {
    let body: unknown = {};
    try {
      body = await readBoundedJson(req, BODY_LIMITS.resourceMutation);
    } catch (error) {
      if (error instanceof BoundedBodyError) {
        return apiError(error.code, error.message, 400);
      }
      throw error;
    }
    const parsed = bodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid payload.", 400);
    }

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);

    const staged = await verifyExistingResources({
      actor,
      resourceIds: parsed.data.resourceIds ?? [],
      origin: "admin-reverify",
    });
    return NextResponse.json(
      { ok: true, runId: staged.id, runStatus: staged.status },
      { status: 202 },
    );
  } catch (error) {
    console.error("[api/admin/verification/verify POST]", error);
    return apiError("INTERNAL", "Failed to stage re-verification.", 500);
  }
}
