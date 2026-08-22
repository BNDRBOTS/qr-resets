"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Calendar,
  CalendarPlus,
  X,
  Trash2,
  MessageSquare,
  Clock,
  ChevronDown,
  Phone,
  Mail,
  User,
  Voicemail,
  MessageCircle,
  HelpCircle,
  Star,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { ContactLogEntry, ContactMethod } from "./use-contact-log";
import { cn } from "@/lib/utils";

interface ContactLogTimelineProps {
  resourceId: string;
  resourceName: string;
  entries: ContactLogEntry[];
  onAdd: (resourceId: string, date: string, note?: string, method?: ContactMethod) => void;
  onRemove: (resourceId: string, entryId: string) => void;
  /** The single "last contacted" date (derived from the contact-log) — shown as the headline. */
  lastContactedDate?: string;
  /** The advocate's saved default contact method for this resource (auto-selected in the form). */
  defaultMethod?: ContactMethod;
  /** Persist a default contact method for this resource (null = clear). */
  onSetDefaultMethod?: (resourceId: string, method: ContactMethod | null) => void;
}

/** Icon for each contact method. */
const METHOD_ICONS: Record<ContactMethod, typeof Phone> = {
  phone: Phone,
  email: Mail,
  "in-person": User,
  voicemail: Voicemail,
  text: MessageCircle,
  other: HelpCircle,
};

const METHOD_LABELS: Record<ContactMethod, string> = {
  phone: "Phone call",
  email: "Email",
  "in-person": "In person",
  voicemail: "Voicemail",
  text: "Text message",
  other: "Other",
};

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
    const diff = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  } catch {
    return null;
  }
}

