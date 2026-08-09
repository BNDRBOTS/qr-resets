"use client";

// BNDR. — Trending Searches
// ----------------------------------------------------------------------------
// A compact row of trending/popular search chips that appears below the hero
// search bar. Helps users discover content and provides quick entry points.
// Each chip immediately searches for that term.

import { motion } from "framer-motion";
import { TrendingUp } from "lucide-react";

interface TrendingSearchesProps {
  onSearch: (term: string) => void;
}

const TRENDING = [
  "domestic violence",
  "legal aid",
  "housing",
  "child custody",
  "crime victim compensation",
  "trauma recovery",
  "hotline",
  "shelter",
];

export function TrendingSearches({ onSearch }: TrendingSearchesProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.9 }}
      className="mt-4 flex flex-wrap items-center justify-center gap-2"
    >
      <span className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <TrendingUp className="size-3" aria-hidden />
        Trending
      </span>
      {TRENDING.map((term, i) => (
        <motion.button
          key={term}
          type="button"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 1 + i * 0.05 }}
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSearch(term)}
          className="rounded-full border border-border/50 bg-card/30 px-3 py-1 text-xs text-muted-foreground transition-all hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
        >
          {term}
        </motion.button>
      ))}
    </motion.div>
  );
}
