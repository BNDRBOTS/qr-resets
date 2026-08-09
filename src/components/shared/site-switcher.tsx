"use client";

import { BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSiteStore, useSiteHydrated, type SiteId } from "@/lib/use-site";

interface SiteSwitcherProps {
  /** Compact mode uses shorter labels while preserving explicit text. */
  compact?: boolean;
}

const SITES: Record<
  SiteId,
  { label: string; short: string; icon: typeof BookOpen; desc: string }
> = {
  bndr: {
    label: "Resource Directory",
    short: "Directory",
    icon: BookOpen,
    desc: "Source-faithful victim, advocacy & family-court resources",
  },
  qr: {
    label: "QR Resets™",
    short: "QR Resets",
    icon: Sparkles,
    desc: "One scan. One dollar. One real Reset.",
  },
};

/**
 * A two-segment toggle that switches between the two mission sites.
 * Renders as a pill with both options; the active one is filled with the high-contrast ink color.
 *
 * Until the store hydrates we render the BNDR side as active to match the
 * server-rendered HTML (no hydration mismatch).
 */
export function SiteSwitcher({ compact = false }: SiteSwitcherProps) {
  const hydrated = useSiteHydrated();
  const site = useSiteStore((s) => s.site);
  const setSite = useSiteStore((s) => s.setSite);
  const active = hydrated ? site : "bndr";

  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="tablist"
        aria-label="Switch mission site"
        className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-card/40 p-0.5 backdrop-blur-sm"
      >
        {(Object.keys(SITES) as SiteId[]).map((id) => {
          const info = SITES[id];
          const Icon = info.icon;
          const isActive = active === id;
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <Button
                  role="tab"
                  type="button"
                  aria-selected={isActive}
                  variant="ghost"
                  size="sm"
                  onClick={() => setSite(id)}
                  className={
                    "gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium transition-all sm:text-xs " +
                    (isActive
                      ? "bg-foreground text-background shadow-sm hover:bg-foreground/90 hover:text-background"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground")
                  }
                >
                  <Icon className="size-3.5" aria-hidden />
                  <span>{compact ? info.short : info.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px]">
                <p className="font-semibold">{info.label}</p>
                <p className="text-xs text-muted-foreground">{info.desc}</p>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
