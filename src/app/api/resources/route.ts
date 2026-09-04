// BNDR. API - public resource collection
// GET /api/resources?q=&category=&priorityOnly=&limit=&offset=
// Public responses contain published resources only. All mutations live under
// /api/admin/resources and require a verified admin session.

import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { cleanArtifacts } from "@/lib/pii";
import { createSearchAccumulator } from "@/lib/search";
import { apiError } from "@/lib/require-admin";
import { searchParamsSchema } from "@/lib/zod-schemas";
import type { CategorySlug, SearchResult } from "@/lib/types";

export const dynamic = "force-dynamic";

// Fixed keyset-scan batch size for the weighted-search path. Weighted
// fuzzy/typo/acronym scoring must see every candidate row (it is not
// expressible as SQL contains-filters), so candidates stream through in
// bounded batches instead of one unbounded findMany().
const SEARCH_SCAN_BATCH_SIZE = 500;

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
    const where: Prisma.ResourceWhereInput = { published: true };
    if (category && category !== "all") where.category = category;
    if (priorityOnly) where.priority = { gte: 1 };

    // The weighted fuzzy/typo/acronym/priority engine in src/lib/search.ts is
    // the public search contract and is preserved verbatim:
    // - Browse (no query tokens): true database pagination with the same
    //   neutral alphabetical ordering searchResources applies to empty
    //   queries, plus a true database count. Pages and counts stay correct at
    //   any dataset size (well beyond 500 rows).
    // - Search: every candidate row is scored via the shared accumulator fed
    //   in fixed-size keyset batches (never one unbounded fetch); ranking,
    //   the true total, and the returned page use the exact searchResources
    //   comparator.
    const search = createSearchAccumulator(q);

    if (!search.hasQuery) {
      const [total, rows] = await Promise.all([
        db.resource.count({ where }),
        db.resource.findMany({
          where,
          orderBy: [{ name: "asc" }, { id: "asc" }],
          skip: offset,
          take: limit,
        }),
      ]);
      const result: SearchResult = {
        resources: rows.map(toResourceShape) as SearchResult["resources"],
        total,
        query: q,
      };
      return NextResponse.json(result);
    }

    let cursor: string | null = null;
    for (;;) {
      const batch = await db.resource.findMany({
        where,
        orderBy: { id: "asc" },
        take: SEARCH_SCAN_BATCH_SIZE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      });
      if (batch.length === 0) break;
      search.add(batch.map(toResourceShape));
      if (batch.length < SEARCH_SCAN_BATCH_SIZE) break;
      cursor = batch[batch.length - 1].id;
    }

    const ranked = search.finalize(offset, limit);
    const result: SearchResult = {
      resources: ranked.page as SearchResult["resources"],
      total: ranked.total,
      query: q,
    };
    return NextResponse.json(result);
  } catch (error) {
    console.error("[api/resources GET]", error);
    return apiError("INTERNAL", "Failed to fetch resources.", 500);
  }
}
