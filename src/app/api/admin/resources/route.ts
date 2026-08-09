// BNDR. API — authenticated admin resource collection
// GET returns every publication state. POST creates a resource.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchResources } from "@/lib/search";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  adminSearchParamsSchema,
  resourceInputSchema,
  readBoundedJson,
  BODY_LIMITS,
  BoundedBodyError,
} from "@/lib/zod-schemas";
import type { CategorySlug, SearchResult } from "@/lib/types";
import { toResourceShape } from "../../resources/route";
import { createResourceRecord } from "@/lib/resource-service";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.adminRead);
  if (blocked) return blocked;

  try {
    const sp = req.nextUrl.searchParams;
    const parsed = adminSearchParamsSchema.safeParse({
      q: sp.get("q") ?? "",
      category: sp.get("category") ?? "all",
      priorityOnly:
        sp.get("priorityOnly") === "1" || sp.get("priorityOnly") === "true",
      limit: sp.get("limit") ?? undefined,
      offset: sp.get("offset") ?? undefined,
    });
    if (!parsed.success) {
      return apiError("INVALID_PARAMS", "Invalid query parameters.", 400);
    }

    const { q, category, priorityOnly, limit, offset } = parsed.data;
    const publishedParam = sp.get("published");
    const where: {
      category?: string;
      priority?: { gte: number };
      published?: boolean;
    } = {};

    if (category && category !== "all") {
      where.category = category as CategorySlug;
    }
    if (priorityOnly) where.priority = { gte: 1 };
    if (publishedParam === "true") where.published = true;
    if (publishedParam === "false") where.published = false;

    const rows = await db.resource.findMany({ where });
    const resources = rows.map(toResourceShape);
    const scored = searchResources(resources, q, { limit, offset });
    const total = q.trim()
      ? searchResources(resources, q).length
      : resources.length;

    const result: SearchResult = {
      resources: scored as SearchResult["resources"],
      total,
      query: q,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/admin/resources GET]", error);
    return apiError("INTERNAL", "Failed to fetch admin resources.", 500);
  }
}

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

    const parsed = resourceInputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.issues[0]?.message ?? "Invalid resource input.",
        400,
      );
    }

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);
    const created = await createResourceRecord(parsed.data, actor);
    return NextResponse.json(toResourceShape(created), { status: 201 });
  } catch (error) {
    console.error("[api/admin/resources POST]", error);
    return apiError("INTERNAL", "Failed to create resource.", 500);
  }
}
