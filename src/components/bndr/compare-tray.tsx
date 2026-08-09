"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftRight, X, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Resource } from "@/lib/types";

interface CompareTrayProps {
  items: Resource[];
  max: number;
  onOpen: () => void;
  onRemove: (r: Resource) => void;
  onClear: () => void;
}

/**
 * Floating bottom-center tray that appears when at least 1 resource is
 * selected for comparison. Shows count + "Compare now" button (enabled when
 * ≥2 selected). Hidden on mobile (the compare icon on cards still works;
 * mobile users see the tray collapsed to a small FAB-style button).
 */
export function CompareTray({ items, max, onOpen, onRemove, onClear }: CompareTrayProps) {
  if (items.length === 0) return null;
  const canCompare = items.length >= 2;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 print:hidden"
      >
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/85 px-4 py-3 shadow-[var(--shadow-surface-hover)] backdrop-blur-xl">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ArrowLeftRight className="size-4" aria-hidden />
            </span>
            <div className="hidden sm:block">
              <p className="text-xs font-medium text-foreground">
                Compare tray
              </p>
              <p className="text-[10px] text-muted-foreground">
                {items.length} of {max} selected
              </p>
            </div>
          </div>

          {/* Selected resource chips (desktop only) */}
          <div className="hidden max-w-md items-center gap-1.5 lg:flex">
            {items.map((r) => (
              <span
                key={r.id}
                className="inline-flex max-w-[160px] items-center gap-1 rounded-full border border-border/60 bg-muted/40 py-0.5 pl-2 pr-1 text-[11px]"
              >
                <span className="truncate text-foreground">{r.name}</span>
                <button
                  type="button"
                  onClick={() => onRemove(r)}
                  aria-label={`Remove ${r.name} from comparison`}
                  className="shrink-0 rounded-full p-0.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-3" aria-hidden />
                </button>
              </span>
            ))}
          </div>

          {/* Mobile count badge */}
          <Badge className="bg-primary/20 text-primary lg:hidden">
            {items.length}/{max}
          </Badge>

          <div className="ml-1 flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={onOpen}
              disabled={!canCompare}
              className={
                canCompare
                  ? "gap-1.5 shadow-[var(--shadow-accent-strong)]"
                  : "gap-1.5 opacity-60"
              }
            >
              <ArrowLeftRight className="size-3.5" aria-hidden />
              Compare
              {!canCompare ? (
                <span className="text-[10px] opacity-70">need {2 - items.length} more</span>
              ) : null}
            </Button>
            <button
              type="button"
              onClick={onClear}
              aria-label="Clear comparison tray"
              className="rounded-full p-1.5 text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <X className="size-4" aria-hidden />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
