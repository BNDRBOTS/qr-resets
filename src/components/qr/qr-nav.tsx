"use client";

import { QR_BRAND } from "@/lib/qr-resets-content";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BndrLogo } from "@/components/bndr/bndr-logo";
import { SiteSwitcher } from "@/components/shared/site-switcher";
import { ThemeToggle } from "@/components/bndr/theme-toggle";
import { QrScrollSpyPills } from "./qr-scroll-progress";

/** Sticky header for QR Resets with the same desktop geometry as Resource Site. */
export function QrNav() {
  const handleTop = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/70 backdrop-blur-xl">
      <div className="bndr-gradient-line absolute inset-x-0 bottom-0 h-px" aria-hidden="true" />
      <div className="container mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={handleTop}
          className="inline-flex min-w-0 shrink-0 items-center gap-2 rounded-md text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/55"
          aria-label="BNDR QR Resets — back to top"
        >
          <BndrLogo size={46} />
          <span className="hidden whitespace-nowrap text-base font-semibold tracking-tight sm:inline">
            {QR_BRAND.name}
          </span>
        </button>

        <div className="hidden min-w-0 flex-1 items-center justify-center px-3 lg:flex">
          <nav aria-label="QR Resets sections" className="min-w-0 max-w-full">
            <QrScrollSpyPills className="pb-0" />
          </nav>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={handlePrint}
            className="hidden size-9 text-muted-foreground hover:bg-transparent hover:text-primary sm:inline-flex"
            aria-label="Print this page"
            title="Print / Save as PDF"
          >
            <Printer className="size-4" aria-hidden />
          </Button>
          <SiteSwitcher compact />
          <ThemeToggle />
        </div>
      </div>

      <nav aria-label="QR Resets sections" className="container mx-auto max-w-7xl px-4 pb-2 sm:px-6 lg:hidden lg:px-8">
        <QrScrollSpyPills className="pb-0" />
      </nav>
    </header>
  );
}
