"use client";

import { motion } from "framer-motion";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CategorySlug } from "@/lib/types";
import { SearchAutocomplete } from "./search-autocomplete";
import { BndrLogoHero } from "./bndr-logo";
import { AnimatedCounter } from "./animated-counter";
import { TrendingSearches } from "./trending-searches";
import { useSiteCopy } from "@/lib/use-site-copy";

interface HeroProps {
  query: string;
  onQueryChange: (q: string) => void;
  total: number;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  onSelectCategory?: (slug: CategorySlug) => void;
  onSelectName?: (id: string) => void;
  recentSearches?: string[];
  onClearSearches?: () => void;
  onBrowseAll?: () => void;
  onPopularSearch?: (term: string) => void;
}

export function Hero({
  query,
  onQueryChange,
  total,
  searchInputRef,
  onSelectCategory,
  onSelectName,
  recentSearches,
  onClearSearches,
  onBrowseAll,
  onPopularSearch,
}: HeroProps) {
  const copy = useSiteCopy();

  return (
    <section
      id="top"
      className="relative flex min-h-[88vh] min-h-[calc(100svh-4rem)] flex-col items-center justify-center overflow-hidden px-4 py-14 text-center sm:px-6 sm:py-18 lg:px-8 lg:py-20"
    >
      <div
        aria-hidden="true"
        className="bndr-hero-halo pointer-events-none absolute left-1/2 top-1/2 -z-0 h-[70vmin] w-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
      />

      <motion.div
        initial={{ opacity: 0, scale: 0.96, filter: "blur(8px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
        className="relative"
      >
        <BndrLogoHero />
      </motion.div>

      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.45 }}
        className="bndr-product-name relative mt-5"
      >
        ResourceCite
      </motion.p>

      <motion.p
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.6 }}
        className="relative mt-3 max-w-2xl text-balance text-base leading-relaxed text-foreground sm:text-lg"
      >
        {copy.heroIntro}
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.8 }}
        className="relative mt-9 w-full max-w-2xl"
      >
        <SearchAutocomplete
          query={query}
          onQueryChange={onQueryChange}
          onSelectCategory={(slug) => onSelectCategory?.(slug)}
          onSelectName={(id) => onSelectName?.(id)}
          searchInputRef={searchInputRef}
          recentSearches={recentSearches}
          onClearSearches={onClearSearches}
        />

        <div className="mt-5 flex flex-col items-center justify-center gap-2">
          <span className="text-xs font-medium text-foreground/80">
            <AnimatedCounter value={total} /> resources indexed
          </span>
          {onBrowseAll ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onBrowseAll}
              className="gap-1.5 rounded-full border-primary/35 bg-card/50 px-5 font-semibold hover:border-primary/60 hover:text-primary"
            >
              Browse all {total.toLocaleString()}
              <ArrowDown className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>

        <TrendingSearches onSearch={(term) => (onPopularSearch ?? onQueryChange)(term)} />
      </motion.div>
    </section>
  );
}
