// BNDR. — same-origin mutation guard (server-only)
// Browser-originated state changes must come from the configured public site.
// Server-to-server webhooks use their own cryptographic authentication and do
// not call this helper.

import { NextResponse } from "next/server";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireSameOriginMutation(req: Request): NextResponse | null {
  if (SAFE_METHODS.has(req.method.toUpperCase())) return null;

  const configured = process.env.NEXTAUTH_URL;
  if (!configured) {
    return NextResponse.json(
      { error: { code: "CONFIG_UNAVAILABLE", message: "Runtime origin is not configured." } },
      { status: 503 },
    );
  }

  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(configured).origin;
  } catch {
    return NextResponse.json(
      { error: { code: "CONFIG_INVALID", message: "Runtime origin is invalid." } },
      { status: 503 },
    );
  }

  const origin = req.headers.get("origin");
  if (!origin) {
    return NextResponse.json(
      { error: { code: "ORIGIN_REQUIRED", message: "Request origin is required." } },
      { status: 403 },
    );
  }

  let requestOrigin: string;
  try {
    requestOrigin = new URL(origin).origin;
  } catch {
    return NextResponse.json(
      { error: { code: "ORIGIN_INVALID", message: "Request origin is invalid." } },
      { status: 403 },
    );
  }

  if (requestOrigin !== expectedOrigin) {
    return NextResponse.json(
      { error: { code: "ORIGIN_FORBIDDEN", message: "Cross-origin mutation rejected." } },
      { status: 403 },
    );
  }

  return null;
}
