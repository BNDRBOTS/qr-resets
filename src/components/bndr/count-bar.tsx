"use client";

// BNDR. — Resource count summary bar
// ----------------------------------------------------------------------------
// A compact bar that appears above the resource grid showing the current
// filtered count vs the total. Includes a progress indicator and quick
// filter-clear action when filters are active.

import { motion } from "framer-motion";
import { X, Filter } from "lucide-react";

interface CountBarProps {
  filtered: number;
  total: number;
  hasFilters: boolean;
  onClearFilters?: () => void;
}

export function CountBar({
  filtered,
  total,
  hasFilters,
  onClearFilters,
}: CountBarProps) {
  const pct = total > 0 ? Math.round((filtered / total) * 100) : 0;
  const isFiltered = filtered !== total;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border/40 bg-card/30 px-4 py-2.5"
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold tabular-nums text-foreground">
          {filtered.toLocaleString()}
        </span>
        <span className="text-xs text-muted-foreground">
          of {total.toLocaleString()} {total === 1 ? "resource" : "resources"}
        </span>
      </div>

      {/* Progress bar */}
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-muted/60 min-w-[80px]">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`h-full rounded-full ${isFiltered ? "bg-primary" : "bg-emerald-500"}`}
        />
      </div>

      {/* Percentage */}
      <span className="text-[11px] font-medium tabular-nums text-muted-foreground">
        {pct}%
      </span>

      {/* Clear filters button */}
      {hasFilters && isFiltered && onClearFilters ? (
        <button
          type="button"
          onClick={onClearFilters}
          className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          <X className="size-3" aria-hidden />
          Clear filters
        </button>
      ) : null}

      {/* Active filter indicator */}
      {hasFilters ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-primary">
          <Filter className="size-3" aria-hidden />
          Filtered
        </span>
      ) : null}
    </motion.div>
  );
}
