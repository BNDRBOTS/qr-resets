"use client";

// BNDR. — Featured Resource Spotlight
// ----------------------------------------------------------------------------
// A daily-rotating featured resource that appears between the hero and the
// stats strip. Picks one resource from the priority pool (priority >= 1)
// based on the current date, so every visitor sees the same featured resource
// on a given day. Clicking the card opens the resource detail dialog.

import { useMemo } from "react";
import { Sparkles, ArrowRight, Phone, Globe, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import type { Resource, CategorySlug } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { formatPhoneDisplay } from "@/lib/pii";

interface FeaturedSpotlightProps {
  resources: Resource[];
  onOpen: (r: Resource) => void;
}

/**
 * Deterministically pick a resource for "today" from the priority pool.
 * Uses the current date (YYYY-MM-DD) as a seed so all visitors on the same
 * day see the same featured resource.
 */
function pickDailyResource(pool: Resource[]): Resource | null {
  if (pool.length === 0) return null;
  const now = new Date();
  const dateStr = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`;
  // Simple hash from date string → index
  let hash = 0;
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) | 0;
  }
  const idx = Math.abs(hash) % pool.length;
  return pool[idx];
}

function categoryName(slug: CategorySlug): string {
  return CATEGORIES.find((c) => c.slug === slug)?.shortName ?? slug;
}

export function FeaturedSpotlight({ resources, onOpen }: FeaturedSpotlightProps) {
  // Pick from priority resources, falling back to all if none have priority.
  const featured = useMemo(() => {
    const priorityPool = resources.filter((r) => r.priority >= 1);
    const pool = priorityPool.length > 0 ? priorityPool : resources;
    return pickDailyResource(pool);
  }, [resources]);

  if (!featured) return null;

  const r = featured;
  const phones = r.phoneNormalized
    ? r.phoneNormalized.split("|").filter(Boolean).map(formatPhoneDisplay)
    : [];
  const catName = categoryName(r.category);
  const description =
    r.description && r.description.length > 220
      ? r.description.slice(0, 217) + "…"
      : r.description;

  return (
    <section
      aria-label="Featured resource of the day"
      className="relative py-6 md:py-8"
    >
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <motion.button
          type="button"
          onClick={() => onOpen(r)}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          whileHover={{ y: -2 }}
          className="group relative w-full overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card/60 to-card/40 p-5 text-left shadow-lg transition-all hover:border-primary/40 hover:shadow-primary/10 sm:p-6"
        >
          {/* Left accent border — cool-blue gradient strip for visual weight */}
          <div
            className="pointer-events-none absolute left-0 top-0 h-full w-1.5 bg-gradient-to-b from-primary/60 via-primary/40 to-primary/20"
            aria-hidden
          />
          {/* Decorative gradient blob */}
          <div
            className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary/8 blur-3xl transition-opacity group-hover:bg-primary/12"
            aria-hidden
          />

          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center">
            {/* Left: badge + label */}
            <div className="flex shrink-0 flex-col items-start gap-2 sm:w-40">
              <span className="bndr-featured-pulse inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-3 py-1 text-xs font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" aria-hidden />
                Featured Today
              </span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                Resource spotlight
              </span>
            </div>

            {/* Middle: content */}
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                  {r.name}
                </h3>
                {r.acronym ? (
                  <span className="rounded bg-muted/60 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                    {r.acronym}
                  </span>
                ) : null}
              </div>
              <div className="mb-2 text-xs font-medium uppercase tracking-wide text-primary/70">
                {catName}
              </div>
              {description ? (
                <p className="mb-3 text-sm leading-relaxed text-foreground/75">
                  {description}
                </p>
              ) : null}

              {/* Contact icons row */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                {phones.length > 0 ? (
                  <span className="inline-flex items-center gap-1">
                    <Phone className="h-3 w-3" aria-hidden />
                    {phones[0]}
                    {phones.length > 1 ? ` +${phones.length - 1}` : ""}
                  </span>
                ) : null}
                {r.website ? (
                  <span className="inline-flex items-center gap-1">
                    <Globe className="h-3 w-3" aria-hidden />
                    Website available
                  </span>
                ) : null}
                {r.address ? (
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" aria-hidden />
                    Has address
                  </span>
                ) : null}
              </div>
            </div>

            {/* Right: call to action */}
            <div className="flex shrink-0 items-center">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 bg-background/50 px-3 py-2 text-sm font-medium text-foreground transition-colors group-hover:border-primary/30 group-hover:bg-primary/5 group-hover:text-primary">
                View details
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </div>
          </div>
        </motion.button>
      </div>
    </section>
  );
}
