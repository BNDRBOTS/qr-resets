// BNDR. API — public resource collection
// GET /api/resources?q=&category=&priorityOnly=&limit=&offset=
// Public responses contain published resources only. All mutations live under
// /api/admin/resources and require a verified admin session.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { searchResources } from "@/lib/search";
import { cleanArtifacts } from "@/lib/pii";
import { apiError } from "@/lib/require-admin";
import { searchParamsSchema } from "@/lib/zod-schemas";
import type { CategorySlug, SearchResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export interface ResourceRow {
  id: string;
  name: string;
  acronym: string | null;
  description: string | null;
  category: CategorySlug;
  subcategory: string | null;
  phoneRaw: string | null;
  phoneNormalized: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  tags: string;
  priority: number;
  verified: boolean;
  published: boolean;
  sourceNote: string | null;
  piipassAt: string | null;
  piipassNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toResourceShape(row: {
  id: string;
  name: string;
  acronym: string | null;
  description: string | null;
  category: string;
  subcategory: string | null;
  phoneRaw: string | null;
  phoneNormalized: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  tags: string;
  priority: number;
  verified: boolean;
  published: boolean;
  sourceNote: string | null;
  piipassAt: Date | null;
  piipassNotes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ResourceRow {
  const cleanName = cleanArtifacts(row.name) ?? row.name;
  return {
    id: row.id,
    name: cleanName || "Unnamed resource",
    acronym: row.acronym,
    description: cleanArtifacts(row.description),
    category: row.category as CategorySlug,
    subcategory: row.subcategory,
    phoneRaw: row.phoneRaw,
    phoneNormalized: row.phoneNormalized,
    email: row.email,
    address: row.address,
    website: row.website,
    tags: row.tags,
    priority: row.priority,
    verified: row.verified,
    published: row.published,
    sourceNote: row.sourceNote,
    piipassAt: row.piipassAt?.toISOString() ?? null,
    piipassNotes: row.piipassNotes,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const parsed = searchParamsSchema.safeParse({
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
    const where: {
      category?: string;
      priority?: { gte: number };
      published: boolean;
    } = { published: true };

    if (category && category !== "all") where.category = category;
    if (priorityOnly) where.priority = { gte: 1 };

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
    console.error("[api/resources GET]", error);
    return apiError("INTERNAL", "Failed to fetch resources.", 500);
  }
}
