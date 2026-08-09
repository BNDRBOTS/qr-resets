// BNDR. API — public single resource
// GET /api/resources/:id returns published resources only.

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiError } from "@/lib/require-admin";
import { toResourceShape } from "../route";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const row = await db.resource.findUnique({ where: { id } });
    if (!row?.published) {
      return apiError("NOT_FOUND", "Resource not found.", 404);
    }
    return NextResponse.json(toResourceShape(row));
  } catch (error) {
    console.error("[api/resources/:id GET]", error);
    return apiError("INTERNAL", "Failed to fetch resource.", 500);
  }
}
