import { NextResponse } from "next/server";
import { requireAdminRateLimited } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, _context: Context) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.resourceMutation);
  if (blocked) return blocked;
  return NextResponse.json(
    { error: "QR Resets request review is disabled while QR Resets is in prototype mode.", demoOnly: true },
    { status: 503 },
  );
}
