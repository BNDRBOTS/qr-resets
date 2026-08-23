// BNDR. API — authenticated admin single-resource operations.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  resourceUpdateSchema,
  readBoundedJson,
  BODY_LIMITS,
  BoundedBodyError,
} from "@/lib/zod-schemas";
import {
  deleteResourceRecord,
  ResourceNotFoundError,
  updateResourceRecord,
} from "@/lib/resource-service";
import { toResourceShape } from "../../../resources/route";
import { ResourceIngestionError } from "@/lib/resource-ingestion";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: RouteContext) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.adminRead);
  if (blocked) return blocked;

  try {
    const { id } = await params;
    const row = await db.resource.findUnique({ where: { id } });
    if (!row) return apiError("NOT_FOUND", "Resource not found.", 404);
    return NextResponse.json(toResourceShape(row));
  } catch (error) {
    console.error("[api/admin/resources/:id GET]", error);
    return apiError("INTERNAL", "Failed to fetch resource.", 500);
  }
}

export async function PUT(req: NextRequest, { params }: RouteContext) {
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

    const parsed = resourceUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid update input.",
        400,
      );
    }

    const { id } = await params;
    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);
    const updated = await updateResourceRecord(id, parsed.data, actor);
    return NextResponse.json(toResourceShape(updated));
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return apiError("NOT_FOUND", "Resource not found.", 404);
    }
    if (error instanceof ResourceIngestionError) {
      return apiError(error.code, error.message, error.code === "DUPLICATE_RESOURCE" ? 409 : 400);
    }
    console.error("[api/admin/resources/:id PUT]", error);
    return apiError("INTERNAL", "Failed to update resource.", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.resourceMutation);
  if (blocked) return blocked;

  try {
    const { id } = await params;
    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);
    await deleteResourceRecord(id, actor);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    if (error instanceof ResourceNotFoundError) {
      return apiError("NOT_FOUND", "Resource not found.", 404);
    }
    console.error("[api/admin/resources/:id DELETE]", error);
    return apiError("INTERNAL", "Failed to delete resource.", 500);
  }
}
