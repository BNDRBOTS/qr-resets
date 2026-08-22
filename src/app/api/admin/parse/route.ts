// BNDR. API — deterministic Smart Paste parser.
// TXT, Markdown, JSON, and XML use the shared resource ingestion pipeline.
// No AI service is called and regexes are candidate extractors only.

import { NextRequest, NextResponse } from "next/server";
import { requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  parseSmartPaste,
  ResourceIngestionError,
  type ResourceInputFormat,
} from "@/lib/resource-ingestion";
import {
  readBoundedJson,
  BODY_LIMITS,
  BoundedBodyError,
} from "@/lib/zod-schemas";

export const dynamic = "force-dynamic";

const FORMATS = new Set<ResourceInputFormat>(["txt", "markdown", "json", "xml"]);

export async function POST(req: NextRequest) {
  const blocked = await requireAdminRateLimited(req, RATE_LIMITS.smartPaste);
  if (blocked) return blocked;

  try {
    let body: unknown;
    try {
      body = await readBoundedJson(req, BODY_LIMITS.smartPaste);
    } catch (error) {
      if (error instanceof BoundedBodyError) {
        return apiError(error.code, error.message, 400);
      }
      throw error;
    }

    const record = body && typeof body === "object" ? body as Record<string, unknown> : {};
    const text = String(record.text ?? "").trim();
    if (!text) return apiError("TEXT_REQUIRED", "Field 'text' is required.", 400);

    const requested = typeof record.format === "string" ? record.format : undefined;
    if (requested && !FORMATS.has(requested as ResourceInputFormat)) {
      return apiError("UNSUPPORTED_FORMAT", "Format must be txt, markdown, json, or xml.", 400);
    }

    return NextResponse.json(parseSmartPaste(text, requested as ResourceInputFormat | undefined));
  } catch (error) {
    if (error instanceof ResourceIngestionError) {
      const status = error.code === "NAME_NOT_FOUND" || error.code === "NO_RESOURCE_CANDIDATES" ? 422 : 400;
      return apiError(error.code, error.message, status);
    }
    console.error("[api/admin/parse POST]", error);
    return apiError("INTERNAL", "Failed to parse the pasted text.", 500);
  }
}
