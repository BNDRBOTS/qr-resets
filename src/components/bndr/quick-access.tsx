"use client";

// BNDR. — Quick Access floating widget
// ----------------------------------------------------------------------------
// A compact floating panel (bottom-left, above the crisis help button) that
// shows at-a-glance counts for saved, recently viewed, and compare tray.
// Each item is a clickable button that opens the corresponding panel.
// Only appears when at least one count is > 0, and auto-hides on mobile.

import { BookmarkCheck, Clock, ArrowLeftRight, X } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface QuickAccessProps {
  savedCount: number;
  recentCount: number;
  compareCount: number;
  onOpenSaved: () => void;
  onOpenRecent: () => void;
  onOpenCompare: () => void;
}

export function QuickAccess({
  savedCount,
  recentCount,
  compareCount,
  onOpenSaved,
  onOpenRecent,
  onOpenCompare,
}: QuickAccessProps) {
  const [dismissed, setDismissed] = useState(false);

  const hasItems = savedCount > 0 || recentCount > 0 || compareCount > 0;
  if (!hasItems || dismissed) return null;

  const items = [
    {
      label: "Saved",
      count: savedCount,
      icon: BookmarkCheck,
      onClick: onOpenSaved,
      color: "text-primary",
      bg: "bg-primary/10",
    },
    {
      label: "Recent",
      count: recentCount,
      icon: Clock,
      onClick: onOpenRecent,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
    },
    {
      label: "Compare",
      count: compareCount,
      icon: ArrowLeftRight,
      onClick: onOpenCompare,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
  ].filter((i) => i.count > 0);

  return (
    <div className="bndr-quick-access fixed bottom-6 left-4 z-30 hidden sm:block">
      <div className="relative flex items-center gap-1.5 rounded-2xl border border-border/60 bg-card/90 p-1.5 shadow-xl backdrop-blur-xl">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.onClick}
            className="group flex items-center gap-2 rounded-xl px-3 py-2 transition-colors hover:bg-muted/60"
            aria-label={`${item.label}: ${item.count} ${item.count === 1 ? "item" : "items"}`}
          >
            <span className={`flex size-7 items-center justify-center rounded-lg ${item.bg} ${item.color}`}>
              <item.icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="flex flex-col items-start leading-none">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                {item.label}
              </span>
              <span className="text-sm font-bold tabular-nums text-foreground">
                {item.count}
              </span>
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="ml-1 flex size-6 items-center justify-center rounded-lg text-muted-foreground/50 transition-colors hover:bg-muted/60 hover:text-foreground"
          aria-label="Dismiss quick access"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>
    </div>
  );
}
