"use client";

// BNDR. — Browse by Category visual grid
// ----------------------------------------------------------------------------
// A visually rich category browser that appears below the stats strip.
// Each category gets a card with a unique gradient icon, prominent count
// badge, short name, description, and resource count. Clicking a card
// filters the directory and smooth-scrolls to the resource list.
// Includes a collapsible toggle: "Show top 6" vs "Show all 13".

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import type { CategorySlug } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

interface CategoryGridProps {
  counts: Record<string, number>;
  onSelect: (slug: CategorySlug) => void;
  /** Optional: contact method coverage stats per category. */
  categoryStats?: Record<string, { withPhone: number; withEmail: number; withWebsite: number }>;
}

// Unique icon + gradient per category for visual scannability.
const CATEGORY_VISUALS: Record<
  CategorySlug,
  { gradient: string; emoji: string; accent: string }
> = {
  "child-abduction": {
    gradient: "from-rose-500/20 to-orange-500/20",
    emoji: "🛡️",
    accent: "text-rose-400",
  },
  "victim-rights-compensation": {
    gradient: "from-amber-500/20 to-yellow-500/20",
    emoji: "⚖️",
    accent: "text-amber-400",
  },
  "domestic-violence-family-violence": {
    gradient: "from-red-500/20 to-pink-500/20",
    emoji: "🏠",
    accent: "text-red-400",
  },
  "family-advocacy-trauma-recovery": {
    gradient: "from-emerald-500/20 to-teal-500/20",
    emoji: "💜",
    accent: "text-emerald-400",
  },
  "protective-parent-family-court": {
    gradient: "from-violet-500/20 to-purple-500/20",
    emoji: "👨‍👩‍👧",
    accent: "text-violet-400",
  },
  "gaslighting-darvo-institutional-betrayal": {
    gradient: "from-fuchsia-500/20 to-pink-500/20",
    emoji: "🔍",
    accent: "text-fuchsia-400",
  },
  "parental-alienation-fathers-rights": {
    gradient: "from-blue-500/20 to-indigo-500/20",
    emoji: "👪",
    accent: "text-blue-400",
  },
  "legal-aid-court-access": {
    gradient: "from-cyan-500/20 to-blue-500/20",
    emoji: "⚖️",
    accent: "text-cyan-400",
  },
  "attorneys-firms": {
    gradient: "from-slate-500/20 to-gray-500/20",
    emoji: "💼",
    accent: "text-slate-400",
  },
  "disability-medical-advocacy": {
    gradient: "from-green-500/20 to-emerald-500/20",
    emoji: "♿",
    accent: "text-green-400",
  },
  "victim-linked-programs": {
    gradient: "from-orange-500/20 to-red-500/20",
    emoji: "🔗",
    accent: "text-orange-400",
  },
  "lyme-co-infections": {
    gradient: "from-lime-500/20 to-green-500/20",
    emoji: "🦠",
    accent: "text-lime-400",
  },
  "housing-financial-aid": {
    gradient: "from-teal-500/20 to-cyan-500/20",
    emoji: "🏡",
    accent: "text-teal-400",
  },
};

