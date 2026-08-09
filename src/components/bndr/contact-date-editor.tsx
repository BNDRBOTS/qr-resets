"use client";

import { useState } from "react";
import { Calendar, CalendarPlus, X, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface ContactDateEditorProps {
  resourceId: string;
  resourceName: string;
  date: string;
  onSet: (id: string, dateStr: string) => void;
  onClear: (id: string) => void;
}

function formatDateDisplay(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function daysAgo(iso: string): number | null {
  if (!iso) return null;
  try {
    const d = new Date(iso + "T00:00:00");
    const now = new Date();
    const diff = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
    );
    return diff;
  } catch {
    return null;
  }
}

/**
 * Editor for the "last contacted" date on a resource. Shows a date input
 * + quick "today" button. When a date is set, displays it with a relative
 * "N days ago" hint. Used in the saved panel + detail dialog.
 */
export function ContactDateEditor({
  resourceId,
  resourceName,
  date,
  onSet,
  onClear,
}: ContactDateEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(date);

  const handleStartEdit = () => {
    setDraft(date);
    setEditing(true);
  };

  const handleSave = () => {
    onSet(resourceId, draft);
    setEditing(false);
    if (draft && draft !== date) {
      toast.success("Contact date saved", { duration: 1800 });
    } else if (!draft && date) {
      onClear(resourceId);
      toast.success("Contact date cleared", { duration: 1800 });
    }
  };

  const handleCancel = () => {
    setDraft(date);
    setEditing(false);
  };

  const handleToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    setDraft(today);
  };

  const hasDate = date.trim().length > 0;
  const ago = hasDate ? daysAgo(date) : null;

  if (editing) {
    return (
      <div className="mt-2 space-y-2">
        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="h-8 w-auto flex-none border-border/60 bg-background/60 text-xs text-foreground focus:border-primary/40"
          />
          <button
            type="button"
            onClick={handleToday}
            className="shrink-0 rounded-md border border-border/60 px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            Today
          </button>
          <div className="ml-auto flex items-center gap-0.5">
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
              aria-label="Cancel"
            >
              <X className="size-3.5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded-md bg-primary/15 p-1 text-primary transition-colors hover:bg-primary/25"
              aria-label="Save date"
            >
              <Check className="size-3.5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (hasDate) {
    return (
      <button
        type="button"
        onClick={handleStartEdit}
        className="mt-2 flex w-full items-center gap-2 rounded-lg border border-border/50 bg-card/30 px-3 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-card/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Calendar className="size-3.5 shrink-0 text-primary/70" aria-hidden />
        <span className="text-[11px] text-muted-foreground">Last contacted:</span>
        <span className="text-xs font-medium text-foreground">
          {formatDateDisplay(date)}
        </span>
        {ago !== null ? (
          <span
            className={
              "text-[10px] " +
              (ago <= 7
                ? "text-emerald-600 dark:text-emerald-400"
                : ago <= 30
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-rose-600 dark:text-rose-400")
            }
          >
            {ago === 0 ? "today" : ago === 1 ? "1 day ago" : `${ago} days ago`}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border/50 px-2.5 py-1.5 text-[11px] text-muted-foreground/70 transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <CalendarPlus className="size-3" aria-hidden />
      Track last contact date
    </button>
  );
}
