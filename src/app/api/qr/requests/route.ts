import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import { requireSameOriginMutation } from "@/lib/request-origin";
import {
  BODY_LIMITS,
  BoundedBodyError,
  qrResetRequestSchema,
  readBoundedJson,
} from "@/lib/zod-schemas";

export const dynamic = "force-dynamic";

function nullable(value: string | undefined) {
  const trimmed = value?.trim() ?? "";
  return trimmed.length ? trimmed : null;
}

export async function POST(req: Request) {
  try {
    const originBlocked = requireSameOriginMutation(req);
    if (originBlocked) return originBlocked;
    const limit = await checkRateLimit(getClientId(req), RATE_LIMITS.qrRequest);
    if (!limit.allowed) {
      return NextResponse.json(
        { ok: false, error: "Too many requests. Please try again later." },
        { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000))) } },
      );
    }

    const body = await readBoundedJson<unknown>(req, BODY_LIMITS.qrRequest);
    const parsed = qrResetRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: "Please review the request fields and required consent." },
        { status: 400 },
      );
    }

    const v = parsed.data;
    const record = await db.qrResetRequest.create({
      data: {
        displayName: nullable(v.displayName),
        contactMethod: v.contactMethod ?? null,
        contactDetails: nullable(v.contactDetails),
        location: nullable(v.location),
        situation: nullable(v.situation),
        urgentProblem: nullable(v.urgentProblem),
        blockers: nullable(v.blockers),
        proposedHelp: nullable(v.proposedHelp),
        unwantedSupport: nullable(v.unwantedSupport),
        deadline: nullable(v.deadline),
        alreadyWorking: nullable(v.alreadyWorking),
        currentHelp: nullable(v.currentHelp),
        planPreference: v.planPreference ?? null,
        documentsNote: nullable(v.documentsNote),
        consentRequired: v.consentRequired,
        consentOptional: v.consentOptional,
      },
      select: { id: true, status: true },
    });

    return NextResponse.json({ ok: true, requestId: record.id, status: record.status }, { status: 201 });
  } catch (error) {
    if (error instanceof BoundedBodyError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.code === "PAYLOAD_TOO_LARGE" ? 413 : 400 });
    }
    console.error("[qr-request] submit failed", error);
    return NextResponse.json(
      { ok: false, error: "We could not save this request. Nothing was submitted. Please try again." },
      { status: 503 },
    );
  }
}
