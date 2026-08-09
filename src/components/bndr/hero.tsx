"use client";

import { motion } from "framer-motion";
import { Sparkles, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRIORITY_LABEL, type CategorySlug } from "@/lib/types";
import { SearchAutocomplete } from "./search-autocomplete";
import { BndrLogoHero } from "./bndr-logo";
import { AnimatedCounter } from "./animated-counter";
import { TrendingSearches } from "./trending-searches";

interface HeroProps {
  query: string;
  onQueryChange: (q: string) => void;
  priorityOnly: boolean;
  onTogglePriority: () => void;
  total: number;
  priorityCount: number;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onSelectCategory?: (slug: CategorySlug) => void;
  onSelectName?: (id: string) => void;
  recentSearches?: string[];
  onClearSearches?: () => void;
  onBrowseAll?: () => void;
}

/**
 * Full-viewport hero. The signature glowing "BNDR." wordmark sits centered
 * over a warm circular radial halo. Below: tagline, search input with autocomplete,
 * priority pill.
 */
export function Hero({
  query,
  onQueryChange,
  priorityOnly,
  onTogglePriority,
  total,
  priorityCount,
  searchInputRef,
  onSelectCategory,
  onSelectName,
  recentSearches,
  onClearSearches,
  onBrowseAll,
}: HeroProps) {
  return (
    <section
      id="top"
      className="relative flex min-h-[88vh] flex-col items-center justify-center overflow-hidden px-4 py-20 text-center sm:px-6 lg:px-8"
    >
      {/* Warm circular radial halo behind the logo — theme-aware via .bndr-hero-halo */}
      <div
        aria-hidden="true"
        className="bndr-hero-halo pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
      />

      {/* Real PNG logo (with Inter-italic wordmark fallback) */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        className="relative"
      >
        <BndrLogoHero />
      </motion.div>

      {/* Tagline */}
      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.6 }}
        className="relative mt-6 max-w-2xl text-balance text-base sm:text-lg"
      >
        <span className="bg-gradient-to-r from-foreground via-foreground/90 to-primary/80 bg-clip-text text-transparent">
          A source-backed directory of victim, advocacy &amp; family-court
          resources.
        </span>
      </motion.p>

      {/* Search with autocomplete */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.8 }}
        className="relative mt-10 w-full max-w-2xl"
      >
        <SearchAutocomplete
          query={query}
          onQueryChange={onQueryChange}
          onSelectCategory={(slug) => onSelectCategory?.(slug)}
          onSelectTag={(tag) => onQueryChange(tag)}
          onSelectName={(id) => onSelectName?.(id)}
          searchInputRef={searchInputRef}
          recentSearches={recentSearches}
          onClearSearches={onClearSearches}
        />

        {/* Priority hint pill + browse-all */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant={priorityOnly ? "default" : "outline"}
            size="sm"
            onClick={onTogglePriority}
            className={
              priorityOnly
                ? "rounded-full shadow-[0_0_18px_-4px_oklch(0.70_0.26_255/0.7)]"
                : "rounded-full border-border hover:border-primary/40 hover:text-primary"
            }
            aria-pressed={priorityOnly}
          >
            <Sparkles className="size-4" aria-hidden />
            {PRIORITY_LABEL}
            <span className="ml-1 rounded-full bg-primary/20 px-2 py-0.5 text-xs">
              {priorityCount}
            </span>
          </Button>
          {onBrowseAll ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onBrowseAll}
              className="gap-1.5 rounded-full text-muted-foreground hover:text-primary hover:bg-transparent"
            >
              <ArrowDown className="size-4" aria-hidden />
              Browse all {total.toLocaleString()}
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground">
            <AnimatedCounter value={total} /> resources indexed
          </span>
        </div>

        {/* Trending searches */}
        <TrendingSearches onSearch={(term) => onQueryChange(term)} />
      </motion.div>
    </section>
  );
}
