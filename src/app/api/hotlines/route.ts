// BNDR. API — published 24/7 hotline resources
// -----------------------------------------------------------------------------
// GET /api/hotlines returns only hotline/crisis records stored in the Resource
// table and explicitly marked published. No hotline record is embedded in code.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { formatPhoneDisplay } from "@/lib/pii";

export const dynamic = "force-dynamic";

interface HotlineEntry {
  id: string;
  name: string;
  acronym: string | null;
  description: string | null;
  phoneRaw: string | null;
  phoneDisplay: string | null;
  phoneTel: string | null;
  website: string | null;
  category: string;
  source: "db";
}

export async function GET() {
  try {
    const candidateRows = await db.resource.findMany({
      where: {
        published: true,
        verified: true,
        OR: [
          { phoneNormalized: { not: null } },
          { phoneRaw: { not: null } },
        ],
      },
      orderBy: [{ priority: "desc" }, { name: "asc" }],
      take: 200,
    });

    // Provider-neutral filtering: Prisma's `mode: "insensitive"` is not
    // available on the SQLite connector. The canonical dataset is small, so
    // case-folding these published candidates in application code keeps the
    // behavior identical across Railway SQLite and optional PostgreSQL.
    const rows = candidateRows.filter((row) => {
      const haystack = `${row.tags ?? ""} ${row.subcategory ?? ""}`.toLowerCase();
      return haystack.includes("hotline") || haystack.includes("24/7") || haystack.includes("crisis");
    }).slice(0, 50);

    const hotlines: HotlineEntry[] = rows.map((row) => {
      const firstPhone = row.phoneNormalized
        ? row.phoneNormalized.split("|")[0].trim()
        : null;
      return {
        id: row.id,
        name: row.name,
        acronym: row.acronym,
        description: row.description,
        phoneRaw: row.phoneRaw,
        phoneDisplay: formatPhoneDisplay(firstPhone) ?? row.phoneRaw,
        phoneTel: firstPhone,
        website: row.website,
        category: row.category,
        source: "db" as const,
      };
    });

    return NextResponse.json({ hotlines, total: hotlines.length });
  } catch (error) {
    console.error("[api/hotlines GET]", error);
    return NextResponse.json(
      { error: "Failed to load hotline resources.", hotlines: [], total: 0 },
      { status: 500 },
    );
  }
}
