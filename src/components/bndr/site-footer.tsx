"use client";

import { useState } from "react";
import Link from "next/link";
import { LegalModal, type LegalKind } from "./legal-modals";
import { BndrLogo } from "./bndr-logo";
import { useSiteCopy } from "@/lib/use-site-copy";

interface SiteFooterProps {
  onJump: (id: string) => void;
  totalResources: number;
}

export function SiteFooter({ onJump, totalResources }: SiteFooterProps) {
  const [legal, setLegal] = useState<LegalKind | null>(null);
  const copy = useSiteCopy();

  return (
    <footer className="mt-auto border-t border-border/60 bg-card/30">
      <div className="bndr-gradient-line h-px w-full" />
      <div className="container mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-3">
          <div className="space-y-4">
            <BndrLogo size={44} glow alt="BNDR LLC" />
            <div>
              <p className="bndr-product-name bndr-product-name--footer">ResourceCite</p>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-foreground/80">
                {copy.footerIntro}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70">
              ResourceCite
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button type="button" onClick={() => onJump("resources")} className="text-foreground/80 transition-colors hover:text-primary">
                  Resources
                </button>
              </li>
              <li>
                <button type="button" onClick={() => onJump("categories")} className="text-foreground/80 transition-colors hover:text-primary">
                  Categories
                </button>
              </li>
              <li>
                <Link href="/admin" className="text-foreground/80 transition-colors hover:text-primary">
                  Admin dashboard
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/70">
              Information
            </h3>
            <ul className="space-y-2 text-sm">
              {([
                ["privacy", "Privacy Policy"],
                ["terms", "Terms of Use"],
                ["about", "About"],
                ["disclaimer", "Disclaimer"],
              ] as Array<[LegalKind, string]>).map(([kind, label]) => (
                <li key={kind}>
                  <button type="button" onClick={() => setLegal(kind)} className="text-foreground/80 transition-colors hover:text-primary">
                    {label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border/60 pt-6">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
              <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden />
              {totalResources.toLocaleString()} {totalResources === 1 ? "resource" : "resources"} indexed
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground/80">
              <span className="size-1.5 rounded-full bg-primary" aria-hidden />
              24/7 crisis resources available
            </span>
          </div>
          <p className="mt-4 max-w-4xl text-xs leading-relaxed text-foreground/70">
            {copy.provenanceNote}
          </p>
        </div>
      </div>

      <LegalModal
        kind={(legal ?? "about") as LegalKind}
        open={legal !== null}
        onOpenChange={(open) => !open && setLegal(null)}
      />
    </footer>
  );
}
