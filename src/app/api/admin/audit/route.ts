// BNDR. API — Audit log
// ----------------------------------------------------------------------------
// GET /api/admin/audit?limit=&offset= → { entries: AuditLogEntry[], total: number }

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import type { AuditLogEntry } from "@/lib/types";
import { requireAdminRateLimited } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.adminRead);
  if (blocked) return blocked;

  try {
    const sp = req.nextUrl.searchParams;
    const limit = Math.max(
      1,
      Math.min(200, parseInt(sp.get("limit") ?? "50", 10) || 50),
    );
    const offset = Math.max(0, parseInt(sp.get("offset") ?? "0", 10) || 0);

    const [rows, total] = await Promise.all([
      db.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.auditLog.count(),
    ]);

    const entries: AuditLogEntry[] = rows.map((r) => ({
      id: r.id,
      action: r.action,
      resourceId: r.resourceId,
      actor: r.actor,
      summary: r.summary,
      details: r.details,
      createdAt: r.createdAt.toISOString(),
    }));

    return NextResponse.json({ entries, total });
  } catch (err) {
    console.error("[api/admin/audit GET]", err);
    return NextResponse.json(
      { error: "Failed to fetch audit log" },
      { status: 500 },
    );
  }
}