export function CategoryGrid({ counts, onSelect, categoryStats }: CategoryGridProps) {
  const [expanded, setExpanded] = useState(false);
  // Show top 6 by default (sorted by count descending for "top" categories).
  const sortedCats = [...CATEGORIES].sort(
    (a, b) => (counts[b.slug] ?? 0) - (counts[a.slug] ?? 0),
  );
  const visibleCats = expanded ? sortedCats : sortedCats.slice(0, 6);
  const hiddenCount = CATEGORIES.length - 6;

  return (
    <section
      aria-label="Browse by category"
      className="py-12 md:py-16"
    >
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Browse by Category
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Thirteen source-derived categories covering the full spectrum of
            victim, advocacy &amp; family-court support.
          </p>
          {/* Volume legend */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-emerald-500/60" aria-hidden />
              100+ resources
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-amber-500/60" aria-hidden />
              50–99 resources
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2.5 rounded-full bg-blue-500/60" aria-hidden />
              under 50
            </span>
            <span className="mx-2 h-3 w-px bg-border/60" aria-hidden />
            <span className="inline-flex items-center gap-1.5" title="Contact coverage: phone / email / website %">
              <span className="text-[10px] uppercase tracking-wider">Coverage:</span>
              <span className="inline-flex items-center gap-0.5">
                <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
                ≥70%
              </span>
              <span className="inline-flex items-center gap-0.5">
                <span className="size-1.5 rounded-full bg-amber-500" aria-hidden />
                40–69%
              </span>
              <span className="inline-flex items-center gap-0.5">
                <span className="size-1.5 rounded-full bg-muted-foreground/40" aria-hidden />
                &lt;40%
              </span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {visibleCats.map((cat, i) => {
            const visual = CATEGORY_VISUALS[cat.slug];
            const count = counts[cat.slug] ?? 0;
            // Volume-based badge color: green for >100, amber for 50-99, blue for <50.
            const badgeClass =
              count >= 100
                ? "bg-emerald-500/15 text-emerald-400 group-hover:bg-emerald-500/25"
                : count >= 50
                  ? "bg-amber-500/15 text-amber-400 group-hover:bg-amber-500/25"
                  : "bg-blue-500/15 text-blue-400 group-hover:bg-blue-500/25";
            return (
              <motion.button
                key={cat.slug}
                type="button"
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.04 }}
                whileHover={{ y: -4 }}
                onClick={() => onSelect(cat.slug)}
                className="bndr-category-card-glow group relative flex h-full min-h-[200px] flex-col items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-card/50 p-5 text-center transition-all hover:border-primary/40 hover:bg-card/80 hover:shadow-[0_8px_30px_-8px_oklch(0.70_0.26_330/0.2)]"
              >
                {/* Gradient backdrop on hover */}
                <div
                  className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${visual.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
                  aria-hidden
                />

                {/* Icon — large, centered */}
                <div
                  className={`relative flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br ${visual.gradient} text-3xl shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3`}
                  aria-hidden
                >
                  {visual.emoji}
                </div>

                {/* Prominent count badge — pill-shaped, volume-colored */}
                <div className="relative">
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-0.5 text-xs font-bold tabular-nums transition-colors ${badgeClass}`}>
                    {count} {count === 1 ? "resource" : "resources"}
                  </span>
                </div>

                {/* Name + description */}
                <div className="relative flex-1">
                  <h3 className="text-sm font-semibold leading-tight text-foreground">
                    {cat.shortName}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                    {cat.description}
                  </p>
                </div>

                {/* Contact coverage mini-stats */}
                {categoryStats && categoryStats[cat.slug] && count > 0 ? (
                  <div className="relative flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
                    {(() => {
                      const s = categoryStats[cat.slug];
                      const pct = (n: number) => Math.round((n / count) * 100);
                      return (
                        <>
                          <span className="inline-flex items-center gap-0.5" title={`${s.withPhone} with phone (${pct(s.withPhone)}%)`}>
                            <span className={`size-1.5 rounded-full ${pct(s.withPhone) >= 70 ? "bg-emerald-500" : pct(s.withPhone) >= 40 ? "bg-amber-500" : "bg-muted-foreground/40"}`} />
                            {pct(s.withPhone)}%
                          </span>
                          <span className="inline-flex items-center gap-0.5" title={`${s.withEmail} with email (${pct(s.withEmail)}%)`}>
                            <span className={`size-1.5 rounded-full ${pct(s.withEmail) >= 70 ? "bg-emerald-500" : pct(s.withEmail) >= 40 ? "bg-amber-500" : "bg-muted-foreground/40"}`} />
                            {pct(s.withEmail)}%
                          </span>
                          <span className="inline-flex items-center gap-0.5" title={`${s.withWebsite} with website (${pct(s.withWebsite)}%)`}>
                            <span className={`size-1.5 rounded-full ${pct(s.withWebsite) >= 70 ? "bg-emerald-500" : pct(s.withWebsite) >= 40 ? "bg-amber-500" : "bg-muted-foreground/40"}`} />
                            {pct(s.withWebsite)}%
                          </span>
                        </>
                      );
                    })()}
                  </div>
                ) : null}

                {/* Hover arrow */}
                <div className="relative mt-auto flex items-center gap-1 text-xs font-medium text-primary/0 transition-colors group-hover:text-primary">
                  Explore
                  <svg
                    className="h-3 w-3 transition-transform group-hover:translate-x-0.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
              </motion.button>
            );
          })}
        </div>

        {/* Expand/collapse toggle */}
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-4 py-2 text-sm font-medium text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
            aria-expanded={expanded}
          >
            {expanded ? "Show top 6" : `Show all ${CATEGORIES.length} categories`}
            <ChevronDown
              className={`h-4 w-4 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
        </div>
      </div>
    </section>
  );
}
