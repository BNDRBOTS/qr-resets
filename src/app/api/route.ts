// BNDR. API — root discovery route
// ----------------------------------------------------------------------------
// The public API surface starts at /api/health, /api/resources, /api/stats,
// /api/categories, /api/tags, /api/suggest, /api/hotlines, /api/pending.
// Admin surfaces live under /api/admin/* and require authorization.

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      name: "BNDR. Resource Directory API",
      version: "1.1.4",
      endpoints: [
        "/api/health",
        "/api/resources",
        "/api/stats",
        "/api/categories",
        "/api/tags",
        "/api/suggest",
        "/api/hotlines",
        "/api/pending",
      ],
    },
    { status: 200 },
  );
}
