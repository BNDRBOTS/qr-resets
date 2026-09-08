// BNDR. API — authenticated admin resource collection
// GET returns every publication state. POST creates a resource.

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
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
import { ResourceIngestionError } from "@/lib/resource-ingestion";
import { paginateResources } from "@/lib/resource-pagination";
import { verifyExistingResources } from "@/lib/verification-pipeline";

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
    const where: Prisma.ResourceWhereInput = {};

    if (category && category !== "all") {
      where.category = category as CategorySlug;
    }
    if (priorityOnly) where.priority = { gte: 1 };
    if (publishedParam === "true") where.published = true;
    if (publishedParam === "false") where.published = false;

    const page = await paginateResources(
      {
        count: () => db.resource.count({ where }),
        fetchPage: async ({ skip, take }) => {
          const rows = await db.resource.findMany({
            where,
            orderBy: [{ name: "asc" }, { id: "asc" }],
            skip,
            take,
          });
          return rows.map(toResourceShape);
        },
      },
      { q, limit, offset },
    );

    const result: SearchResult = {
      resources: page.resources as SearchResult["resources"],
      total: page.total,
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
    // Automatically queue verifier-v4 verification for the new resource; the
    // durable background worker picks it up. Staging failures never block the
    // create itself (the record simply stays unverified until re-queued).
    try {
      await verifyExistingResources({
        actor,
        resourceIds: [created.id],
        origin: "resource-created",
      });
    } catch (stageError) {
      console.error("[api/admin/resources POST] failed to stage verification", stageError);
    }
    return NextResponse.json(toResourceShape(created), { status: 201 });
  } catch (error) {
    if (error instanceof ResourceIngestionError) {
      return apiError(error.code, error.message, error.code === "DUPLICATE_RESOURCE" ? 409 : 400);
    }
    console.error("[api/admin/resources POST]", error);
    return apiError("INTERNAL", "Failed to create resource.", 500);
  }
}
