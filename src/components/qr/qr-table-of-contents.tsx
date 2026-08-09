"use client";

import { motion } from "framer-motion";
import { ListOrdered, ArrowRight } from "lucide-react";
import { QR_NAV } from "@/lib/qr-resets-content";

/**
 * "On this page" table-of-contents overview card for the QR Resets site.
 *
 * Sits immediately after the hero and gives scanners a bird's-eye view of
 * the 8 main sections. Clicking any item smooth-scrolls to that section.
 * This addresses the VLM feedback that the long single-page site "may hurt
 * completion rates for casual scanners."
 */
export function QrTableOfContents() {
  const handleClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    id: string,
  ) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="border-y border-border/40 bg-card/20 py-16 sm:py-20"
    >
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="bndr-card rounded-2xl border border-border/60 bg-card/40 p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-full bg-primary/15 text-primary">
              <ListOrdered className="size-5" aria-hidden />
            </span>
            <div>
              <h2 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">
                On this page
              </h2>
              <p className="text-xs text-muted-foreground">
                Jump to any section — {QR_NAV.length} destinations
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {QR_NAV.map((item, i) => (
              <button
                key={item.id}
                type="button"
                onClick={(e) => handleClick(e, item.id)}
                className="group flex items-center gap-3 rounded-xl border border-border/50 bg-background/40 px-4 py-3 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:bg-primary/5 hover:shadow-[0_8px_24px_-12px_oklch(0.62_0.19_18/0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted/60 font-mono text-xs font-bold tabular-nums text-muted-foreground transition-colors group-hover:bg-primary/20 group-hover:text-primary">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="flex-1 text-sm font-medium text-foreground/90 group-hover:text-foreground">
                  {item.label}
                </span>
                <ArrowRight className="size-3.5 shrink-0 text-muted-foreground/50 transition-all group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
              </button>
            ))}
          </div>
        </div>
      </div>
    </motion.section>
  );
}