function relativeLabel(iso: string): string {
  const ago = daysAgo(iso);
  if (ago === null) return "";
  if (ago === 0) return "today";
  if (ago === 1) return "1 day ago";
  if (ago < 30) return `${ago} days ago`;
  const months = Math.floor(ago / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

/**
 * Contact-log timeline — shows the full history of contact attempts for a
 * resource as a vertical timeline, plus an "add entry" form (date + optional
 * note). The most recent entry's date is surfaced as the headline "last
 * contacted" value (the contact-log is the single source of truth).
 *
 * Used in the resource detail dialog. Collapsible to keep the dialog compact
 * when there are many entries.
 */
export function ContactLogTimeline({
  resourceId,
  resourceName,
  entries,
  onAdd,
  onRemove,
  lastContactedDate,
  defaultMethod,
  onSetDefaultMethod,
}: ContactLogTimelineProps) {
  const [expanded, setExpanded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  // Auto-select the saved default method for this resource (if set), else "phone".
  const [method, setMethod] = useState<ContactMethod>(defaultMethod ?? "phone");

  // When the resource changes (dialog re-opens for a different resource) OR
  // the saved default changes, re-seed the method. The ref guard ensures this
  // only runs on an actual prop change, not on every render — so it behaves
  // like a controlled reset, not a setState-during-render loop.
  const prevKeyRef = useRef(`${resourceId}:${defaultMethod ?? ""}`);
  useEffect(() => {
    const key = `${resourceId}:${defaultMethod ?? ""}`;
    if (key !== prevKeyRef.current) {
      prevKeyRef.current = key;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMethod(defaultMethod ?? "phone");
    }
  }, [resourceId, defaultMethod]);

  const handleAdd = () => {
    if (!date) {
      toast.error("Pick a date first", { duration: 1800 });
      return;
    }
    onAdd(resourceId, date, note, method);
    toast.success("Contact logged", { duration: 1800 });
    setDate("");
    setNote("");
    setMethod("phone");
    setShowForm(false);
    if (!expanded) setExpanded(true);
  };

  const handleToday = () => {
    const today = new Date().toISOString().slice(0, 10);
    setDate(today);
  };

  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  const hasEntries = sorted.length > 0;
  const headlineDate = lastContactedDate || (hasEntries ? sorted[0].date : "");
  const ago = headlineDate ? daysAgo(headlineDate) : null;

  return (
    <div className="mt-2 rounded-xl border border-border/50 bg-card/30 p-3">
      {/* Headline row */}
      <div className="flex items-center gap-2">
        <Calendar className="size-3.5 shrink-0 text-primary/70" aria-hidden />
        <span className="text-[11px] text-muted-foreground">Contact log:</span>
        {headlineDate ? (
          <>
            <span className="text-xs font-medium text-foreground">
              {formatDateDisplay(headlineDate)}
            </span>
            {ago !== null ? (
              <span
                className={cn(
                  "text-[10px]",
                  ago <= 7
                    ? "text-emerald-600 dark:text-emerald-400"
                    : ago <= 30
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-rose-600 dark:text-rose-400",
                )}
              >
                {relativeLabel(headlineDate)}
              </span>
            ) : null}
          </>
        ) : (
          <span className="text-xs text-muted-foreground/60">no contacts logged yet</span>
        )}
        <span className="ml-auto flex items-center gap-1">
          {hasEntries ? (
            <span className="rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
              {sorted.length}
            </span>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-[10px] text-muted-foreground hover:text-primary"
            onClick={() => setShowForm((v) => !v)}
            aria-label="Log a new contact"
          >
            <CalendarPlus className="size-3" aria-hidden />
            Log
          </Button>
          {hasEntries ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-0.5 px-1.5 text-[10px] text-muted-foreground hover:text-primary"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              aria-label={expanded ? "Collapse timeline" : "Expand timeline"}
            >
              <ChevronDown
                className={cn("size-3 transition-transform", expanded && "rotate-180")}
                aria-hidden
              />
            </Button>
          ) : null}
        </span>
      </div>

      {/* Inline preview — last 3 entries as compact cards (when collapsed + 1+ entries) */}
      <AnimatePresence initial={false}>
        {!expanded && sorted.length >= 1 ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-1 border-t border-border/40 pt-2">
              <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/60">
                <Clock className="size-2.5" aria-hidden />
                Recent contacts
              </p>
              {sorted.slice(0, 3).map((entry, i) => {
                const ago = relativeLabel(entry.date);
                const MethodIcon = entry.method ? METHOD_ICONS[entry.method] : null;
                return (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 rounded-md bg-muted/30 px-2 py-1.5"
                  >
                    {MethodIcon ? (
                      <MethodIcon className="mt-0.5 size-3 shrink-0 text-primary/70" aria-hidden />
                    ) : (
                      <span
                        className={cn(
                          "mt-1.5 size-1.5 shrink-0 rounded-full",
                          i === 0 ? "bg-primary" : "bg-muted-foreground/40",
                        )}
                        aria-hidden
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[11px] font-medium text-foreground">
                          {formatDateDisplay(entry.date)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{ago}</span>
                        {entry.method ? (
                          <span className="text-[9px] text-muted-foreground/70">
                            · {METHOD_LABELS[entry.method]}
                          </span>
                        ) : null}
                        {i === 0 ? (
                          <span className="rounded-full bg-primary/15 px-1 py-0 text-[8px] font-medium text-primary">
                            latest
                          </span>
                        ) : null}
                      </div>
                      {entry.note ? (
                        <p className="mt-0.5 truncate text-[10px] text-muted-foreground/80">
                          {entry.note}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {sorted.length > 3 ? (
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className="mt-0.5 flex w-full items-center justify-center gap-1 rounded-md py-1 text-[10px] text-primary transition-colors hover:bg-primary/5"
                >
                  <ChevronDown className="size-3" aria-hidden />
                  View all {sorted.length} entries
                </button>
              ) : null}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Add-entry form */}
      <AnimatePresence initial={false}>
        {showForm ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-2.5 space-y-2 border-t border-border/40 pt-2.5">
              <div className="flex items-center gap-1.5">
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-8 w-auto flex-none border-border/60 bg-background/60 text-xs text-foreground focus:border-primary/40"
                  aria-label="Contact date"
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
                    onClick={() => {
                      setShowForm(false);
                      setDate("");
                      setNote("");
                    }}
                    className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    aria-label="Cancel"
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={handleAdd}
                    className="rounded-md bg-primary/15 p-1 text-primary transition-colors hover:bg-primary/25"
                    aria-label="Save contact entry"
                  >
                    <CalendarPlus className="size-3.5" aria-hidden />
                  </button>
                </div>
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note (e.g. 'left voicemail', 'spoke to intake nurse')…"
                maxLength={200}
                rows={2}
                className="resize-none border-border/60 bg-background/60 text-xs focus:border-primary/40"
                aria-label="Contact note"
              />
              {/* Contact-method selector */}
              <div className="flex flex-wrap items-center gap-1">
                <span className="text-[10px] text-muted-foreground/70">Method:</span>
                {(Object.keys(METHOD_ICONS) as ContactMethod[]).map((m) => {
                  const Icon = METHOD_ICONS[m];
                  const active = method === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMethod(m)}
                      aria-pressed={active}
                      title={METHOD_LABELS[m]}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] transition-colors",
                        active
                          ? "border-primary/40 bg-primary/15 text-primary"
                          : "border-border/60 text-muted-foreground hover:border-primary/30 hover:text-primary",
                      )}
                    >
                      <Icon className="size-2.5" aria-hidden />
                      {METHOD_LABELS[m]}
                    </button>
                  );
                })}
                {/* Save as default toggle — persists the selected method as
                    the auto-selected default for this resource. */}
                {onSetDefaultMethod ? (
                  <button
                    type="button"
                    onClick={() => {
                      const isDefault = defaultMethod === method;
                      onSetDefaultMethod(resourceId, isDefault ? null : method);
                      toast.success(
                        isDefault
                          ? "Default method cleared"
                          : `"${METHOD_LABELS[method]}" saved as default`,
                        { duration: 1800 },
                      );
                    }}
                    aria-pressed={defaultMethod === method}
                    title={
                      defaultMethod === method
                        ? `Default method is "${METHOD_LABELS[method]}" — click to clear`
                        : `Save "${METHOD_LABELS[method]}" as the default for this resource`
                    }
                    className={cn(
                      "ml-auto inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] transition-colors",
                      defaultMethod === method
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-dashed border-border/60 text-muted-foreground/70 hover:border-primary/30 hover:text-primary",
                    )}
                  >
                    <Star className="size-2.5" aria-hidden />
                    {defaultMethod === method ? "Default" : "Set default"}
                  </button>
                ) : null}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Timeline */}
      <AnimatePresence initial={false}>
        {expanded && hasEntries ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <ol className="mt-2.5 space-y-0 border-t border-border/40 pt-2.5">
              {sorted.map((entry, i) => {
                const isLast = i === 0;
                return (
                  <li key={entry.id} className="relative flex gap-2.5 pb-2.5 last:pb-0">
                    {/* Timeline rail */}
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "mt-1 size-2 shrink-0 rounded-full",
                          isLast ? "bg-primary" : "bg-muted-foreground/40",
                        )}
                        aria-hidden
                      />
                      {i < sorted.length - 1 ? (
                        <span className="mt-0.5 w-px flex-1 bg-border/50" aria-hidden />
                      ) : null}
                    </div>
                    {/* Entry content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-xs font-medium text-foreground">
                          {formatDateDisplay(entry.date)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {relativeLabel(entry.date)}
                        </span>
                        {entry.method ? (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-muted/50 px-1 py-0 text-[9px] text-muted-foreground" title={METHOD_LABELS[entry.method]}>
                            {(() => {
                              const MIcon = METHOD_ICONS[entry.method];
                              return <MIcon className="size-2.5" aria-hidden />;
                            })()}
                            {METHOD_LABELS[entry.method]}
                          </span>
                        ) : null}
                        {isLast ? (
                          <span className="rounded-full bg-primary/15 px-1.5 py-0 text-[9px] font-medium text-primary">
                            latest
                          </span>
                        ) : null}
                      </div>
                      {entry.note ? (
                        <p className="mt-0.5 flex items-start gap-1 text-[11px] leading-relaxed text-muted-foreground">
                          <MessageSquare className="mt-0.5 size-2.5 shrink-0 text-primary/50" aria-hidden />
                          <span className="break-words">{entry.note}</span>
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onRemove(resourceId, entry.id);
                        toast.success("Entry removed", { duration: 1500 });
                      }}
                      className="shrink-0 self-start rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-muted/50 hover:text-destructive"
                      aria-label={`Remove contact entry from ${formatDateDisplay(entry.date)}`}
                    >
                      <Trash2 className="size-3" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ol>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {!hasEntries && !showForm ? (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] text-muted-foreground/60">
          <Clock className="size-2.5" aria-hidden />
          Click &quot;Log&quot; to record your first contact with {resourceName}.
        </p>
      ) : null}
    </div>
  );
}
