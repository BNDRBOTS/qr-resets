"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { LifeBuoy, Phone, Globe } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";

interface HotlineEntry {
  id: string;
  name: string;
  acronym: string | null;
  description: string | null;
  phoneRaw: string | null;
  phoneDisplay: string | null;
  phoneTel: string | null;
  website: string | null;
  category: string;
  source: "db";
}

/**
 * Floating Crisis Help button. Every listed hotline is loaded from published
 * Resource rows; the client contains no embedded hotline records.
 */
export function CrisisHelpButton() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // "Mounted" flag defers rendering of the AnimatePresence exit animation
  // until after hydration to avoid SSR/client mismatch. This is the canonical
  // Next.js client-only render pattern.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  const { data, isLoading } = useQuery<{ hotlines: HotlineEntry[]; total: number }>({
    queryKey: ["hotlines"],
    queryFn: async () => {
      const res = await fetch("/api/hotlines", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load hotlines");
      return res.json();
    },
    enabled: open, // only fetch when opened
  });

  const hotlines = data?.hotlines ?? [];

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {mounted && !open && (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.6, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.6, y: 20 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.96 }}
            aria-label="Open crisis help — 24/7 hotlines"
            className="group fixed bottom-4 right-4 z-40 flex items-center gap-2.5 rounded-full border border-primary/40 bg-card/80 px-4 py-3 text-sm font-medium text-foreground shadow-[var(--shadow-accent-strong)] backdrop-blur-xl transition-colors hover:border-primary/70 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:bottom-6 sm:right-6 sm:px-5 sm:py-3.5 print:hidden"
          >
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
            </span>
            <LifeBuoy className="size-4" aria-hidden />
            <span className="hidden sm:inline">Crisis help</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Sheet */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full gap-0 border-l border-border/60 bg-background/95 p-0 sm:max-w-md"
        >
          <SheetHeader className="border-b border-border/60 px-6 pb-4 pt-6">
            <SheetTitle className="flex items-center gap-2 text-foreground">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                <LifeBuoy className="size-4" aria-hidden />
              </span>
              24/7 Crisis Help
            </SheetTitle>
            <SheetDescription className="text-muted-foreground">
              Immediate-access hotlines. If you are in danger right now, call
              <span className="font-semibold text-primary"> 911</span>.
            </SheetDescription>
          </SheetHeader>

          <div className="bndr-pill-scroll max-h-[calc(100vh-180px)] overflow-y-auto px-6 py-5">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-24 animate-pulse rounded-xl bg-card/40"
                  />
                ))}
              </div>
            ) : (
              <>
                {hotlines.length > 0 ? (
                  <div>
                    <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Directory hotlines (published + verified)
                    </p>
                    <div className="space-y-2">
                      {hotlines.map((hotline) => (
                        <HotlineCard key={hotline.id} h={hotline} />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="rounded-xl border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
                    No published hotline resources are currently available.
                  </p>
                )}

                <p className="mt-6 border-t border-border/40 pt-4 text-[11px] leading-relaxed text-muted-foreground/70">
                  Telephone numbers come from the packaged resource dataset. Always
                  verify a number is in service before relying on it.
                </p>
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function HotlineCard({ h }: { h: HotlineEntry }) {
  return (
    <div
      className="rounded-xl border border-border/60 bg-card/40 p-4 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">{h.name}</h4>
            {h.acronym ? (
              <Badge
                variant="secondary"
                className="bg-secondary/70 font-mono text-[10px] uppercase"
              >
                {h.acronym}
              </Badge>
            ) : null}
          </div>
          {h.description ? (
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              {h.description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {h.phoneTel ? (
          <a
            href={`tel:${h.phoneTel}`}
            className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary transition-all hover:bg-primary/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Phone className="size-4" aria-hidden />
            <span className="font-mono tabular-nums">{h.phoneDisplay}</span>
          </a>
        ) : null}
        {h.website ? (
          <a
            href={h.website}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <Globe className="size-3.5" aria-hidden />
            Website
          </a>
        ) : null}
      </div>
    </div>
  );
}
