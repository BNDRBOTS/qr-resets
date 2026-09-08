// BNDR. API - review one verification issue (accept, dismiss, or reopen).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { readBoundedJson, BODY_LIMITS, BoundedBodyError } from "@/lib/zod-schemas";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  reviewState: z.enum(["unresolved", "accepted", "dismissed"]),
}).strict();

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

    const existing = await db.verificationIssue.findUnique({ where: { id } });
    if (!existing) return apiError("NOT_FOUND", "Verification issue not found.", 404);

    const reviewState = parsed.data.reviewState;
    const updated = await db.$transaction(async (tx) => {
      const row = await tx.verificationIssue.update({
        where: { id },
        data: {
          reviewState,
          ...(reviewState === "unresolved"
            ? { resolvedAt: null, resolvedBy: null }
            : { resolvedAt: new Date(), resolvedBy: actor }),
        },
      });
      await tx.auditLog.create({
        data: {
          action: "verification-issue-review",
          actor,
          summary: `Marked issue ${row.code} as ${reviewState}`,
          details: JSON.stringify({ issueId: id, resultId: row.resultId, reviewState }),
        },
      });
      return row;
    });

    return NextResponse.json({ ok: true, id: updated.id, reviewState: updated.reviewState });
  } catch (error) {
    console.error("[api/admin/verification/issues/[id] PATCH]", error);
    return apiError("INTERNAL", "Failed to update verification issue.", 500);
  }
}
