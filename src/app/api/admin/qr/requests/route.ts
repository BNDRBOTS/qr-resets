import { NextResponse } from "next/server";
import { requireAdminRateLimited } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.adminRead);
  if (blocked) return blocked;
  return NextResponse.json({ requests: [], demoOnly: true });
}
