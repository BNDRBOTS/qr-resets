// BNDR. PII Normalization & Input-Cleaning Pipeline
// ----------------------------------------------------------------------------
// Goals:
//  - Normalize phone numbers to a canonical digits-only form (US +1 default)
//    while preserving the original raw display string (provenance).
//  - Normalize emails (trim + lowercase + basic validation).
//  - Normalize URLs (ensure protocol, trim trailing slash).
//  - Trim/squash whitespace in name & description.
//  - Detect & REDACT high-risk PII patterns from free-text fields:
//      * SSN (###-##-####)
//      * Credit-card-like runs (13-19 digits)
//      * Date of birth in "DOB" context
//      * Full street addresses embedded in descriptions (best-effort)
//  - Return a structured report of every change (audit trail).
//
// This module is pure (no I/O) so it can run on the API layer and be unit-checked.

export interface NormalizeResult<T> {
  value: T;
  changes: string[];
}

// ---- Phone normalization ---------------------------------------------------

/**
 * Extract all digits from a phone-like string.
 * Handles mnemonic formats like 1-800-THE-LOST and 678-TFRMDAD.
 * Mnemonic letters map to their telephone keypad digits.
 */
const KEYPAD: Record<string, string> = {
  A: "2", B: "2", C: "2",
  D: "3", E: "3", F: "3",
  G: "4", H: "4", I: "4",
  J: "5", K: "5", L: "5",
  M: "6", N: "6", O: "6",
  P: "7", Q: "7", R: "7", S: "7",
  T: "8", U: "8", V: "8",
  W: "9", X: "9", Y: "9", Z: "9",
};

// Annotation words that may precede a phone number in a multi-phone string.
// These are stripped before parsing so their letters aren't converted to digits.
const PHONE_ANNOTATIONS = [
  "voice", "text", "fax", "tty", "phoenix", "tucson", "maricopa",
  "office", "main", "hotline", "crisis", "intake", "cell", "home", "work",
];

/**
 * Convert a mnemonic phone segment (e.g. "1-800-THE-LOST", "678-TFRMDAD")
 * into digits. Only converts letters — leaves digits/separators alone.
 */
function segmentToDigits(seg: string): string {
  let out = "";
  for (const ch of seg.toUpperCase()) {
    if (KEYPAD[ch]) out += KEYPAD[ch];
    else if (/[0-9]/.test(ch)) out += ch;
  }
  return out;
}

/**
 * Extract ALL valid phone numbers from a (possibly multi-phone) raw string.
 * Handles formats like:
 *   "1-800-THE-LOST / 1-800-843-5678"
 *   "voice 907-312-5552; text 678-TFRMDAD / 678-837-6323"
 *   "Phoenix 602-542-4911; Tucson 520-628-6456"
 * Returns an array of canonical digit strings (7 or 10 digits).
 */
export function extractAllPhones(raw: string | null | undefined): string[] {
  if (!raw) return [];
  let s = String(raw);
  // Remove annotation words (case-insensitive, word-boundary) so their
  // letters are not converted to digits.
  for (const word of PHONE_ANNOTATIONS) {
    s = s.replace(new RegExp(`\\b${word}\\b`, "gi"), " ");
  }
  // Split on delimiters that separate distinct phone numbers.
  const segments = s.split(/[;/,]|\/|\bor\b|\band\b/i).map((x) => x.trim()).filter(Boolean);

  const phones: string[] = [];
  for (const seg of segments) {
    if (!seg) continue;
    let digits = segmentToDigits(seg);
    if (!digits) continue;
    // Strip leading "1" country code if 11 digits.
    if (digits.length === 11 && digits.startsWith("1")) {
      digits = digits.slice(1);
    }
    // Accept only plausible US numbers (7 or 10 digits).
    if (digits.length === 10 || digits.length === 7) {
      // Dedup.
      if (!phones.includes(digits)) phones.push(digits);
    }
  }
  return phones;
}

/**
 * Primary normalized phone (first valid number) for click-to-call + search.
 * Returns null if no valid number could be parsed.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  const phones = extractAllPhones(raw);
  return phones.length > 0 ? phones[0] : null;
}

/**
 * Human-friendly display of a normalized 10/7-digit US phone.
 */
export function formatPhoneDisplay(normalized: string | null | undefined): string | null {
  if (!normalized) return null;
  const d = String(normalized);
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (d.length === 7) {
    return `${d.slice(0, 3)}-${d.slice(3)}`;
  }
  return d;
}

// ---- Email normalization ---------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase();
  if (!s) return null;
  // Collapse internal whitespace around the @
  const [local, domain] = s.split("@");
  if (!local || !domain) return null;
  const clean = `${local.trim()}@${domain.trim()}`;
  return EMAIL_RE.test(clean) ? clean : null;
}

// ---- URL normalization -----------------------------------------------------

