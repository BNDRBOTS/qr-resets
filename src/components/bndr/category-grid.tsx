"use client";

// BNDR. — targeted category-section polish
// -----------------------------------------------------------------------------
// Scope is intentionally narrow: only the top-level Browse by Category tiles
// are redesigned here. Header/hero/resource-card behavior remains unchanged.

import { motion } from "framer-motion";
import { ArrowRight, Mail, Phone, Globe2 } from "lucide-react";
import { CategoryGlyph } from "@/components/shared/bndr-icons";
import type { CategorySlug } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

interface CategoryGridProps {
  counts: Record<string, number>;
  onSelect: (slug: CategorySlug) => void;
  /** Optional: contact method coverage stats per category. */
  categoryStats?: Record<string, { withPhone: number; withEmail: number; withWebsite: number }>;
}

function coveragePercent(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

export function CategoryGrid({ counts, onSelect, categoryStats }: CategoryGridProps) {
  const lastIndex = CATEGORIES.length - 1;

  return (
    <section aria-label="Browse by category" className="py-10 sm:py-12 md:py-16">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-7 max-w-3xl text-center sm:mb-9">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Browse by Category
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground sm:text-base">
            All thirteen source-derived categories are available with equal prominence.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5">
          {CATEGORIES.map((cat, index) => {
            const count = counts[cat.slug] ?? 0;
            const coverage = categoryStats?.[cat.slug];
            const isLast = index === lastIndex;

            return (
              <motion.button
                key={cat.slug}
                type="button"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.34, delay: Math.min(index * 0.025, 0.18) }}
                whileHover={{ y: -3 }}
                onClick={() => onSelect(cat.slug)}
                className={
                  "bndr-category-tile group relative flex min-h-[188px] w-full flex-col justify-between overflow-hidden rounded-[1.4rem] p-4 text-left sm:min-h-[196px] sm:p-5 " +
                  (isLast
                    ? "sm:col-span-2 sm:max-w-[44rem] sm:justify-self-center lg:col-span-1 lg:col-start-2 lg:max-w-none"
                    : "")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-3">
                      <span className="bndr-category-icon flex size-10 shrink-0 items-center justify-center rounded-full text-primary sm:size-11">
                        <CategoryGlyph slug={cat.slug} className="size-[1.15rem] sm:size-5.5" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold leading-snug text-foreground sm:text-[15px]">
                          {cat.shortName}
                        </h3>
                      </div>
                    </div>
                  </div>

                  <span className="bndr-category-count inline-flex min-h-7 shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-semibold tabular-nums text-foreground/80">
                    {count} {count === 1 ? "resource" : "resources"}
                  </span>
                </div>

                <p className="mt-4 bndr-line-clamp-3 text-[12px] leading-[1.6] text-muted-foreground sm:text-[12.5px]">
                  {cat.description}
                </p>

                <div className="mt-5 flex items-end justify-between gap-3">
                  {coverage && count > 0 ? (
                    <div className="bndr-category-metrics" aria-label={`${cat.shortName} contact coverage`}>
                      <span className="bndr-category-metric" title={`${coverage.withPhone} with phone`}>
                        <Phone className="size-3" aria-hidden />
                        {coveragePercent(coverage.withPhone, count)}%
                      </span>
                      <span className="bndr-category-metric" title={`${coverage.withEmail} with email`}>
                        <Mail className="size-3" aria-hidden />
                        {coveragePercent(coverage.withEmail, count)}%
                      </span>
                      <span className="bndr-category-metric" title={`${coverage.withWebsite} with website`}>
                        <Globe2 className="size-3" aria-hidden />
                        {coveragePercent(coverage.withWebsite, count)}%
                      </span>
                    </div>
                  ) : (
                    <span className="bndr-category-metrics bndr-category-metrics--empty text-[11px] text-muted-foreground/65">
                      Source-backed category
                    </span>
                  )}

                  <span className="bndr-category-link inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                    Explore
                    <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </span>
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
