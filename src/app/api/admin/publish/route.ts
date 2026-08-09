// BNDR. API — authenticated publish/unpublish command.
// Mutation + audit are committed in one transaction.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import {
  getAdminSession,
  requireAdminRateLimited,
  apiError,
} from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  publishCommandSchema,
  readBoundedJson,
  BODY_LIMITS,
  BoundedBodyError,
} from "@/lib/zod-schemas";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.resourceMutation);
  if (blocked) return blocked;

  try {
    let body: unknown;
    try {
      body = await readBoundedJson(req, BODY_LIMITS.resourceMutation);
    } catch (error) {
      if (error instanceof BoundedBodyError) {
        return apiError(error.code, error.message, 400);
      }
      throw error;
    }

    const parsed = publishCommandSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid publish command.",
        400,
      );
    }

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);
    const { id, published } = parsed.data;

    const result = await db.$transaction(async (tx) => {
      const existing = await tx.resource.findUnique({ where: { id } });
      if (!existing) return null;

      const updated = await tx.resource.update({
        where: { id },
        data: { published },
      });

      await tx.auditLog.create({
        data: {
          action: "publish-toggle",
          resourceId: id,
          actor,
          summary: `${published ? "Published" : "Unpublished"} resource: ${existing.name}`,
          details: JSON.stringify({
            before: { published: existing.published },
            after: { published: updated.published },
          }),
        },
      });

      return updated;
    });

    if (!result) return apiError("NOT_FOUND", "Resource not found.", 404);
    return NextResponse.json({ ok: true, id, published: result.published });
  } catch (error) {
    console.error("[api/admin/publish POST]", error);
    return apiError("INTERNAL", "Failed to toggle publish status.", 500);
  }
}
