"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, Filter, Sparkles, Link2, Check } from "lucide-react";
import { toast } from "sonner";
import { CATEGORIES, type CategorySlug } from "@/lib/types";

const CATEGORY_NAME: Record<CategorySlug, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.shortName]),
) as Record<CategorySlug, string>;

interface ActiveFiltersProps {
  query: string;
  category: CategorySlug | "all";
  priorityOnly: boolean;
  onClearQuery: () => void;
  onClearCategory: () => void;
  onClearPriority: () => void;
  onClearAll: () => void;
}

/**
 * Active-filter chips row. Shows removable chips for the active query,
 * category, and priority-only filter. Includes a "Share search" button that
 * copies the deep-link URL to clipboard. Only renders when at least one
 * filter is active. Includes a "Clear all" button.
 */
export function ActiveFilters({
  query,
  category,
  priorityOnly,
  onClearQuery,
  onClearCategory,
  onClearPriority,
  onClearAll,
}: ActiveFiltersProps) {
  const [copied, setCopied] = useState(false);
  const hasQuery = query.trim().length > 0;
  const hasCategory = category !== "all";
  const hasPriority = priorityOnly;
  const anyActive = hasQuery || hasCategory || hasPriority;

  if (!anyActive) return null;

  const handleShareSearch = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Search URL copied to clipboard", {
        description: "Share it to open this exact filtered view.",
        duration: 3000,
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy URL to clipboard");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-4 flex flex-wrap items-center gap-2"
    >
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
        <Filter className="size-3" aria-hidden />
        Filters
      </span>
      <AnimatePresence>
        {hasQuery ? (
          <Chip key="query" onRemove={onClearQuery} icon={<Search className="size-3" />} accent>
            &ldquo;{query}&rdquo;
          </Chip>
        ) : null}
        {hasCategory ? (
          <Chip key="category" onRemove={onClearCategory}>
            {CATEGORY_NAME[category]}
          </Chip>
        ) : null}
        {hasPriority ? (
          <Chip key="priority" onRemove={onClearPriority} icon={<Sparkles className="size-3" />} accent>
            Priority only
          </Chip>
        ) : null}
      </AnimatePresence>
      <button
        type="button"
        onClick={handleShareSearch}
        className="ml-1 inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        {copied ? (
          <Check className="size-3 text-primary" aria-hidden />
        ) : (
          <Link2 className="size-3" aria-hidden />
        )}
        {copied ? "Copied" : "Share search"}
      </button>
      <button
        type="button"
        onClick={onClearAll}
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <X className="size-3" aria-hidden />
        Clear all
      </button>
    </motion.div>
  );
}

function Chip({
  children,
  onRemove,
  icon,
  accent,
}: {
  children: React.ReactNode;
  onRemove: () => void;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <motion.span
      layout
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium " +
        (accent
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border/60 bg-card/40 text-foreground")
      }
    >
      {icon}
      <span className="max-w-[180px] truncate">{children}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove filter"
        className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-foreground/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        <X className="size-3" aria-hidden />
      </button>
    </motion.span>
  );
}
