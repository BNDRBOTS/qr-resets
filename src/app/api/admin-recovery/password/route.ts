// BNDR. API — complete a verified single-admin password recovery

import { NextRequest, NextResponse } from "next/server";
import { requireSameOriginMutation } from "@/lib/request-origin";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import { resetAdminPasswordWithRecoveryGrant } from "@/lib/admin-credentials";
import { parseAdminRecoveryTicket } from "@/lib/admin-recovery-ticket";
import {
  adminPasswordResetSchema,
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
    rateLimit = await checkRateLimit(
      getClientId(req),
      RATE_LIMITS.adminRecoveryReset,
    );
  } catch {
    console.error("[admin-recovery] reset rate limit unavailable");
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

  const parsed = adminPasswordResetSchema.safeParse(body);
  if (!parsed.success) {
    const passwordIssue = parsed.error.issues.find(
      (issue) => issue.path[0] === "newPassword",
    );
    return jsonError(
      passwordIssue ? "WEAK_PASSWORD" : "INVALID_REQUEST",
      passwordIssue
        ? "Password must be between 12 and 256 characters."
        : "Invalid recovery request.",
      400,
    );
  }

  let ticket;
  try {
    ticket = parseAdminRecoveryTicket(parsed.data.resetToken);
  } catch {
    return jsonError(
      "RECOVERY_UNAVAILABLE",
      "Account recovery is temporarily unavailable.",
      503,
    );
  }

  if (ticket.kind === "expired") {
    return jsonError(
      "RECOVERY_EXPIRED",
      "Recovery session expired. Start again.",
      401,
    );
  }
  if (ticket.kind !== "success") {
    return jsonError(
      "RECOVERY_DENIED",
      "Recovery credentials were not accepted.",
      401,
    );
  }

  try {
    const result = await resetAdminPasswordWithRecoveryGrant(
      ticket.grant,
      parsed.data.newPassword,
    );

    if (result.kind === "invalid-recovery") {
      // Credential version changed after proof was issued. Treat the grant as
      // expired rather than revealing credential-state details.
      return jsonError(
        "RECOVERY_EXPIRED",
        "Recovery session expired. Start again.",
        401,
      );
    }
    if (result.kind === "recovery-unavailable") {
      return jsonError(
        "RECOVERY_UNAVAILABLE",
        "Account recovery is unavailable.",
        503,
      );
    }

    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    console.error("[admin-recovery] credential update unavailable");
    return jsonError(
      "RECOVERY_UNAVAILABLE",
      "Account recovery is temporarily unavailable.",
      503,
    );
  }
}
