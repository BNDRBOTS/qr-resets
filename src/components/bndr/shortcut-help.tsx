"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Search,
  Sparkles,
  BookmarkCheck,
  ArrowLeftRight,
  LayoutGrid,
  X,
  Keyboard,
  LifeBuoy,
  HelpCircle,
  Clock,
  LayoutDashboard,
  Download,
  Shuffle,
} from "lucide-react";

interface ShortcutHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Shortcut {
  keyLabel: string;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const SHORTCUTS: Shortcut[] = [
  {
    keyLabel: "/",
    label: "Focus search",
    description: "Jump the cursor to the search input instantly.",
    icon: <Search className="size-4" />,
  },
  {
    keyLabel: "P",
    label: "Toggle priority filter",
    description: "Show only resources currently marked priority.",
    icon: <Sparkles className="size-4" />,
  },
  {
    keyLabel: "S",
    label: "Open saved resources",
    description: "View your curated resource list with CSV/JSON export + notes.",
    icon: <BookmarkCheck className="size-4" />,
  },
  {
    keyLabel: "D",
    label: "Open advocate dashboard",
    description: "See your outreach stats: saved, contacted, follow-up needed, notes, ratings.",
    icon: <LayoutDashboard className="size-4" />,
  },
  {
    keyLabel: "E",
    label: "Toggle export menu",
    description: "When the dashboard is open, toggles the CSV/JSON/copy export dropdown.",
    icon: <Download className="size-4" />,
  },
  {
    keyLabel: "C",
    label: "Open comparison",
    description: "Open the side-by-side comparison modal (needs 2+ resources selected).",
    icon: <ArrowLeftRight className="size-4" />,
  },
  {
    keyLabel: "R",
    label: "Recently viewed",
    description: "Open the recently-viewed panel with your full browsing history.",
    icon: <Clock className="size-4" />,
  },
  {
    keyLabel: "A",
    label: "Reset to all categories",
    description: "Clear the category filter and show every resource.",
    icon: <LayoutGrid className="size-4" />,
  },
  {
    keyLabel: "X",
    label: "Surprise me!",
    description: "Open a random resource from the current list — discover something new.",
    icon: <Shuffle className="size-4" />,
  },
  {
    keyLabel: "Esc",
    label: "Clear all filters",
    description: "Reset search query, category, and priority in one keystroke.",
    icon: <X className="size-4" />,
  },
];

const GLOBAL_FEATURES: Shortcut[] = [
  {
    keyLabel: "?",
    label: "This help overlay",
    description: "Show all keyboard shortcuts (this dialog).",
    icon: <HelpCircle className="size-4" />,
  },
  {
    keyLabel: "",
    label: "Crisis help",
    description: "Floating bottom-right button opens 24/7 hotlines.",
    icon: <LifeBuoy className="size-4" />,
  },
  {
    keyLabel: "",
    label: "Compare tray",
    description: "Use the compare icon on any card to add 2-3 resources for side-by-side comparison.",
    icon: <ArrowLeftRight className="size-4" />,
  },
];

/**
 * Modal that lists all keyboard shortcuts and key features. Toggled by
 * pressing the "?" key (when not typing in an input). Renders a clean
 * two-section layout: shortcuts (with kbd elements) + global features.
 */
export function ShortcutHelp({ open, onOpenChange }: ShortcutHelpProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-b border-border/60 bg-card/40 px-6 pt-6 pb-5">
          <div className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Keyboard className="size-4" aria-hidden />
            </span>
            <Badge>Keyboard shortcuts</Badge>
          </div>
          <DialogTitle className="mt-2 text-xl font-bold text-foreground">
            Speed up your workflow
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Press these keys anywhere outside an input field. Shortcuts are
            disabled while a dialog is open (except this one).
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">
          {/* Shortcuts section */}
          <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
            Shortcuts
          </p>
          <ul className="space-y-2">
            {SHORTCUTS.map((s) => (
              <ShortcutRow key={s.label} {...s} />
            ))}
          </ul>

          {/* Global features section */}
          <p className="mb-3 mt-6 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
            Always-available features
          </p>
          <ul className="space-y-2">
            {GLOBAL_FEATURES.map((s) => (
              <ShortcutRow key={s.label} {...s} />
            ))}
          </ul>

          <p className="mt-6 border-t border-border/40 pt-4 text-[11px] leading-relaxed text-muted-foreground/60">
            Tip: the search bar has live autocomplete — start typing to see
            matching categories, tags, and resource names. When the input is
            empty, your recent searches appear.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-primary">
      {children}
    </span>
  );
}

function ShortcutRow({
  keyLabel,
  label,
  description,
  icon,
}: Shortcut) {
  return (
    <li className="flex items-start gap-3 rounded-lg border border-border/40 bg-card/30 p-3 transition-colors hover:border-border/70">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted/50 text-primary">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-foreground">{label}</p>
          {keyLabel ? (
            <kbd className="ml-auto shrink-0 rounded-md border border-border/70 bg-muted/60 px-2 py-0.5 font-mono text-[11px] font-medium text-foreground shadow-[0_2px_0_-1px_var(--border)]">
              {keyLabel}
            </kbd>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {description}
        </p>
      </div>
    </li>
  );
}
