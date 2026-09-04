// BNDR. API — reveal the single administrator email only after recovery proof

import { NextRequest, NextResponse } from "next/server";
import { requireSameOriginMutation } from "@/lib/request-origin";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import { verifyAdminRecoveryCredential } from "@/lib/admin-credentials";
import {
  adminRecoveryProofSchema,
  BODY_LIMITS,
  BoundedBodyError,
  readBoundedJson,
} from "@/lib/zod-schemas";

export const dynamic = "force-dynamic";

function jsonError(code: string, message: string, status: number) {
  return NextResponse.json(
    { error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const originBlocked = requireSameOriginMutation(req);
  if (originBlocked) return originBlocked;

  let rateLimit;
  try {
    // Intentionally shares the recovery-proof namespace with password recovery
    // so alternating recovery routes cannot bypass the proof-attempt limit.
    rateLimit = await checkRateLimit(
      getClientId(req),
      RATE_LIMITS.adminRecoveryProof,
    );
  } catch {
    console.error("[admin-recovery] email proof rate limit unavailable");
    return jsonError(
      "RECOVERY_UNAVAILABLE",
      "Account recovery is temporarily unavailable.",
      503,
    );
  }

  if (!rateLimit.allowed) {
    const retryAfter = Math.max(
      1,
      Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
    );
    return NextResponse.json(
      {
        error: {
          code: "RATE_LIMITED",
          message: "Too many recovery attempts. Please try again later.",
        },
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(retryAfter),
        },
      },
    );
  }

  let body: unknown;
  try {
    body = await readBoundedJson(req, BODY_LIMITS.adminRecovery);
  } catch (error) {
    if (error instanceof BoundedBodyError) {
      return jsonError(error.code, error.message, 400);
    }
    return jsonError("INVALID_REQUEST", "Invalid recovery request.", 400);
  }

  const parsed = adminRecoveryProofSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("INVALID_REQUEST", "Invalid recovery request.", 400);
  }

  try {
    const recovery = await verifyAdminRecoveryCredential(
      parsed.data.recoveryKey,
    );
    if (recovery.kind === "invalid-recovery") {
      return jsonError(
        "RECOVERY_DENIED",
        "Recovery credentials were not accepted.",
        401,
      );
    }
    if (recovery.kind === "recovery-unavailable") {
      return jsonError(
        "RECOVERY_UNAVAILABLE",
        "Account recovery is unavailable.",
        503,
      );
    }

    return NextResponse.json(
      { ok: true, email: recovery.admin.email },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("[admin-recovery] email verification unavailable");
    return jsonError(
      "RECOVERY_UNAVAILABLE",
      "Account recovery is temporarily unavailable.",
      503,
    );
  }
}
