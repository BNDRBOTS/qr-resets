import { searchResources, type ScoredResource } from "./search.ts";
import type { Resource } from "./types.ts";

export const RESOURCE_SCAN_PAGE_SIZE = 250;

export interface ResourcePageSource {
  count(): Promise<number>;
  fetchPage(input: { skip: number; take: number }): Promise<Resource[]>;
}

/**
 * Return one public/admin API page while preserving the directory's original
 * weighted fuzzy search semantics.
 *
 * - Empty query: the database supplies the requested page directly.
 * - Search query: rows are read from the database in bounded pages, then the
 *   original searchResources scorer ranks the complete filtered candidate set
 *   before the requested API page is sliced. This is necessary for exact
 *   global typo/fuzzy/acronym/priority ranking: a database substring WHERE
 *   clause would silently discard typo-only matches before they can be scored.
 */
export async function paginateResources(
  source: ResourcePageSource,
  input: { q: string; limit: number; offset: number },
): Promise<{ resources: ScoredResource[]; total: number }> {
  const q = input.q.trim();

  if (!q) {
    const [total, rows] = await Promise.all([
      source.count(),
      source.fetchPage({ skip: input.offset, take: input.limit }),
    ]);
    return {
      resources: rows.map((row) => ({ ...row, _score: 0, _matched: [] })),
      total,
    };
  }

  const baseTotal = await source.count();
  const candidates: Resource[] = [];
  for (let skip = 0; skip < baseTotal; skip += RESOURCE_SCAN_PAGE_SIZE) {
    const page = await source.fetchPage({
      skip,
      take: Math.min(RESOURCE_SCAN_PAGE_SIZE, baseTotal - skip),
    });
    candidates.push(...page);
    if (page.length === 0) break;
  }

  const ranked = searchResources(candidates, q);
  return {
    resources: ranked.slice(input.offset, input.offset + input.limit),
    total: ranked.length,
  };
}
