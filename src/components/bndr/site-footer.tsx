"use client";

import { useState } from "react";
import Link from "next/link";
import { LegalModal, type LegalKind } from "./legal-modals";
import { BndrLogo } from "./bndr-logo";
import { CATEGORIES } from "@/lib/types";

interface SiteFooterProps {
  onJump: (id: string) => void;
  totalResources: number;
}

/**
 * Sticky footer (relies on the parent min-h-screen flex flex-col + mt-auto
 * pattern). Three columns: brand, quick links, legal modals.
 */
export function SiteFooter({ onJump, totalResources }: SiteFooterProps) {
  const [legal, setLegal] = useState<LegalKind | null>(null);

  return (
    <footer className="mt-auto border-t border-border/60 bg-card/30">
      <div className="bndr-gradient-line h-px w-full" />
      <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          {/* Brand */}
          <div className="space-y-4">
            <BndrLogo size={44} glow />
            <p className="max-w-xs text-sm text-muted-foreground">
              A source-backed directory of victim, advocacy &amp; family-court
              resources with explicit raw/normalized data boundaries.
            </p>
          </div>

          {/* Quick links */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Quick links
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button
                  type="button"
                  onClick={() => onJump("resources")}
                  className="text-foreground/70 transition-colors hover:text-primary"
                >
                  Resources
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onJump("categories")}
                  className="text-foreground/70 transition-colors hover:text-primary"
                >
                  Categories
                </button>
              </li>
              <li>
                <Link
                  href="/admin"
                  className="text-foreground/70 transition-colors hover:text-primary"
                >
                  Admin dashboard
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div className="space-y-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Legal
            </h3>
            <ul className="space-y-2 text-sm">
              {([
                ["privacy", "Privacy Policy"],
                ["terms", "Terms of Use"],
                ["about", "About"],
                ["disclaimer", "Disclaimer"],
                ["pending", "Pending Confirmation"],
              ] as Array<[LegalKind, string]>).map(([kind, label]) => (
                <li key={kind}>
                  <button
                    type="button"
                    onClick={() => setLegal(kind)}
                    className="text-foreground/70 transition-colors hover:text-primary"
                  >
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Bottom row — trust indicators */}
        <div className="mt-10 border-t border-border/60 pt-6">
          {/* Trust badge row */}
          <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/70">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
              {totalResources} {totalResources === 1 ? "resource" : "resources"} indexed
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/70">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              {CATEGORIES.length} source-derived categories
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/70">
              <span className="size-1.5 rounded-full bg-blue-400" aria-hidden />
              PII-normalized &amp; audit-logged
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground/70">
              <span className="size-1.5 rounded-full bg-amber-400" aria-hidden />
              24/7 crisis hotlines
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Source-backed dataset. Raw and normalized values are kept distinct
            where available; displayed fields are not represented as universally verbatim.
          </p>
          <p className="mt-2 text-xs text-muted-foreground/80">
            PII normalization pipeline sanitizes inputs and redacts high-risk
            patterns before storage; every change is recorded in an audit log.
          </p>
        </div>
      </div>

      <LegalModal
        kind={(legal ?? "about") as LegalKind}
        open={legal !== null}
        onOpenChange={(o) => !o && setLegal(null)}
      />
    </footer>
  );
}
