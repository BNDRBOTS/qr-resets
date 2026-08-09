"use client";

// BNDR. — balanced category browser
// ----------------------------------------------------------------------------
// Every source-derived category is shown with equal card geometry and equal
// visual weight. No count-based ranking or default "top" subset is used, so a
// sensitive category is never universally promoted simply because of volume.

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

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          {CATEGORIES.map((cat, index) => {
            const count = counts[cat.slug] ?? 0;
            const coverage = categoryStats?.[cat.slug];

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
                className="bndr-category-card-glow bndr-glass-panel group relative flex min-h-[190px] w-full flex-col overflow-hidden rounded-2xl p-4 text-left sm:min-h-[205px] sm:p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="bndr-icon-well flex size-11 shrink-0 items-center justify-center rounded-xl text-primary sm:size-12">
                    <CategoryGlyph slug={cat.slug} className="size-6 sm:size-7" />
                  </span>
                  <span className="bndr-count-pill inline-flex min-h-7 items-center justify-center rounded-full px-2.5 text-[11px] font-semibold tabular-nums text-foreground/80">
                    {count} {count === 1 ? "resource" : "resources"}
                  </span>
                </div>

                <div className="mt-4 min-w-0 flex-1">
                  <h3 className="text-sm font-semibold leading-snug text-foreground sm:text-[15px]">
                    {cat.shortName}
                  </h3>
                  <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                    {cat.description}
                  </p>
                </div>

                {coverage && count > 0 ? (
                  <div className="mt-4 grid grid-cols-3 gap-1.5" aria-label={`${cat.shortName} contact coverage`}>
                    <span className="bndr-mini-stat" title={`${coverage.withPhone} with phone`}>
                      <Phone className="size-3" aria-hidden />
                      {coveragePercent(coverage.withPhone, count)}%
                    </span>
                    <span className="bndr-mini-stat" title={`${coverage.withEmail} with email`}>
                      <Mail className="size-3" aria-hidden />
                      {coveragePercent(coverage.withEmail, count)}%
                    </span>
                    <span className="bndr-mini-stat" title={`${coverage.withWebsite} with website`}>
                      <Globe2 className="size-3" aria-hidden />
                      {coveragePercent(coverage.withWebsite, count)}%
                    </span>
                  </div>
                ) : null}

                <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-primary">
                  Explore
                  <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
