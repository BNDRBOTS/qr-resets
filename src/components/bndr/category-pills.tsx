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
 * Horizontally-scrollable on mobile, wrapping on desktop. Each pill shows the
 * category shortName + count. "All" pill first. Clicking the small info icon
 * on a category pill opens the category overview modal (if onShowCategory set).
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
      className="sticky top-16 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl"
    >
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="bndr-pill-scroll flex gap-2 overflow-x-auto py-3">
          {pills.map((p) => {
            const isActive = active === p.slug;
            const isCategory = p.slug !== "all";
            return (
              <div
                key={p.slug}
                className="group flex shrink-0 items-stretch"
              >
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onChange(p.slug)}
                  aria-pressed={isActive}
                  className={
                    "flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm transition-colors " +
                    (isActive
                      ? "border-primary/60 bg-primary/15 text-primary shadow-[0_0_18px_-6px_oklch(0.70_0.26_255/0.6)]"
                      : "border-border bg-muted/40 text-muted-foreground hover:border-primary/30 hover:text-primary") +
                    (isCategory && onShowCategory ? " rounded-r-none pr-2.5" : "")
                  }
                >
                  <span className="whitespace-nowrap">{p.label}</span>
                  <span
                    className={
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums " +
                      (isActive
                        ? "bg-primary/25 text-primary"
                        : "bg-muted-foreground/15 text-muted-foreground")
                    }
                  >
                    {p.count}
                  </span>
                </motion.button>
                {isCategory && onShowCategory ? (
                  <button
                    type="button"
                    onClick={() => onShowCategory(p.slug as CategorySlug)}
                    aria-label={`Overview of ${p.label} category`}
                    className={
                      "flex items-center justify-center rounded-full border border-l-0 px-1.5 text-muted-foreground/60 transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 " +
                      (isActive
                        ? "border-primary/60 bg-primary/15"
                        : "border-border bg-muted/40 hover:border-primary/30")
                    }
                  >
                    <Info className="size-3" aria-hidden />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
