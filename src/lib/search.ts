// BNDR. Weighted Fuzzy Search Engine
// ----------------------------------------------------------------------------
// A dependency-free scoring search that combines:
//  - Exact / prefix token matching (high weight)
//  - Substring matching across name, acronym, tags, description, category
//  - Fuzzy Levenshtein token matching (handles typos)
//  - Acronym expansion bias (searching an acronym also matches the full name)
//  - Priority boost (higher-priority resources surface first on ties)
//
// All text is lowercased + tokenized. The pipeline is pure so the API can call it.

import type { Resource } from "./types";

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1, // deletion
        dp[j - 1] + 1, // insertion
        prev + (a[i - 1] === b[j - 1] ? 0 : 1), // substitution
      );
      prev = tmp;
    }
  }
  return dp[n];
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 0);
}

const STOPWORDS = new Set([
  "the", "and", "for", "of", "to", "a", "an", "in", "on", "at", "by", "with",
  "or", "is", "are", "be", "as", "from", "that", "this", "it", "its",
]);

function meaningfulTokens(s: string): string[] {
  return tokenize(s).filter((t) => !STOPWORDS.has(t) && t.length > 1);
}

export interface ScoredResource extends Resource {
  _score: number;
  _matched: string[];
}

/**
 * Score a single resource against the query tokens.
 * Returns a numeric score (higher = better) and matched fields for highlighting.
 */
export function scoreResource(res: Resource, queryTokens: string[]): { score: number; matched: string[] } {
  if (queryTokens.length === 0) return { score: 0, matched: [] };

  const haystacks = [
    { field: "name", text: res.name, weight: 5 },
    { field: "acronym", text: res.acronym ?? "", weight: 8 },
    { field: "tags", text: res.tags ?? "", weight: 4 },
    { field: "description", text: res.description ?? "", weight: 2 },
    { field: "category", text: res.category, weight: 3 },
    { field: "subcategory", text: res.subcategory ?? "", weight: 2 },
    { field: "address", text: res.address ?? "", weight: 1.5 },
    { field: "phoneRaw", text: res.phoneRaw ?? "", weight: 3 },
    { field: "phoneNormalized", text: res.phoneNormalized ?? "", weight: 3 },
    { field: "email", text: res.email ?? "", weight: 2 },
    { field: "website", text: res.website ?? "", weight: 2 },
    { field: "sourceNote", text: res.sourceNote ?? "", weight: 1.5 },
  ];

  let score = 0;
  const matched = new Set<string>();

  for (const { field, text, weight } of haystacks) {
    if (!text) continue;
    const lower = text.toLowerCase();
    const fieldTokens = tokenize(text);

    for (const qt of queryTokens) {
      // 1) Exact acronym match (highest signal)
      if (field === "acronym" && lower === qt) {
        score += 12 * weight;
        matched.add(field);
        continue;
      }
      // 2) Whole-substring match
      if (lower.includes(qt)) {
        // Word-boundary bonus
        const boundary = new RegExp(`\\b${escapeRegex(qt)}`).test(lower);
        score += (boundary ? 4 : 2.5) * weight;
        matched.add(field);
        continue;
      }
      // 3) Fuzzy token match (Levenshtein) within threshold
      let bestFuzzy = Infinity;
      for (const ft of fieldTokens) {
        if (Math.abs(ft.length - qt.length) > 2) continue;
        const d = levenshtein(qt, ft);
        if (d < bestFuzzy) bestFuzzy = d;
      }
      const tolerance = qt.length <= 4 ? 1 : 2;
      if (bestFuzzy <= tolerance) {
        score += (2 - bestFuzzy * 0.6) * weight;
        matched.add(field);
      }
    }
  }

  // Priority boost for operator-marked priority resources
  if (res.priority >= 1) {
    score *= 1.15;
  }

  return { score, matched: Array.from(matched) };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Search + rank a list of resources.
 */
export function searchResources(
  resources: Resource[],
  query: string,
  opts?: { limit?: number; offset?: number },
): ScoredResource[] {
  const tokens = meaningfulTokens(query);
  if (tokens.length === 0) {
    // No query → priority-first then name, with the same pagination contract.
    const sorted = resources
      .slice()
      .sort((a, b) => {
        if (b.priority !== a.priority) return b.priority - a.priority;
        return a.name.localeCompare(b.name);
      })
      .map((r) => ({ ...r, _score: 0, _matched: [] }));
    const limit = opts?.limit ?? sorted.length;
    const offset = opts?.offset ?? 0;
    return sorted.slice(offset, offset + limit);
  }

  const scored = resources
    .map((r) => {
      const { score, matched } = scoreResource(r, tokens);
      return { ...r, _score: score, _matched: matched };
    })
    .filter((r) => r._score > 0)
    .sort((a, b) => {
      if (b._score !== a._score) return b._score - a._score;
      if (b.priority !== a.priority) return b.priority - a.priority;
      return a.name.localeCompare(b.name);
    });

  const limit = opts?.limit ?? scored.length;
  const offset = opts?.offset ?? 0;
  return scored.slice(offset, offset + limit);
}
