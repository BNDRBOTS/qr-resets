"use client";

import { motion } from "framer-motion";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSiteStore } from "@/lib/use-site";
import { QR_BRAND } from "@/lib/qr-resets-content";

/**
 * Mission-connection band.
 *
 * A slim, high-impact callout that sits near the end of each site and
 * invites the user to explore the OTHER site — reinforcing that BNDR.
 * Resource Directory and QR Resets™ are two halves of one mission.
 *
 * On the BNDR directory it promotes QR Resets™ ("give $1 or request a Reset").
 * On the QR Resets site it promotes the Resource Directory ("find immediate
 * help now").
 */
export function MissionConnection({ from }: { from: "bndr" | "qr" }) {
  const setSite = useSiteStore((s) => s.setSite);

  if (from === "bndr") {
    return (
      <section className="relative overflow-hidden border-y border-primary/20 bg-gradient-to-br from-primary/10 via-card/40 to-background py-16 sm:py-20">
        {/* cool-blue radial accent */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute right-0 top-0 h-full w-1/2 bg-[radial-gradient(ellipse_at_right,var(--glow-primary-soft),transparent_70%)]"
        />
        <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-xl">
              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-primary/80">
                <Sparkles className="size-3.5" aria-hidden />
                Same mission
              </p>
              <h2 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                One scan. One dollar. One real Reset.
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                QR Resets™ turns small monthly contributions into flexible,
                person-directed support that repairs the connected barriers
                turning a temporary crisis into permanent collapse.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Button
                type="button"
                size="lg"
                onClick={() => {
                  setSite("qr");
                  window.scrollTo({ top: 0 });
                }}
                className="gap-2 rounded-full shadow-[var(--shadow-accent-soft)] hover:shadow-[var(--shadow-accent-strong)]"
              >
                <Sparkles className="size-4" aria-hidden />
                Explore QR Resets™
                <ArrowRight className="size-4" aria-hidden />
              </Button>
              <span className="text-xs text-muted-foreground">
                No deservingness test · No forced treatment
              </span>
            </div>
          </div>
        </div>
      </section>
    );
  }

  // from === "qr" → promote the Resource Directory
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative overflow-hidden border-y border-primary/20 bg-gradient-to-br from-primary/10 via-card/40 to-background py-16 sm:py-20"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0 h-full w-1/2 bg-[radial-gradient(ellipse_at_left,var(--glow-primary-soft),transparent_70%)]"
      />
      <div className="container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <p className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.22em] text-primary/80">
              <BookOpen className="size-3.5" aria-hidden />
              Same mission
            </p>
            <h2 className="text-balance text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Need immediate help right now?
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
              The BNDR. Resource Directory indexes the published resource dataset across
              victim advocacy, family court, legal aid, housing and more —
              source-backed, searchable, and ready to use today.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:items-end">
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => {
                setSite("bndr");
                window.scrollTo({ top: 0 });
              }}
              className="gap-2 rounded-full border-primary/40 hover:border-primary/70 hover:text-primary"
            >
              <BookOpen className="size-4" aria-hidden />
              Open Resource Directory
              <ArrowRight className="size-4" aria-hidden />
            </Button>
            <span className="text-xs text-muted-foreground">
              {QR_BRAND.tagline}
            </span>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