export function normalizeUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw).trim();
  if (!s) return null;
  // Strip a mailto: prefix? No — keep email separate.
  if (s.startsWith("mailto:")) return null;
  if (!/^https?:\/\//i.test(s)) {
    s = `https://${s}`;
  }
  // Remove trailing slash for bare domains, keep path slashes.
  try {
    const u = new URL(s);
    let out = u.toString();
    if (out.endsWith("/") && u.pathname === "/" && u.search === "") {
      out = out.slice(0, -1);
    }
    return out;
  } catch {
    return null;
  }
}

// ---- Text sanitization -----------------------------------------------------

export function squashWhitespace(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = String(raw).replace(/\s+/g, " ").trim();
  return s || null;
}

// ---- Production-grade text normalization -----------------------------------
// Source data contains LLM-citation artifacts, stray markdown, ASCII-art
// separators, and encoding noise that leaked from the original data extraction.
// This pipeline strips ALL of it so descriptions read as clean prose.

// Citation artifacts: 【31†L20-L24】
const CITATION_ARTIFACT_RE = /【\d+†L\d+-L\d+】/g;
// Bracketed source-line refs: [L20-L24] or [L402]
const LINE_REF_RE = /\[L\d+-?L?\d*\]/g;
// ASCII-art separator lines: ============================ or ---- or ______
const SEPARATOR_LINE_RE = /^[=\-_=*~]{4,}$/gm;
// Stray markdown bold markers at start of text: "** 1-800-MEDICARE"
const LEADING_BOLD_RE = /^\*+\s*/g;
// Stray markdown bold markers after spaces: " **988** then"
const INLINE_BOLD_RE = /\s+\*\*([^*]+)\*\*/g;
// Remaining bare ** that aren't part of a valid bold pair
const BARE_ASTERISKS_RE = /\*\*/g;
// Single stray asterisks
const STRAY_ASTERISK_RE = /(?<!\*)\*(?!\*)/g;
// Markdown header hashes: ## Header
const HEADER_HASH_RE = /^#{1,6}\s+/gm;
// Markdown bullet artifacts: "- " at start when it's not a list
const BULLET_ARTIFACT_RE = /^[-•]\s+/gm;
// Multiple consecutive blank lines → single
const MULTI_BLANK_RE = /\n{3,}/g;
// Trailing/leading whitespace on each line
const LINE_TRIM_RE = /^[ \t]+|[ \t]+$/gm;

/**
 * PRODUCTION-GRADE text normalizer. Strips:
 * - LLM citation artifacts (【31†L20-L24】)
 * - Source-line references ([L20-L24])
 * - ASCII-art separator lines (====, ----, ____)
 * - Stray markdown bold markers (**, *)
 * - Markdown header hashes (##)
 * - Stray bullet markers
 * - Citation encoding artifacts
 * - Multiple blank lines
 * Returns clean prose. Does NOT redact PII (use redactPII for that).
 */
export function cleanArtifacts(text: string | null | undefined): string | null {
  if (!text) return null;
  let out = String(text);

  // 1. Remove citation artifacts
  out = out.replace(CITATION_ARTIFACT_RE, "");
  out = out.replace(LINE_REF_RE, "");

  // 2. Remove ASCII-art separator lines (lines that are just ==== or ----)
  out = out.replace(SEPARATOR_LINE_RE, "");

  // 3. Remove markdown header hashes
  out = out.replace(HEADER_HASH_RE, "");

  // 4. Convert inline bold (**text**) to just text
  out = out.replace(INLINE_BOLD_RE, " $1");

  // 5. Remove leading bold markers at start of text/lines
  out = out.replace(LEADING_BOLD_RE, "");

  // 6. Remove any remaining bare ** pairs
  out = out.replace(BARE_ASTERISKS_RE, "");

  // 7. Remove stray single asterisks
  out = out.replace(STRAY_ASTERISK_RE, "");

  // 8. Remove stray bullet markers at start of lines
  out = out.replace(BULLET_ARTIFACT_RE, "");

  // 9. Trim each line
  out = out.replace(LINE_TRIM_RE, "");

  // 10. Collapse multiple blank lines
  out = out.replace(MULTI_BLANK_RE, "\n\n");

  // 11. Final whitespace squash
  return squashWhitespace(out);
}

/**
 * Decode percent-encoded URL characters for DISPLAY purposes only.
 * e.g. "aclunc.org/our%20work/get%20help" → "aclunc.org/our work/get help"
 * The actual href stays encoded (for safety); only the visible text is decoded.
 */
export function decodeUrlForDisplay(url: string | null | undefined): string {
  if (!url) return "";
  try {
    return decodeURIComponent(url);
  } catch {
    return url;
  }
}

// ---- PII redaction ---------------------------------------------------------

const SSN_RE = /\b\d{3}-\d{2}-\d{4}\b/g;
// 13-19 contiguous digits (likely credit card / account)
const LONG_DIGIT_RE = /\b\d{13,19}\b/g;
// DOB context: "DOB: 01/02/1990" or "born 1990-01-02"
const DOB_RE = /\b(DOB|Date of Birth|born)\s*[:\-]?\s*(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4}|\d{4}-\d{2}-\d{2})\b/gi;

