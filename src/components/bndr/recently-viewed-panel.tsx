"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  X,
  Phone,
  Mail,
  Globe,
  ArrowRight,
  Trash2,
} from "lucide-react";
import {
  CATEGORIES,
  type Resource,
  type CategorySlug,
} from "@/lib/types";
import { formatPhoneDisplay } from "@/lib/pii";

const CATEGORY_NAME: Record<CategorySlug, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.shortName]),
) as Record<CategorySlug, string>;

interface RecentlyViewedPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recent: Resource[];
  onOpen: (r: Resource) => void;
  onClear: () => void;
}

/**
 * Right-side Sheet listing the user's full recently-viewed history (max 6).
 * More spacious than the inline strip — shows full contact info per item.
 * Designed for users who want to revisit something they browsed earlier.
 */
export function RecentlyViewedPanel({
  open,
  onOpenChange,
  recent,
  onOpen,
  onClear,
}: RecentlyViewedPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l border-border/60 bg-background/95 p-0 sm:max-w-md"
      >
        <SheetHeader className="border-b border-border/60 px-6 pb-4 pt-6">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Clock className="size-4" aria-hidden />
            </span>
            Recently Viewed
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
              {recent.length}
            </span>
          </SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Resources you&apos;ve opened in this session. Stored locally in
            your browser (max 6). Click any item to reopen its full details.
          </SheetDescription>
        </SheetHeader>

        {/* Toolbar */}
        {recent.length > 0 ? (
          <div className="flex items-center justify-end gap-2 border-b border-border/40 px-6 py-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="gap-1.5 text-muted-foreground hover:text-destructive"
            >
              <Trash2 className="size-3.5" aria-hidden />
              Clear history
            </Button>
          </div>
        ) : null}

        {/* List */}
        <div className="bndr-pill-scroll flex-1 overflow-y-auto px-6 py-4">
          {recent.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted/40">
                <Clock className="size-6 text-muted-foreground/60" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  No recently viewed resources
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Open any resource to see it appear here. Your last 6 viewed
                  resources are tracked for quick access.
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {recent.map((r, index) => {
                  const phone = r.phoneNormalized
                    ? r.phoneNormalized.split("|")[0].trim()
                    : null;
                  const phoneDisplay = formatPhoneDisplay(phone);
                  const catName = CATEGORY_NAME[r.category] ?? r.category;
                  return (
                    <motion.li
                      key={r.id}
                      layout
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ duration: 0.2 }}
                      className="group rounded-xl border border-border/50 bg-card/40 p-3 transition-colors hover:border-primary/30"
                    >
                      <div className="flex items-start gap-2">
                        {/* Index number for ordering */}
                        <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-muted/60 text-[10px] font-medium text-muted-foreground tabular-nums">
                          {index + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="border-border/60 text-[10px] text-muted-foreground"
                            >
                              {catName}
                            </Badge>
                            {r.acronym ? (
                              <Badge
                                variant="secondary"
                                className="bg-secondary/70 font-mono text-[9px] uppercase"
                              >
                                {r.acronym}
                              </Badge>
                            ) : null}
                            {r.priority >= 1 ? (
                              <Badge className="border border-primary/30 bg-primary/15 px-1.5 py-0 text-[9px] text-primary">
                                Priority
                              </Badge>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onOpen(r);
                              onOpenChange(false);
                            }}
                            className="mt-1.5 block w-full text-left text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline"
                          >
                            {r.name}
                          </button>
                          {r.description ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                              {r.description}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                            {phoneDisplay ? (
                              <a
                                href={`tel:${phone}`}
                                className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
                              >
                                <Phone className="size-3" aria-hidden />
                                <span className="font-mono tabular-nums">
                                  {phoneDisplay}
                                </span>
                              </a>
                            ) : null}
                            {r.email ? (
                              <a
                                href={`mailto:${r.email}`}
                                className="inline-flex items-center gap-1 truncate text-muted-foreground transition-colors hover:text-primary"
                              >
                                <Mail className="size-3" aria-hidden />
                                <span className="truncate">{r.email}</span>
                              </a>
                            ) : null}
                            {r.website ? (
                              <a
                                href={r.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 truncate text-muted-foreground transition-colors hover:text-primary"
                              >
                                <Globe className="size-3" aria-hidden />
                                <span className="truncate">
                                  {r.website
                                    .replace(/^https?:\/\//, "")
                                    .replace(/\/$/, "")}
                                </span>
                              </a>
                            ) : null}
                          </div>
                        </div>
                        <ArrowRight
                          className="mt-1 size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary"
                          aria-hidden
                        />
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {recent.length > 0 ? (
          <div className="border-t border-border/40 px-6 py-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground/70">
              {recent.length} recently viewed · localStorage only (not sent to
              any server).
            </p>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
