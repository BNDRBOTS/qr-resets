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
 * Mobile-first category filter rail. Every category uses the same pill geometry.
 * The overview control lives inside a dedicated icon cell so it cannot overlap
 * the category label/count or create an asymmetrical joined-pill shape.
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
      className="bndr-glass-bar sticky top-16 z-30 border-y border-border/55"
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
                  "bndr-filter-pill group flex h-10 shrink-0 items-stretch overflow-hidden rounded-full border transition-all " +
                  (isActive
                    ? "border-primary/55 bg-primary/12 text-primary shadow-[var(--shadow-accent-soft)]"
                    : "border-border/70 bg-card/58 text-muted-foreground hover:border-primary/35 hover:bg-card/78 hover:text-foreground")
                }
              >
                <button
                  type="button"
                  onClick={() => onChange(pill.slug)}
                  aria-pressed={isActive}
                  className="flex min-w-0 items-center gap-2 rounded-l-full px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/55 sm:px-3.5"
                >
                  <span className="max-w-[12.5rem] whitespace-nowrap">{pill.label}</span>
                  <span
                    className={
                      "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums " +
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
                    className="flex w-9 shrink-0 items-center justify-center border-l border-current/10 text-current/70 outline-none transition-colors hover:bg-primary/10 hover:text-primary focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/55"
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
