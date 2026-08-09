import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession, requireAdminRateLimited } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  BODY_LIMITS,
  BoundedBodyError,
  qrAdminReviewSchema,
  readBoundedJson,
} from "@/lib/zod-schemas";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Context) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.resourceMutation);
  if (blocked) return blocked;

  try {
    const { id } = await params;
    if (!id || id.length > 100) {
      return NextResponse.json({ error: "Invalid request id." }, { status: 400 });
    }

    const body = await readBoundedJson<unknown>(req, BODY_LIMITS.qrAdminReview);
    const parsed = qrAdminReviewSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid review update." }, { status: 400 });
    }

    const existing = await db.qrResetRequest.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Reset request not found." }, { status: 404 });
    }

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const value = parsed.data;

    const result = await db.$transaction(async (tx) => {
      const updated = await tx.qrResetRequest.update({
        where: { id },
        data: { status: value.status },
        select: { id: true, status: true, updatedAt: true },
      });

      const review = await tx.qrRequestReview.create({
        data: {
          requestId: id,
          stage: value.stage,
          decision: value.decision,
          reasonCode: value.reasonCode || null,
          notes: value.notes || null,
          actor,
        },
        select: { id: true, stage: true, decision: true, createdAt: true },
      });

      await tx.auditLog.create({
        data: {
          action: "qr-request-review",
          actor,
          summary: `QR Reset request review: ${value.status}`,
          details: JSON.stringify({ requestId: id, reviewId: review.id, stage: review.stage }),
        },
      });

      return { updated, review };
    });

    return NextResponse.json({ ok: true, request: result.updated, review: result.review });
  } catch (error) {
    if (error instanceof BoundedBodyError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.code === "PAYLOAD_TOO_LARGE" ? 413 : 400 },
      );
    }
    console.error("[admin-qr-request] update failed", error);
    return NextResponse.json({ error: "Could not update the Reset request." }, { status: 503 });
  }
}
