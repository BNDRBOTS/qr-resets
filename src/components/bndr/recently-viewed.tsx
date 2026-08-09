"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Clock, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CATEGORIES, type Resource, type CategorySlug } from "@/lib/types";
import { formatPhoneDisplay } from "@/lib/pii";

const CATEGORY_NAME: Record<CategorySlug, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.shortName]),
) as Record<CategorySlug, string>;

interface RecentlyViewedProps {
  recent: Resource[];
  onOpen: (r: Resource) => void;
  onClear: () => void;
}

/**
 * Horizontal strip of recently-viewed resources. Shown above the resource
 * grid when the user has viewed at least one resource. localStorage-backed
 * (see use-recently-viewed.ts). Hidden on the very first visit.
 */
export function RecentlyViewed({ recent, onOpen, onClear }: RecentlyViewedProps) {
  if (recent.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mb-6 overflow-hidden"
    >
      <div className="rounded-2xl border border-border/50 bg-card/30 p-4 backdrop-blur-sm">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Clock className="size-3.5 text-primary" aria-hidden />
            Recently viewed
            <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {recent.length}
            </span>
          </h3>
          <button
            type="button"
            onClick={onClear}
            className="inline-flex items-center gap-1 text-[11px] text-muted-foreground/70 transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline"
          >
            <X className="size-3" aria-hidden />
            Clear
          </button>
        </div>
        <div className="bndr-pill-scroll flex gap-2 overflow-x-auto pb-1">
          {recent.map((r) => {
            const phone = r.phoneNormalized
              ? r.phoneNormalized.split("|")[0].trim()
              : null;
            const phoneDisplay = formatPhoneDisplay(phone);
            const catName = CATEGORY_NAME[r.category] ?? r.category;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onOpen(r)}
                className="group flex min-w-[240px] max-w-[280px] flex-shrink-0 flex-col gap-1.5 rounded-xl border border-border/50 bg-background/50 p-3 text-left transition-all hover:border-primary/40 hover:bg-card/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <div className="flex items-center gap-1.5">
                  <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">
                    {catName}
                  </span>
                  {phoneDisplay ? (
                    <span className="ml-auto font-mono text-[11px] text-primary">
                      {phoneDisplay}
                    </span>
                  ) : null}
                </div>
                <p className="truncate text-sm font-medium text-foreground group-hover:text-primary">
                  {r.name}
                </p>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/60">
                  <span>View details</span>
                  <ArrowRight className="size-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
}
