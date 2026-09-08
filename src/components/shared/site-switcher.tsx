"use client";

import { BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useSiteStore, type SiteId } from "@/lib/use-site";

interface SiteSwitcherProps {
  compact?: boolean;
}

const SITES: Record<
  SiteId,
  { label: string; short: string; icon: typeof BookOpen; desc: string }
> = {
  bndr: {
    label: "ResourceCite",
    short: "ResourceCite",
    icon: BookOpen,
    desc: "Find legal, advocacy, housing, medical, and practical support resources.",
  },
  qr: {
    label: "QR Resets™",
    short: "QR Resets",
    icon: Sparkles,
    desc: "Prototype preview of the QR Resets concept.",
  },
};

export function SiteSwitcher({ compact = false }: SiteSwitcherProps) {
  const site = useSiteStore((s) => s.site);
  const setSite = useSiteStore((s) => s.setSite);

  return (
    <TooltipProvider delayDuration={300}>
      <div
        role="tablist"
        aria-label="Switch product"
        className="inline-flex items-center gap-0.5 rounded-full border border-border/60 bg-card/40 p-0.5 backdrop-blur-sm"
      >
        {(Object.keys(SITES) as SiteId[]).map((id) => {
          const info = SITES[id];
          const Icon = info.icon;
          const isActive = site === id;
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
                    "gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold transition-all sm:text-xs " +
                    (isActive
                      ? "bg-foreground text-background shadow-sm hover:bg-foreground/90 hover:text-background"
                      : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground")
                  }
                >
                  <Icon className="size-3.5" aria-hidden />
                  <span>{compact ? info.short : info.label}</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[240px]">
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
