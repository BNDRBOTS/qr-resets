"use client";

import { motion } from "framer-motion";
import { CATEGORIES, type CategorySlug } from "@/lib/types";

interface CategoryPillsProps {
  active: CategorySlug | "all";
  onChange: (slug: CategorySlug | "all") => void;
  counts: Record<string, number>;
  total: number;
}

export function CategoryPills({ active, onChange, counts, total }: CategoryPillsProps) {
  const pills: Array<{ slug: CategorySlug | "all"; label: string; count: number }> = [
    { slug: "all", label: "All", count: total },
    ...CATEGORIES.filter((c) => (counts[c.slug] ?? 0) > 0).map((c) => ({
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
            return (
              <motion.button
                key={pill.slug}
                type="button"
                whileTap={{ scale: 0.985 }}
                onClick={() => onChange(pill.slug)}
                aria-pressed={isActive}
                className={
                  "bndr-filter-pill group flex h-10 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold outline-none transition-all focus-visible:ring-2 focus-visible:ring-primary/55 " +
                  (isActive
                    ? "border-primary/55 bg-primary/15 text-primary shadow-[var(--shadow-accent-soft)]"
                    : "border-border/55 bg-card/85 text-foreground/85 hover:border-primary/35 hover:bg-card hover:text-foreground")
                }
              >
                <span className="max-w-[13rem] truncate sm:max-w-none">{pill.label}</span>
                <span className={
                  "inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums " +
                  (isActive ? "bg-primary/20 text-primary" : "bg-muted/75 text-foreground/75")
                }>
                  {pill.count}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
