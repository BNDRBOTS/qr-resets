"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Tag, Loader2 } from "lucide-react";

interface TagCloudProps {
  onTagClick?: (tag: string) => void;
}

interface TagEntry {
  tag: string;
  count: number;
}

/**
 * Visual tag cloud for the About modal. Fetches all tags with counts from
 * /api/tags and renders them as a wrapping cloud of pills, sized by count.
 * Click a tag → triggers onTagClick (which filters the grid).
 */
export function TagCloud({ onTagClick }: TagCloudProps) {
  const { data, isLoading } = useQuery<{ tags: TagEntry[]; total: number }>({
    queryKey: ["tags"],
    queryFn: async () => {
      const res = await fetch("/api/tags", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load tags");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading tag cloud…
      </div>
    );
  }

  const tags = data?.tags ?? [];
  if (tags.length === 0) {
    return (
      <p className="py-4 text-sm text-muted-foreground">No tags found.</p>
    );
  }

  const maxCount = tags[0]?.count ?? 1;

  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
        Browse all {tags.length} tags used across the directory. Click any tag
        to filter the resource grid. Larger tags appear on more resources.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t, i) => {
          // Scale font size by count: 11px (min) → 20px (max)
          const scale = t.count / maxCount;
          const fontSize = 11 + Math.round(scale * 9);
          // Opacity also scales for visual weight
          const opacity = 0.6 + scale * 0.4;
          return (
            <motion.button
              key={t.tag}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity, scale: 1 }}
              transition={{ duration: 0.2, delay: Math.min(i * 0.01, 0.5) }}
              type="button"
              onClick={() => onTagClick?.(t.tag)}
              className="rounded-full border border-border/60 bg-card/40 px-3 py-1 text-foreground transition-all hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              style={{ fontSize: `${fontSize}px` }}
              title={`${t.tag} — ${t.count} ${t.count === 1 ? "resource" : "resources"}`}
            >
              {t.tag}
              <span className="ml-1 text-[10px] text-muted-foreground/70 tabular-nums">
                {t.count}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