export interface RedactionResult {
  text: string;
  changes: string[];
}

// ---- Spam/non-resource content detection ----
// These patterns indicate the text is NOT a victim/advocacy resource but
// rather freelance marketplace, code-selling, or gig-economy content that
// leaked into the data. The pipeline flags these for review.
const SPAM_PATTERNS = [
  /\bfiverr\b/i,
  /\bupwork\b/i,
  /\bfreelancer\.com\b/i,
  /\bpeopleperhour\b/i,
  /\bguru\.com\b/i,
  /\btoptal\b/i,
  /\bnocodedevs\b/i,
  /\bmakerpad\b/i,
  /\bworksome\b/i,
  /\bcodemap\.io\b/i,
  /\bkolabtree\b/i,
  /\baijobs\.net\b/i,
  /\bsell.*codebase\b/i,
  /\bbuy\/sell.*template\b/i,
  /\bflippa\b/i,
  /\bgig package\b/i,
  /\bfreelance marketplace\b/i,
  /\bsell no-code\b/i,
  /\bcommission on sales\b/i,
  /\bsafe-pay escrow\b/i,
];

export interface SpamCheckResult {
  isSpam: boolean;
  patterns: string[];
}

/**
 * Check if a resource's text contains spam/non-resource content.
 * Used by the PII pipeline to flag records that shouldn't be in the directory.
 */
export function checkSpam(name: string, description: string | null, tags: string): SpamCheckResult {
  const combined = `${name} ${description ?? ""} ${tags}`.toLowerCase();
  const matched: string[] = [];
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(combined)) {
      matched.push(pattern.source);
    }
  }
  return {
    isSpam: matched.length > 0,
    patterns: matched,
  };
}

export function redactPII(text: string | null | undefined): RedactionResult {
  const changes: string[] = [];
  if (!text) return { text: "", changes };
  let out = String(text);

  const ssnMatches = out.match(SSN_RE);
  if (ssnMatches) {
    out = out.replace(SSN_RE, "[SSN REDACTED]");
    changes.push(`Redacted ${ssnMatches.length} SSN pattern(s)`);
  }

  const dobMatches = out.match(DOB_RE);
  if (dobMatches) {
    out = out.replace(DOB_RE, (_m, p1) => `${p1}: [DOB REDACTED]`);
    changes.push(`Redacted ${dobMatches.length} DOB pattern(s)`);
  }

  const ccMatches = out.match(LONG_DIGIT_RE);
  if (ccMatches) {
    out = out.replace(LONG_DIGIT_RE, "[REDACTED]");
    changes.push(`Redacted ${ccMatches.length} long-digit (possible account/card) pattern(s)`);
  }

  // Spam content detection — flag but don't redact (let the admin decide)
  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(out)) {
      changes.push(`SPAM DETECTED: pattern "${pattern.source}" found in text`);
    }
  }

  return { text: out, changes };
}

// ---- Full resource pass ----------------------------------------------------

import type { ResourceInput, Resource, PIIPassReport } from "./types";

export interface NormalizedResource {
  phoneNormalized: string | null;
  email: string | null;
  website: string | null;
  name: string;
  description: string | null;
  changes: string[];
}

/**
 * Run the full normalization pipeline on a resource input.
 * Returns sanitized fields + a list of human-readable changes.
 */
export function normalizeResource(input: ResourceInput): NormalizedResource {
  const changes: string[] = [];

  const allPhones = extractAllPhones(input.phoneRaw);
  const phoneNormalized = allPhones.length > 0 ? allPhones.join(" | ") : null;
  if (input.phoneRaw && phoneNormalized) {
    changes.push("Phone normalized");
  } else if (input.phoneRaw && !phoneNormalized) {
    changes.push("Phone could not be parsed");
  }

  const rawEmail = input.email ?? null;
  const email = normalizeEmail(rawEmail);
  if (rawEmail && email && email !== rawEmail) {
    changes.push("Email normalized");
  } else if (rawEmail && !email) {
    changes.push("Email invalid and dropped");
  }

  const rawSite = input.website ?? null;
  const website = normalizeUrl(rawSite);
  if (rawSite && website && website !== rawSite) {
    changes.push("Website normalized");
  } else if (rawSite && !website) {
    changes.push("Website invalid and dropped");
  }

  const name = squashWhitespace(input.name) ?? input.name;
  if (name !== input.name) {
    changes.push(`Name whitespace normalized`);
  }

  const descRaw = input.description ?? null;
  const redacted = redactPII(descRaw);
  const description = cleanArtifacts(redacted.text) || null;
  if (redacted.changes.length) {
    changes.push(...redacted.changes);
  }

  return { phoneNormalized, email, website, name, description, changes };
}

/**
 * Build a PIIPassReport from a stored Resource after re-running normalization.
 * Used by the admin "Run PII cleanup" action.
 */
export function buildReport(res: Resource, normalized: NormalizedResource): PIIPassReport {
  return {
    resourceId: res.id,
    name: res.name,
    changed: normalized.changes.length > 0,
    changes: normalized.changes,
  };
}
