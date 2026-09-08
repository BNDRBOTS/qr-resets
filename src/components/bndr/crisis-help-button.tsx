"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { LifeBuoy, Phone, Globe, X } from "lucide-react";
import {
  Sheet,
  SheetClose,
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

export function CrisisHelpButton() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 });

  useEffect(() => setMounted(true), []);

  const { data, isLoading } = useQuery<{ hotlines: HotlineEntry[]; total: number }>({
    queryKey: ["hotlines"],
    queryFn: async () => {
      const res = await fetch("/api/hotlines", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load hotlines");
      return res.json();
    },
    enabled: open,
  });

  const hotlines = data?.hotlines ?? [];

  return (
    <>
      <AnimatePresence>
        {mounted && !open ? (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            initial={{ opacity: 0, scale: 0.75, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.75, y: 14 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.96 }}
            aria-label="Open Crisis Navigator"
            title="Crisis Navigator"
            className="bndr-crisis-button fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))] z-40 flex size-14 items-center justify-center rounded-full border border-primary/55 bg-card/95 text-primary shadow-[0_8px_24px_rgba(0,0,0,0.22),0_0_18px_var(--glow-primary-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 sm:bottom-6 sm:right-6 sm:size-15 print:hidden"
          >
            <svg className="pointer-events-none absolute inset-[5px] size-[calc(100%-10px)] -rotate-90" viewBox="0 0 48 48" aria-hidden>
              <circle cx="24" cy="24" r="21" fill="none" strokeWidth="2" className="stroke-primary/15" />
              <motion.circle
                cx="24"
                cy="24"
                r="21"
                fill="none"
                strokeWidth="2.4"
                strokeLinecap="round"
                className="stroke-primary"
                style={{ pathLength: progress }}
              />
            </svg>
            <span className="relative flex size-8 items-center justify-center rounded-full bg-primary/12">
              <LifeBuoy className="size-4" aria-hidden />
            </span>
          </motion.button>
        ) : null}
      </AnimatePresence>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          showCloseButton={false}
          className="w-full gap-0 border-l border-border/60 bg-background/98 p-0 sm:max-w-md"
        >
          <SheetHeader className="relative border-b border-border/60 px-5 pb-4 pt-5 pr-18 sm:px-6 sm:pb-4 sm:pt-6 sm:pr-20">
            <SheetClose asChild>
              <button
                type="button"
                className="bndr-glass-control absolute right-4 top-4 flex size-11 items-center justify-center rounded-xl text-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 sm:right-5 sm:top-5"
                aria-label="Close Crisis Navigator"
              >
                <X className="size-5" aria-hidden />
              </button>
            </SheetClose>
            <SheetTitle className="flex items-center gap-2 text-foreground">
              <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
                <LifeBuoy className="size-4" aria-hidden />
              </span>
              Crisis Navigator
            </SheetTitle>
            <SheetDescription className="text-foreground/80">
              Immediate-access hotline resources from ResourceCite.
            </SheetDescription>
          </SheetHeader>

          <div className="bndr-pill-scroll min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-xl bg-card/40" />)}
              </div>
            ) : hotlines.length > 0 ? (
              <div className="space-y-2">
                {hotlines.map((hotline) => <HotlineCard key={hotline.id} h={hotline} />)}
              </div>
            ) : (
              <p className="rounded-xl border border-border/60 bg-card/40 p-4 text-sm text-foreground/80">
                No published hotline resources are currently available.
              </p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}

function HotlineCard({ h }: { h: HotlineEntry }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/50 p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold text-foreground">{h.name}</h4>
            {h.acronym ? <Badge variant="secondary" className="bg-secondary/70 font-mono text-[10px] uppercase">{h.acronym}</Badge> : null}
          </div>
          {h.description ? <p className="mt-1 text-xs leading-relaxed text-foreground/80">{h.description}</p> : null}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {h.phoneTel ? (
          <a href={`tel:${h.phoneTel}`} className="inline-flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/15 focus-visible:ring-2 focus-visible:ring-primary/60">
            <Phone className="size-4" aria-hidden />
            <span className="font-mono tabular-nums">{h.phoneDisplay}</span>
          </a>
        ) : null}
        {h.website ? (
          <a href={h.website} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-3 py-2 text-xs text-foreground/80 hover:border-primary/40 hover:text-primary focus-visible:ring-2 focus-visible:ring-primary/60">
            <Globe className="size-3.5" aria-hidden /> Website
          </a>
        ) : null}
      </div>
    </div>
  );
}
