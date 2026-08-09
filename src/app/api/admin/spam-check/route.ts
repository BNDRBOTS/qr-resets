// BNDR. API — Spam/Non-Resource Content Check
// ----------------------------------------------------------------------------
// POST /api/admin/spam-check  → runs spam detection on ALL resources
// Returns resources flagged as containing spam/non-resource content.
// Uses the checkSpam() function from the PII pipeline.

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkSpam } from "@/lib/pii";
import { getAdminSession, requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.spamCheck);
  if (blocked) return blocked;

  try {
    const resources = await db.resource.findMany({
      select: { id: true, name: true, description: true, tags: true },
    });

    const flagged: { id: string; name: string; patterns: string[] }[] = [];
    for (const r of resources) {
      const result = checkSpam(r.name, r.description, r.tags ?? "");
      if (result.isSpam) {
        flagged.push({
          id: r.id,
          name: r.name,
          patterns: result.patterns,
        });
      }
    }

    const session = await getAdminSession();
    const actor = session?.user?.email;
    if (!actor) return apiError("UNAUTHORIZED", "Authentication required.", 401);

    // Write audit log
    await db.auditLog.create({
      data: {
        action: "spam-check",
        actor,
        summary: `Spam check: ${flagged.length} resources flagged out of ${resources.length} total`,
        details: JSON.stringify(flagged.slice(0, 50)),
      },
    });

    return NextResponse.json({
      total: resources.length,
      flagged: flagged.length,
      entries: flagged,
    });
  } catch (err) {
    console.error("[api/admin/spam-check POST]", err);
    return NextResponse.json(
      { error: "Failed to run spam check", total: 0, flagged: 0, entries: [] },
      { status: 500 },
    );
  }
}
