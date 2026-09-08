"use client";

import { QR_BRAND } from "@/lib/qr-resets-content";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { SiteSwitcher } from "@/components/shared/site-switcher";
import { ThemeToggle } from "@/components/bndr/theme-toggle";
import { QrScrollSpyPills } from "./qr-scroll-progress";

/**
 * Sticky header for the QR Resets site.
 * Shared top-level structure mirrors ResourceCite: BNDR + product identity on
 * the left, product switcher + utilities on the right. QR-specific section
 * navigation remains a separate secondary row.
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
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="bndr-gradient-line h-px w-full" aria-hidden="true" />
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Shared product identity + global controls row. */}
        <div className="flex h-16 items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleTop}
            className="flex min-w-0 items-center gap-3 focus-visible:outline-none"
            aria-label="QR Resets — back to top"
          >
            <Logo size={48} priority />
            <span className="hidden h-5 w-px shrink-0 bg-border/80 sm:block" aria-hidden="true" />
            <span className="bndr-product-name hidden truncate sm:inline">
              {QR_BRAND.name}
            </span>
          </button>

          <div className="flex shrink-0 items-center gap-2">
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

        {/* QR-specific secondary navigation remains intact. */}
        <nav aria-label="QR Resets sections">
          <QrScrollSpyPills />
        </nav>
      </div>
    </header>
  );
}
