"use client";

// BNDR. — Recently Viewed Carousel Strip
// ----------------------------------------------------------------------------
// A horizontal scrollable strip showing recently viewed resources, positioned
// below the hero. Each item is a compact card with the resource name and
// category. Clicking opens the resource detail dialog.
// Includes a "Compare" mode toggle — when enabled, each item shows a checkbox
// and clicking adds/removes from the compare tray instead of opening details.
// Only appears when the user has recently viewed resources.

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ChevronRight, X, ArrowLeftRight, Check } from "lucide-react";
import type { Resource, CategorySlug } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";

interface RecentlyViewedStripProps {
  recent: Resource[];
  onOpen: (r: Resource) => void;
  onClear?: () => void;
  isComparing?: (id: string) => boolean;
  onToggleCompare?: (r: Resource) => void;
  compareCount?: number;
  onOpenCompare?: () => void;
}

function categoryShortName(slug: CategorySlug): string {
  return CATEGORIES.find((c) => c.slug === slug)?.shortName ?? slug;
}

export function RecentlyViewedStrip({
  recent,
  onOpen,
  onClear,
  isComparing,
  onToggleCompare,
  compareCount = 0,
  onOpenCompare,
}: RecentlyViewedStripProps) {
  const [compareMode, setCompareMode] = useState(false);
  if (recent.length === 0) return null;

  const items = recent.slice(0, 8); // cap at 8 for the strip

  return (
    <section
      aria-label="Recently viewed resources"
      className="border-b border-border/40 bg-card/20"
    >
      <div className="container mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex size-6 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Clock className="h-3.5 w-3.5" aria-hidden />
            </span>
            <h2 className="text-sm font-semibold text-foreground">
              Recently Viewed
            </h2>
            <span className="rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {recent.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* Compare mode toggle */}
            {onToggleCompare && recent.length >= 2 ? (
              <button
                type="button"
                onClick={() => setCompareMode((v) => !v)}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                  compareMode
                    ? "border-primary/60 bg-primary/15 text-primary"
                    : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary"
                }`}
                aria-pressed={compareMode}
              >
                <ArrowLeftRight className="size-3" aria-hidden />
                {compareMode ? "Comparing" : "Compare"}
              </button>
            ) : null}
            {/* Open compare tray (when 2+ selected) */}
            {compareCount >= 2 && onOpenCompare ? (
              <button
                type="button"
                onClick={onOpenCompare}
                className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/25"
              >
                <ArrowLeftRight className="size-3" aria-hidden />
                View ({compareCount})
              </button>
            ) : null}
            {onClear ? (
              <button
                type="button"
                onClick={onClear}
                className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
              >
                <X className="h-3 w-3" aria-hidden />
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className="bndr-pill-scroll flex gap-2.5 overflow-x-auto pb-1">
          <AnimatePresence>
            {items.map((r, i) => {
              const comparing = isComparing?.(r.id) ?? false;
              return (
                <motion.button
                  key={r.id}
                  type="button"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                  whileHover={{ y: -2 }}
                  onClick={() => {
                    if (compareMode && onToggleCompare) {
                      onToggleCompare(r);
                    } else {
                      onOpen(r);
                    }
                  }}
                  className={`group flex shrink-0 items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-all hover:shadow-md ${
                    compareMode && comparing
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/60 bg-background/60 hover:border-primary/40 hover:bg-card/80"
                  }`}
                >
                  {/* Compare checkbox (only in compare mode) */}
                  {compareMode ? (
                    <span
                      className={`flex size-4 items-center justify-center rounded border transition-colors ${
                        comparing
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 bg-transparent"
                      }`}
                      aria-hidden
                    >
                      {comparing ? <Check className="size-3" aria-hidden /> : null}
                    </span>
                  ) : null}
                  <div className="min-w-0">
                    <div className="max-w-[180px] truncate text-xs font-medium text-foreground">
                      {r.name}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {categoryShortName(r.category)}
                    </div>
                  </div>
                  {compareMode ? null : (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary" aria-hidden />
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Compare mode hint */}
        {compareMode ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Select 2–3 resources to compare side-by-side.{" "}
            {compareCount >= 2 ? "Ready to compare." : `${compareCount} selected.`}
          </p>
        ) : null}
      </div>
    </section>
  );
}
