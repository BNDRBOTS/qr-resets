import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAdminRateLimited } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import { qrRequestStatusSchema } from "@/lib/zod-schemas";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.adminRead);
  if (blocked) return blocked;

  const url = new URL(req.url);
  const rawStatus = url.searchParams.get("status")?.trim();
  const status = rawStatus ? qrRequestStatusSchema.safeParse(rawStatus) : null;
  if (status && !status.success) {
    return NextResponse.json({ error: "Invalid request status." }, { status: 400 });
  }

  const requests = await db.qrResetRequest.findMany({
    where: status?.success ? { status: status.data } : undefined,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      reviews: {
        orderBy: { createdAt: "desc" },
        take: 5,
        select: {
          id: true,
          stage: true,
          decision: true,
          reasonCode: true,
          notes: true,
          actor: true,
          createdAt: true,
        },
      },
    },
  });
  return NextResponse.json({ requests });
}
