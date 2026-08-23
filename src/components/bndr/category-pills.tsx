"use client";

import { motion } from "framer-motion";
import { Info } from "lucide-react";
import { CATEGORIES, type CategorySlug } from "@/lib/types";

interface CategoryPillsProps {
  active: CategorySlug | "all";
  onChange: (slug: CategorySlug | "all") => void;
  counts: Record<string, number>;
  total: number;
  onShowCategory?: (slug: CategorySlug) => void;
}

/**
 * Mobile-first category filter rail. Every category uses one continuous rounded
 * pill; the overview control stays independently clickable without visually
 * splitting the pill into joined segments.
 */
export function CategoryPills({
  active,
  onChange,
  counts,
  total,
  onShowCategory,
}: CategoryPillsProps) {
  const pills: Array<{ slug: CategorySlug | "all"; label: string; count: number }> = [
    { slug: "all", label: "All", count: total },
    ...CATEGORIES.map((c) => ({
      slug: c.slug,
      label: c.shortName,
      count: counts[c.slug] ?? 0,
    })),
  ];

  return (
    <section
      id="categories"
      aria-label="Filter by category"
      className="bndr-glass-bar bndr-category-filter-bar sticky top-16 z-30 border-y border-border/55"
    >
      <div className="container mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="bndr-pill-scroll flex gap-2 overflow-x-auto py-2.5 sm:flex-wrap sm:justify-center sm:overflow-visible sm:py-3">
          {pills.map((pill) => {
            const isActive = active === pill.slug;
            const isCategory = pill.slug !== "all";

            return (
              <motion.div
                key={pill.slug}
                whileTap={{ scale: 0.985 }}
                className={
                  "bndr-filter-pill group flex h-10 shrink-0 items-center overflow-hidden rounded-full border transition-all " +
                  (isActive
                    ? "border-primary/45 bg-primary/12 text-primary shadow-[var(--shadow-accent-soft)]"
                    : "border-border/45 bg-card/68 text-muted-foreground hover:border-primary/25 hover:bg-card/82 hover:text-foreground")
                }
              >
                <button
                  type="button"
                  onClick={() => onChange(pill.slug)}
                  aria-pressed={isActive}
                  className="flex min-w-0 items-center gap-2 rounded-full px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/55 sm:px-3.5"
                >
                  <span className="max-w-[12.5rem] truncate sm:max-w-none sm:overflow-visible sm:text-clip">{pill.label}</span>
                  <span
                    className={
                      "inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums " +
                      (isActive ? "bg-primary/18 text-primary" : "bg-muted/75 text-muted-foreground")
                    }
                  >
                    {pill.count}
                  </span>
                </button>

                {isCategory && onShowCategory ? (
                  <button
                    type="button"
                    onClick={() => onShowCategory(pill.slug as CategorySlug)}
                    aria-label={`Overview of ${pill.label} category`}
                    className="mr-1 flex size-8 shrink-0 items-center justify-center rounded-full text-current/60 outline-none transition-colors hover:bg-primary/8 hover:text-primary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/45"
                  >
                    <Info className="size-3.5" aria-hidden />
                  </button>
                ) : null}
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
