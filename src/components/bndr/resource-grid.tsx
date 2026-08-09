"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { SearchX, RotateCcw, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ResourceCard } from "./resource-card";
import type { Resource } from "@/lib/types";
import type { ContactMethod } from "./use-contact-log";

interface ResourceGridProps {
  resources: Resource[];
  query?: string;
  loading?: boolean;
  totalCount: number;
  directoryTotal: number;
  pageSize?: number;
  onReset: () => void;
  onOpen: (r: Resource) => void;
  isSaved?: (id: string) => boolean;
  onToggleSave?: (r: Resource) => void;
  isComparing?: (id: string) => boolean;
  onToggleCompare?: (r: Resource) => void;
  hasNote?: (id: string) => boolean;
  getRating?: (id: string) => number;
  onTagClick?: (tag: string) => void;
  /** Returns true if the resource is saved + needs follow-up (never / >7d). */
  isFollowUpNeeded?: (id: string) => boolean;
  /** Returns the contact-log entry count for a resource (0 if none). */
  getContactLogCount?: (id: string) => number;
  /** Returns the saved default contact method for a resource (undefined if none). */
  getDefaultContactMethod?: (id: string) => ContactMethod | undefined;
  /** Called when a suggestion chip is clicked. */
  onSuggestionClick?: (term: string) => void;
}

function CardSkeleton({ index = 0 }: { index?: number }) {
  return (
    <div
      className="bndr-card bndr-shimmer flex flex-col gap-3 rounded-2xl p-5"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Badge row */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      {/* Title */}
      <Skeleton className="h-6 w-3/4" />
      {/* Contact badges placeholder */}
      <div className="flex gap-1.5">
        <Skeleton className="h-4 w-12 rounded-md" />
        <Skeleton className="h-4 w-10 rounded-md" />
        <Skeleton className="h-4 w-8 rounded-md" />
      </div>
      {/* Description lines */}
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      {/* Contact row */}
      <div className="mt-auto space-y-2 border-t border-border/30 pt-3">
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-3 w-3 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

const SUGGESTIONS = [
  "domestic violence",
  "legal aid",
  "housing",
  "child custody",
  "crime victim",
  "trauma",
  "hotline",
  "shelter",
];

export function ResourceGrid({
  resources,
  query,
  loading,
  totalCount,
  directoryTotal,
  pageSize = 24,
  onReset,
  onOpen,
  isSaved,
  onToggleSave,
  isComparing,
  onToggleCompare,
  hasNote,
  getRating,
  onTagClick,
  isFollowUpNeeded,
  getContactLogCount,
  getDefaultContactMethod,
  onSuggestionClick,
}: ResourceGridProps) {
  // visibleCount is internal state. Parent remounts this component by
  // changing its `key` prop when filters change, which resets this state.
  const [visibleCount, setVisibleCount] = useState(pageSize);
  const shown = resources.slice(0, visibleCount);
  const hasMore = resources.length > visibleCount;

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 9 }).map((_, i) => (
          <CardSkeleton key={i} index={i} />
        ))}
      </div>
    );
  }
  if (resources.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex flex-col items-center justify-center gap-6 overflow-hidden rounded-2xl border border-dashed border-border/80 bg-card/20 px-6 py-20 text-center"
      >
        {/* Decorative gradient blob */}
        <div
          className="pointer-events-none absolute -top-20 left-1/2 h-48 w-96 -translate-x-1/2 rounded-full bg-primary/5 blur-3xl"
          aria-hidden
        />
        {/* Animated icon with pulsing ring */}
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/10" aria-hidden />
          <div className="relative flex size-20 items-center justify-center rounded-full bg-primary/15">
            <SearchX className="size-10 text-primary" aria-hidden />
          </div>
        </div>
        <div className="relative">
          <p className="text-xl font-semibold text-foreground">
            No resources match{" "}
            <span className="text-primary">&quot;{query}&quot;</span>
          </p>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Try a different search term, a category name, an acronym, or a
            location. You can also browse all {directoryTotal} {directoryTotal === 1 ? "resource" : "resources"} or explore by
            category above.
          </p>
        </div>
        {onSuggestionClick ? (
          <div className="relative flex flex-col items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Popular searches
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onSuggestionClick(s)}
                  className="bndr-suggestion-chip rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="relative flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={onReset}>
            <RotateCcw className="size-4" aria-hidden /> Clear search
          </Button>
        </div>
      </motion.div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 lg:auto-rows-fr">
        {shown.map((r, i) => (
          <ResourceCard
            key={r.id}
            resource={r}
            query={query}
            index={i}
            onOpen={onOpen}
            isSaved={isSaved?.(r.id)}
            onToggleSave={onToggleSave}
            isComparing={isComparing?.(r.id)}
            onToggleCompare={onToggleCompare}
            hasNote={hasNote?.(r.id)}
            rating={getRating?.(r.id) ?? 0}
            onTagClick={onTagClick}
            followUpNeeded={isFollowUpNeeded?.(r.id) ?? false}
            contactLogCount={getContactLogCount?.(r.id) ?? 0}
            defaultContactMethod={getDefaultContactMethod?.(r.id)}
          />
        ))}
      </div>

      {/* Result count + Load more */}
      <div className="flex flex-col items-center gap-3 pt-4">
        <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
          Showing {shown.length} of {totalCount}{" "}
          {totalCount === 1 ? "match" : "matches"}
        </p>
        {hasMore ? (
          <RevealMoreButton
            onClick={() => setVisibleCount((c) => c + pageSize)}
            remaining={totalCount - shown.length}
          />
        ) : (
          <p className="text-xs text-muted-foreground/60">
            All {totalCount} {totalCount === 1 ? "match" : "matches"} shown
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * "Reveal more" button with loading spinner and remaining count.
 * Shows a brief loading state when clicked to give visual feedback.
 */
function RevealMoreButton({
  onClick,
  remaining,
}: {
  onClick: () => void;
  remaining: number;
}) {
  const [loading, setLoading] = useState(false);

  const handleClick = () => {
    setLoading(true);
    // Simulate a brief loading delay for visual feedback, then reveal.
    setTimeout(() => {
      onClick();
      setLoading(false);
    }, 300);
  };

  return (
    <Button
      variant="outline"
      size="lg"
      onClick={handleClick}
      disabled={loading}
      className="group rounded-full border-border hover:border-primary/50 hover:text-primary"
    >
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          Loading…
        </>
      ) : (
        <>
          Reveal {remaining > 0 ? `${remaining} more` : "more"}
          <ChevronDown className="ml-2 h-4 w-4 transition-transform group-hover:translate-y-0.5" aria-hidden />
        </>
      )}
    </Button>
  );
}
