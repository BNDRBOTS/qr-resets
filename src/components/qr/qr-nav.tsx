"use client";

import { QR_BRAND } from "@/lib/qr-resets-content";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { SiteSwitcher } from "@/components/shared/site-switcher";
import { QrScrollSpyPills } from "./qr-scroll-progress";

/**
 * Sticky header for the QR Resets site.
 *
 * Top row: real BNDR logo (on white chip) + "QR Resets™" wordmark (click →
 * scroll to top) on the left; print button + site switcher on the right.
 *
 * Bottom row: section pills with scroll-spy — the pill for the section
 * currently in view is highlighted with a cool-blue accent + dot indicator.
 *
 * The whole bar sticks to the top. On mobile the pills scroll horizontally.
 */
export function QrNav() {
  const handleTop = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <header
      className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl"
    >
      <div className="bndr-gradient-line h-px w-full" aria-hidden="true" />
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top row: logo + actions */}
        <div className="flex h-14 items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTop}
            className="flex items-center gap-2.5 focus-visible:outline-none"
            aria-label="QR Resets — back to top"
          >
            <Logo size={38} priority />
            <span className="bndr-wordmark-sm hidden text-lg font-extrabold tracking-tight sm:inline sm:text-xl">
              {QR_BRAND.name}
            </span>
          </button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handlePrint}
              className="size-9 text-muted-foreground hover:text-primary hover:bg-transparent"
              aria-label="Print this page"
              title="Print / Save as PDF"
            >
              <Printer className="size-4" aria-hidden />
            </Button>
            <SiteSwitcher compact />
          </div>
        </div>
        {/* Bottom row: scroll-spy section pills */}
        <nav aria-label="QR Resets sections">
          <QrScrollSpyPills />
        </nav>
      </div>
    </header>
  );
}
