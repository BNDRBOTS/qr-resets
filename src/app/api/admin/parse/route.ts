// BNDR. API — deterministic Smart Paste parser.
// Extracts only values present in the submitted text. It does not call an LLM,
// invent contact details, or assign a category without a direct keyword match.

import { NextRequest, NextResponse } from "next/server";
import { normalizeUrl } from "@/lib/pii";
import type { CategorySlug, ResourceInput } from "@/lib/types";
import { requireAdminRateLimited, apiError } from "@/lib/require-admin";
import { RATE_LIMITS } from "@/lib/rate-limit";
import {
  readBoundedJson,
  BODY_LIMITS,
  BoundedBodyError,
} from "@/lib/zod-schemas";

export const dynamic = "force-dynamic";

const EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>]+/i;
const PHONE_RE = /(?:\+?1[\s./-]*)?(?:\(?\d{3}\)?[\s./-]*)\d{3}[\s./-]*\d{4}(?:\s*(?:x|ext\.?|extension)\s*\d+)?|\b1[\s-]*800[\s-]*[A-Z0-9-]{7,}\b/i;

const CATEGORY_RULES: Array<{ slug: CategorySlug; words: RegExp }> = [
  { slug: "child-abduction", words: /child abduction|missing child|custodial interference|kidnapp/i },
  { slug: "victim-rights-compensation", words: /victim rights|victim compensation|crime victim/i },
  { slug: "domestic-violence-family-violence", words: /domestic violence|family violence|child abuse|shelter/i },
  { slug: "family-advocacy-trauma-recovery", words: /trauma recovery|family advocacy|advocacy center/i },
  { slug: "protective-parent-family-court", words: /protective parent|family court abuse/i },
  { slug: "gaslighting-darvo-institutional-betrayal", words: /darvo|gaslighting|institutional betrayal|coercive control/i },
  { slug: "parental-alienation-fathers-rights", words: /parental alienation|father'?s rights|equal parenting/i },
  { slug: "legal-aid-court-access", words: /legal aid|court access|pro bono/i },
  { slug: "attorneys-firms", words: /law firm|attorney|lawyer/i },
  { slug: "disability-medical-advocacy", words: /disability rights|patient advocacy|medical gaslighting/i },
  { slug: "lyme-co-infections", words: /lyme|babesia|co-infection/i },
  { slug: "housing-financial-aid", words: /housing|rental assistance|financial aid|grant|food assistance/i },
];

function trimPunctuation(value: string): string {
  return value.replace(/[),.;]+$/g, "").trim();
}

function inferCategory(text: string): CategorySlug | undefined {
  return CATEGORY_RULES.find((rule) => rule.words.test(text))?.slug;
}

function parseSourceText(text: string): Partial<ResourceInput> {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const email = text.match(EMAIL_RE)?.[0] ?? null;
  const rawUrl = text.match(URL_RE)?.[0] ?? null;
  const website = rawUrl ? normalizeUrl(trimPunctuation(rawUrl)) : null;
  const phoneRaw = text.match(PHONE_RE)?.[0]?.trim() ?? null;

  const contactLines = new Set(
    lines.filter(
      (line) =>
        Boolean(email && line.includes(email)) ||
        Boolean(rawUrl && line.includes(rawUrl)) ||
        Boolean(phoneRaw && line.includes(phoneRaw)),
    ),
  );

  const contentLines = lines.filter((line) => !contactLines.has(line));
  const name = contentLines[0] ?? lines[0] ?? "";
  const descriptionLines = contentLines.slice(1);
  const category = inferCategory(text);

  return {
    ...(name ? { name } : {}),
    ...(descriptionLines.length
      ? { description: descriptionLines.join("\n") }
      : {}),
    ...(category ? { category } : {}),
    ...(phoneRaw ? { phoneRaw } : {}),
    ...(email ? { email } : {}),
    ...(website ? { website } : {}),
  };
}

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

    const text =
      body && typeof body === "object" && "text" in body
        ? String((body as { text?: unknown }).text ?? "").trim()
        : "";
    if (!text) return apiError("TEXT_REQUIRED", "Field 'text' is required.", 400);

    const parsed = parseSourceText(text);
    if (!parsed.name) {
      return apiError(
        "NAME_NOT_FOUND",
        "No resource name could be extracted. Enter the name manually.",
        422,
      );
    }

    return NextResponse.json({ parsed });
  } catch (error) {
    console.error("[api/admin/parse POST]", error);
    return apiError("INTERNAL", "Failed to parse the pasted text.", 500);
  }
}
