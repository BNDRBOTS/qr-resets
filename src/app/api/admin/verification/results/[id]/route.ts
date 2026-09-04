// BNDR. API - single verification result: detail view, review actions, and
// source-value edits. Published results are immutable (audit trail preserved).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { readBoundedJson, BODY_LIMITS, BoundedBodyError } from "@/lib/zod-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  publishState: z.enum(["held", "excluded"]).optional(),
  reviewState: z.enum(["unreviewed", "reviewed"]).optional(),
  sourceJson: z.record(z.string(), z.unknown()).optional(),
}).strict().refine(
  (value) =>
    value.publishState !== undefined ||
    value.reviewState !== undefined ||
    value.sourceJson !== undefined,
  { message: "Provide at least one field to update." },
);

export async function GET(req: NextRequest, context: RouteContext) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.adminRead);
  if (blocked) return blocked;

  try {
    const { id } = await context.params;
    const result = await db.verificationResult.findUnique({
      where: { id },
      include: {
        issues: true,
        run: { select: { id: true, origin: true, status: true, createdAt: true } },
      },
    });
    if (!result) return apiError("NOT_FOUND", "Verification result not found.", 404);
    return NextResponse.json({ ok: true, result });
  } catch (error) {
    console.error("[api/admin/verification/results/[id] GET]", error);
    return apiError("INTERNAL", "Failed to load verification result.", 500);
  }
}

export async function PATCH(req: NextRequest, context: RouteContext) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.resourceMutation);
  if (blocked) return blocked;

  try {
    const { id } = await context.params;
    let body: unknown;
    try {
      body = await readBoundedJson(req, BODY_LIMITS.resourceMutation);
    } catch (error) {
      if (error instanceof BoundedBodyError) {
        return apiError(error.code, error.message, 400);
      }
      throw error;
    }
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
      return apiError("VALIDATION_ERROR", parsed.error.issues[0]?.message ?? "Invalid payload.", 400);
    }

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);

    const existing = await db.verificationResult.findUnique({ where: { id } });
    if (!existing) return apiError("NOT_FOUND", "Verification result not found.", 404);
    if (existing.publishState === "published") {
      return apiError(
        "IMMUTABLE_PUBLISHED",
        "Published results are immutable; run a new verification to change them.",
        409,
      );
    }

    const updated = await db.$transaction(async (tx) => {
      const row = await tx.verificationResult.update({
        where: { id },
        data: {
          ...(parsed.data.publishState ? { publishState: parsed.data.publishState } : {}),
          ...(parsed.data.reviewState
            ? parsed.data.reviewState === "reviewed"
              ? { reviewState: "reviewed", resolvedAt: new Date(), resolvedBy: actor }
              : { reviewState: "unreviewed", resolvedAt: null, resolvedBy: null }
            : {}),
          ...(parsed.data.sourceJson ? { sourceJson: parsed.data.sourceJson as object } : {}),
        },
      });
      await tx.auditLog.create({
        data: {
          action: "verification-review",
          actor,
          summary: `Updated verification review for '${row.name}'`,
          details: JSON.stringify({ resultId: id, changes: parsed.data }),
        },
      });
      return row;
    });

    return NextResponse.json({
      ok: true,
      id: updated.id,
      publishState: updated.publishState,
      reviewState: updated.reviewState,
    });
  } catch (error) {
    console.error("[api/admin/verification/results/[id] PATCH]", error);
    return apiError("INTERNAL", "Failed to update verification result.", 500);
  }
}
