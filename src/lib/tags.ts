/**
 * Shared tag utilities for the BNDR. Resource Directory.
 *
 * Internal/technical tags are provenance markers (e.g. "master_extract",
 * "deduplicated", "ri-00500") that are stored + indexed for search but
 * should NOT be displayed to end users — the VLM flagged them as visual
 * noise. This utility provides a single source-of-truth filter.
 */

/** Regex patterns for internal/provenance tags that should be hidden from UI. */
export const INTERNAL_TAG_PATTERNS = [
  /^master_extract$/i,
  /^deduplicated/i,
  /^ri-\d+/i,
  /^final_/i,
  /^source:/i,
  /^validation:/i,
];

/** Returns true if a tag is an internal/provenance marker that should be hidden. */
export function isInternalTag(tag: string): boolean {
  return INTERNAL_TAG_PATTERNS.some((p) => p.test(tag));
}

/**
 * Parse a comma-separated tag string into a clean array of user-facing tags.
 * Trims, removes empties, and filters out internal/provenance tags.
 */
export function parseTags(tags: string | null | undefined): string[] {
  if (!tags) return [];
  return tags
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .filter((t) => !isInternalTag(t));
}
