"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { CategoryGlyph } from "@/components/shared/bndr-icons";
import type { CategorySlug } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { useSiteCopy } from "@/lib/use-site-copy";

interface CategoryGridProps {
  counts: Record<string, number>;
  onSelect: (slug: CategorySlug) => void;
}

export function CategoryGrid({ counts, onSelect }: CategoryGridProps) {
  const copy = useSiteCopy();
  const visible = CATEGORIES.filter((cat) => (counts[cat.slug] ?? 0) > 0);

  return (
    <section aria-label="Browse by category" className="py-10 sm:py-12 md:py-16">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto mb-7 max-w-3xl text-center sm:mb-9">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Browse by Category</h2>
          <p className="mt-2 text-sm leading-relaxed text-foreground/80 sm:text-base">{copy.categoryIntro}</p>
        </div>

        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 lg:gap-5">
          {visible.map((cat, index) => {
            const count = counts[cat.slug] ?? 0;
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
                className="bndr-category-tile group relative flex min-h-[184px] w-full flex-col overflow-hidden rounded-[1.4rem] p-4 text-left sm:min-h-[190px] sm:p-5"
              >
                <div className="flex items-start gap-3">
                  <span className="bndr-category-icon flex size-10 shrink-0 items-center justify-center rounded-full text-primary sm:size-11">
                    <CategoryGlyph slug={cat.slug} className="size-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-sm font-semibold leading-snug text-foreground sm:text-[15px]">{cat.shortName}</h3>
                      <span className="bndr-category-count inline-flex min-h-7 shrink-0 items-center justify-center rounded-full px-2.5 text-[11px] font-semibold tabular-nums text-foreground/90">
                        {count}
                      </span>
                    </div>
                    <p className="mt-3 bndr-line-clamp-3 text-[12px] leading-[1.6] text-foreground/80 sm:text-[12.5px]">{cat.description}</p>
                  </div>
                </div>

                <span className="bndr-category-link mt-auto inline-flex items-center gap-1.5 self-end pt-4 text-xs font-semibold text-primary">
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
