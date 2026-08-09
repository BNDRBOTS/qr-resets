"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  BookmarkCheck,
  Phone,
  Mail,
  User,
  Voicemail,
  MessageCircle,
  HelpCircle,
  StickyNote,
  Star,
  Clock,
  AlertCircle,
  TrendingUp,
  Calendar,
  ArrowUpRight,
  CheckCircle2,
  FileText,
  Download,
  FileJson,
  FileSpreadsheet,
  ClipboardCopy,
  ChevronDown,
  Flame,
  Printer,
  Target,
  Share2,
  Pencil,
  Check,
  X,
  Minus,
  Plus,
  PartyPopper,
  Settings,
  Trash2,
  Trophy,
} from "lucide-react";
import type { Resource, CategorySlug } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { escapeHtml } from "@/lib/export-safety";
import type { ContactLogEntry } from "./use-contact-log";
import { useOutreachStats } from "./use-outreach-stats";
import { useLongestStreak } from "./use-longest-streak";

interface AdvocateDashboardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: Resource[];
  notes: Record<string, string>;
  ratings: Record<string, number>;
  contacted: Record<string, string>;
  recentCount: number;
  onOpenResource: (r: Resource) => void;
  /** Full contact-log entries per resource (for the outreach-over-time chart). */
  contactLogs?: Record<string, ContactLogEntry[]>;
  /** Weekly outreach goal (target contacts/week). */
  weeklyGoal?: number;
  onUpdateWeeklyGoal?: (goal: number) => void;
  /** Number of saved default contact methods across all resources. */
  defaultMethodCount?: number;
  /** Clear ALL saved default contact methods. */
  onClearAllDefaults?: () => void;
}

/** 7-day threshold for "follow-up needed" */
const FOLLOW_UP_DAYS = 7;

const CATEGORY_NAME: Record<CategorySlug, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.shortName]),
) as Record<CategorySlug, string>;

/** Display metadata for the contact-method breakdown. */
const METHOD_META: Record<
  string,
  { label: string; icon: React.ReactNode; color: string }
> = {
  phone: {
    label: "Phone call",
    icon: <Phone className="size-3.5" aria-hidden />,
    color: "oklch(0.62 0.22 145)",
  },
  email: {
    label: "Email",
    icon: <Mail className="size-3.5" aria-hidden />,
    color: "oklch(0.62 0.20 250)",
  },
  "in-person": {
    label: "In person",
    icon: <User className="size-3.5" aria-hidden />,
    color: "oklch(0.62 0.22 70)",
  },
  voicemail: {
    label: "Voicemail",
    icon: <Voicemail className="size-3.5" aria-hidden />,
    color: "oklch(0.62 0.20 25)",
  },
  text: {
    label: "Text message",
    icon: <MessageCircle className="size-3.5" aria-hidden />,
    color: "oklch(0.62 0.20 195)",
  },
  other: {
    label: "Other",
    icon: <HelpCircle className="size-3.5" aria-hidden />,
    color: "oklch(0.62 0.02 280)",
  },
  unspecified: {
    label: "Unspecified",
    icon: <HelpCircle className="size-3.5" aria-hidden />,
    color: "oklch(0.60 0.02 280)",
  },
};

/** CSV-escape a single field. */
function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Format a phone for display. */
function formatPhone(normalized: string | null | undefined): string {
  if (!normalized) return "";
  return normalized
    .split("|")
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => {
      const d = p.replace(/\D/g, "");
      if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
      if (d.length === 11 && d.startsWith("1")) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
      return p;
    })
    .join(" · ");
}

/** Trigger a browser download of a text file. */
function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function isFollowUpNeeded(contactedDate: string | undefined): boolean {
  if (!contactedDate) return true; // never contacted
  const d = new Date(contactedDate);
  if (isNaN(d.getTime())) return true;
  const diffDays = (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays > FOLLOW_UP_DAYS;
}

function relativeAge(contactedDate: string): string {
  const d = new Date(contactedDate);
  if (isNaN(d.getTime())) return "";
  const diffDays = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays < 30) return `${diffDays} days ago`;
  const months = Math.floor(diffDays / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

/** Days since a YYYY-MM-DD date (0 = today). Returns null on invalid input. */
function daysAgo(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return null;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

/** Format a YYYY-MM-DD date as "Aug 1, 2026". */
function formatDateDisplay(iso: string): string {
  if (!iso) return "";
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return iso;
  }
}

/**
 * Advocate Dashboard — a personal stats panel for the advocate using this
 * directory. Aggregates their localStorage activity (saved, contacted,
 * follow-ups, notes, ratings, recently-viewed) into a scannable overview
 * with a "follow-up needed" quick-list they can act on immediately.
 *
 * All data is computed client-side from the same localStorage hooks the rest
 * of the app uses — nothing is sent to any server.
 */
export function AdvocateDashboard({
  open,
  onOpenChange,
  saved,
  notes,
  ratings,
  contacted,
  recentCount,
  onOpenResource,
  contactLogs = {},
  weeklyGoal = 3,
  onUpdateWeeklyGoal,
  defaultMethodCount = 0,
  onClearAllDefaults,
}: AdvocateDashboardProps) {
  const stats = useMemo(() => {
    const savedCount = saved.length;
    const contactedCount = saved.filter((r) => !!contacted[r.id]).length;
    const followUpNeeded = saved.filter((r) => isFollowUpNeeded(contacted[r.id]));
    const followUpCount = followUpNeeded.length;
    const notesCount = saved.filter((r) => !!notes[r.id]?.trim()).length;
    const ratingsCount = saved.filter((r) => (ratings[r.id] ?? 0) > 0).length;

    // Recently contacted: within 7 days and within 30 days.
    const recentlyContacted7d = saved.filter((r) => {
      const d = contacted[r.id];
      if (!d) return false;
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return false;
      return (Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24) <= 7;
    });
    const recentlyContacted30d = saved.filter((r) => {
      const d = contacted[r.id];
      if (!d) return false;
      const dt = new Date(d);
      if (isNaN(dt.getTime())) return false;
      return (Date.now() - dt.getTime()) / (1000 * 60 * 60 * 24) <= 30;
    });

    // Outreach cadence: contacts per week over the last 30 days (0 if none).
    // Based on the count of resources contacted in the last 30 days.
    const cadencePerWeek = recentlyContacted30d.length / (30 / 7);

    // Category breakdown of saved resources
    const byCat: Record<string, number> = {};
    for (const r of saved) {
      byCat[r.category] = (byCat[r.category] ?? 0) + 1;
    }
    const categoryBreakdown = Object.entries(byCat)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6);

    // Contact-method breakdown — counts how many logged contacts used each
    // method (phone / email / in-person / voicemail / text / other). Entries
    // without a method fall into "unspecified". Only counts contacts for
    // resources currently in the saved list.
    const byMethod: Record<string, number> = {};
    let totalMethodContacts = 0;
    const savedIds = new Set(saved.map((r) => r.id));
    for (const [resourceId, entries] of Object.entries(contactLogs)) {
      if (!savedIds.has(resourceId)) continue;
      for (const entry of entries) {
        totalMethodContacts++;
        const m = entry.method ?? "unspecified";
        byMethod[m] = (byMethod[m] ?? 0) + 1;
      }
    }
    const methodBreakdown = Object.entries(byMethod).sort((a, b) => b[1] - a[1]);

    // Average rating
    const ratedValues = saved
      .map((r) => ratings[r.id] ?? 0)
      .filter((v) => v > 0);
    const avgRating =
      ratedValues.length > 0
        ? ratedValues.reduce((a, b) => a + b, 0) / ratedValues.length
        : 0;

    // ---- Recently contacted across ALL saved resources -------------------
    // Flatten all contact-log entries for saved resources, sort newest-first
    // by date, and take the top 3. Each entry is paired with its resource so
    // the UI can show the resource name + category.
    const recentSavedIds = new Set(saved.map((r) => r.id));
    const recentSavedById = new Map(saved.map((r) => [r.id, r]));
    const allEntries: { entry: ContactLogEntry; resource: Resource }[] = [];
    for (const [resourceId, entries] of Object.entries(contactLogs)) {
      if (!recentSavedIds.has(resourceId)) continue;
      const resource = recentSavedById.get(resourceId);
      if (!resource) continue;
      for (const entry of entries) {
        allEntries.push({ entry, resource });
      }
    }
    allEntries.sort((a, b) => b.entry.date.localeCompare(a.entry.date));
    const recentContacts = allEntries.slice(0, 3);

    return {
      savedCount,
      contactedCount,
      followUpCount,
      notesCount,
      ratingsCount,
      categoryBreakdown,
      avgRating,
      followUpNeeded,
      recentlyContacted7d,
      recentlyContacted30d,
      cadencePerWeek,
      methodBreakdown,
      totalMethodContacts,
      recentContacts,
    };
  }, [saved, notes, ratings, contacted, contactLogs]);

  // ---- Outreach stats — uses the shared useOutreachStats hook so the site
  // header indicators + this dashboard stay perfectly in sync. The hook
  // computes the weekly chart, streak, and goal progress from the same
  // contact-log + saved data.
  const { weeklyChart, streak, thisWeekCount, goalProgress, goalMet, goalRemaining } =
    useOutreachStats({ saved, contactLogs, weeklyGoal });

  // Track the longest streak ever achieved (persisted in localStorage).
  const { longest: longestStreak, newRecord: newStreakRecord } = useLongestStreak(streak);

  // "Streak at risk" — the streak is still alive (via grace) but this week has
  // 0 contacts logged. Shown as an amber warning so the advocate knows to log
  // a contact before the week ends to preserve the streak.
  const thisWeekHasContacts = thisWeekCount > 0;
  const streakAtRisk = streak > 0 && !thisWeekHasContacts;

  // Fire a celebration toast when the goal transitions from not-met → met.
  const prevGoalMetRef = useRef(false);
  useEffect(() => {
    if (goalMet && !prevGoalMetRef.current && open) {
      toast.success("🎉 Weekly goal achieved!", {
        description: `You've logged ${thisWeekCount} contact${thisWeekCount === 1 ? "" : "s"} this week — target reached.`,
        duration: 4000,
      });
    }
    prevGoalMetRef.current = goalMet;
  }, [goalMet, thisWeekCount, open]);

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(weeklyGoal));

  const saveGoal = () => {
    const n = parseInt(goalDraft, 10);
    if (!isNaN(n) && n >= 0 && n <= 50) {
      onUpdateWeeklyGoal?.(n);
      toast.success(`Weekly goal set to ${n} contact${n === 1 ? "" : "s"}`, { duration: 1800 });
    }
    setEditingGoal(false);
  };

  // ---- Share dashboard summary (copyable text) -----------------------------
  const shareDashboard = async () => {
    const lines = [
      `BNDR. Advocate Dashboard — ${stamp}`,
      ``,
      `Outreach at a glance:`,
      `  Saved: ${stats.savedCount}`,
      `  Contacted: ${stats.contactedCount}`,
      `  Follow-up needed: ${stats.followUpCount}`,
      `  Notes: ${stats.notesCount}`,
      `  Rated: ${stats.ratingsCount}${stats.avgRating > 0 ? ` (avg ${stats.avgRating.toFixed(1)}★)` : ""}`,
      `  Cadence: ${stats.cadencePerWeek.toFixed(1)} contacts/week (30d)`,
      `  This week: ${thisWeekCount}/${weeklyGoal}${goalMet ? " ✓ goal met" : ` (${goalRemaining} to go)`}`,
      streak > 0 ? `  Streak: ${streak} week${streak === 1 ? "" : "s"}${streakAtRisk ? " (at risk!)" : ""}` : null,
      longestStreak > 0 ? `  Longest streak: ${longestStreak} weeks` : null,
      stats.totalMethodContacts > 0
        ? `  Contact methods: ${stats.methodBreakdown.map(([m, c]) => `${METHOD_META[m]?.label ?? m} ${c}`).join(", ")}`
        : null,
      ``,
      `Outreach over time (last 8 weeks):`,
      ...weeklyChart.weeks.map((w) => `  ${w.label}: ${w.count} contact${w.count === 1 ? "" : "s"}`),
      ``,
      `Follow-up worklist (${stats.followUpNeeded.length}):`,
      ...stats.followUpNeeded.slice(0, 10).map((r, i) => {
        const cat = CATEGORY_NAME[r.category as CategorySlug] ?? r.category;
        const last = contacted[r.id] ? contacted[r.id] : "never";
        return `  ${i + 1}. ${r.name} — ${cat} — last: ${last}`;
      }),
      stats.followUpNeeded.length > 10 ? `  ...and ${stats.followUpNeeded.length - 10} more` : null,
      ``,
      `Computed locally — no data leaves the browser.`,
    ].filter(Boolean);
    const text = lines.join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Dashboard summary copied to clipboard");
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  // ---- View filter: which list to show in the actionable panel -------------
  type ViewTab = "followUp" | "recent7d" | "recent30d" | "all";
  const [view, setView] = useState<ViewTab>("followUp");

  const viewList = useMemo(() => {
    switch (view) {
      case "recent7d":
        return stats.recentlyContacted7d;
      case "recent30d":
        return stats.recentlyContacted30d;
      case "all":
        return saved;
      case "followUp":
      default:
        return stats.followUpNeeded;
    }
  }, [view, stats, saved]);

  const [exportOpen, setExportOpen] = useState(false);

  // ---- Keyboard shortcut: "E" toggles the export dropdown when the dashboard
  // is open. Listens at the window level but only acts when `open` is true and
  // the user isn't typing in an input/textarea.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      if (isTyping) return;
      if (e.key === "e" || e.key === "E") {
        // Only toggle if there's data to export (matches the button condition).
        if (stats.savedCount > 0) {
          e.preventDefault();
          setExportOpen((v) => !v);
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, stats.savedCount]);

  // ---- Export helpers (follow-up worklist) ---------------------------------
  const stamp = new Date().toISOString().slice(0, 10);

  const exportFollowUpCSV = () => {
    const rows: string[][] = [
      ["Name", "Acronym", "Category", "Phone", "Email", "Website", "Address", "Last Contacted", "Status", "Rating", "Note"],
    ];
    for (const r of stats.followUpNeeded) {
      rows.push([
        r.name,
        r.acronym ?? "",
        CATEGORY_NAME[r.category as CategorySlug] ?? r.category,
        formatPhone(r.phoneNormalized),
        r.email ?? "",
        r.website ?? "",
        r.address ?? "",
        contacted[r.id] ?? "",
        contacted[r.id] ? "follow-up needed" : "never contacted",
        String(ratings[r.id] ?? 0),
        notes[r.id] ?? "",
      ]);
    }
    // Append a summary section with the weekly goal + contact-method breakdown
    // so the CSV is self-contained for offline review.
    rows.push([]);
    rows.push(["--- Summary ---"]);
    rows.push(["Weekly goal target", String(weeklyGoal)]);
    rows.push(["Contacts this week", String(thisWeekCount)]);
    rows.push(["Goal met", goalMet ? "yes" : "no"]);
    rows.push(["Streak (weeks)", String(streak)]);
    rows.push(["Longest streak (weeks)", String(longestStreak)]);
    rows.push(["Streak at risk", streakAtRisk ? "yes" : "no"]);
    if (stats.totalMethodContacts > 0) {
      rows.push([]);
      rows.push(["--- Contact methods ---"]);
      rows.push(["Method", "Count", "Percentage"]);
      for (const [method, count] of stats.methodBreakdown) {
        const pct = Math.round((count / stats.totalMethodContacts!) * 100);
        rows.push([METHOD_META[method]?.label ?? method, String(count), `${pct}%`]);
      }
    }
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    downloadFile(`bndr-dashboard-${stamp}.csv`, csv, "text/csv;charset=utf-8");
    toast.success(
      stats.followUpNeeded.length > 0
        ? `Exported ${stats.followUpNeeded.length} follow-up items + summary to CSV`
        : "Exported dashboard summary to CSV",
    );
    setExportOpen(false);
  };

  const exportFollowUpJSON = () => {
    const data = {
      exportedAt: new Date().toISOString(),
      exportType: "bndr-follow-up-worklist",
      threshold: `contacted > ${FOLLOW_UP_DAYS} days ago or never`,
      count: stats.followUpNeeded.length,
      weeklyGoal: {
        target: weeklyGoal,
        thisWeek: thisWeekCount,
        met: goalMet,
        remaining: goalRemaining,
        streak,
        longestStreak,
        streakAtRisk,
      },
      contactMethods: stats.totalMethodContacts > 0
        ? stats.methodBreakdown.map(([method, count]) => ({
            method,
            label: METHOD_META[method]?.label ?? method,
            count,
            percentage: Math.round((count / stats.totalMethodContacts!) * 100),
          }))
        : [],
      items: stats.followUpNeeded.map((r) => ({
        id: r.id,
        name: r.name,
        acronym: r.acronym ?? null,
        category: r.category,
        categoryLabel: CATEGORY_NAME[r.category as CategorySlug] ?? r.category,
        phone: formatPhone(r.phoneNormalized),
        email: r.email ?? null,
        website: r.website ?? null,
        address: r.address ?? null,
        lastContacted: contacted[r.id] ?? null,
        status: contacted[r.id] ? "follow-up needed" : "never contacted",
        rating: ratings[r.id] ?? 0,
        note: notes[r.id] ?? null,
      })),
    };
    downloadFile(
      `bndr-dashboard-${stamp}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
    toast.success(
      stats.followUpNeeded.length > 0
        ? `Exported ${stats.followUpNeeded.length} follow-up items + summary to JSON`
        : "Exported dashboard summary to JSON",
    );
    setExportOpen(false);
  };

  const copyFollowUpText = async () => {
    const hasFollowUps = stats.followUpNeeded.length > 0;
    const lines = hasFollowUps
      ? stats.followUpNeeded.map((r, i) => {
          const cat = CATEGORY_NAME[r.category as CategorySlug] ?? r.category;
          const phone = formatPhone(r.phoneNormalized);
          const last = contacted[r.id] ? `last: ${contacted[r.id]}` : "never contacted";
          const contact = [phone, r.email, r.website].filter(Boolean).join(" · ") || "no contact on file";
          return `${i + 1}. ${r.name}${r.acronym ? ` (${r.acronym})` : ""} — ${cat}\n   ${contact}\n   ${last}`;
        })
      : ["All caught up — no follow-ups needed."];
    const header = hasFollowUps
      ? `BNDR. Follow-up worklist — ${stats.followUpNeeded.length} item${stats.followUpNeeded.length === 1 ? "" : "s"} (${stamp})\n\n`
      : `BNDR. Dashboard summary (${stamp})\n\n`;
    // Append a compact summary section so the text is useful even with 0 follow-ups.
    const summary = [
      `Saved: ${stats.savedCount} · Contacted: ${stats.contactedCount} · Follow-up: ${stats.followUpCount}`,
      `This week: ${thisWeekCount}/${weeklyGoal}${goalMet ? " ✓ goal met" : ` (${goalRemaining} to go)`}`,
      streak > 0 ? `Streak: ${streak} week${streak === 1 ? "" : "s"}` : null,
      stats.totalMethodContacts > 0
        ? `Contact methods: ${stats.methodBreakdown.map(([m, c]) => `${METHOD_META[m]?.label ?? m} ${c}`).join(", ")}`
        : null,
    ].filter(Boolean).join("\n");
    const text = header + summary + "\n\n" + lines.join("\n\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success(
        hasFollowUps
          ? `Copied ${stats.followUpNeeded.length} follow-up items + summary`
          : "Copied dashboard summary",
      );
    } catch {
      toast.error("Could not copy to clipboard");
    }
    setExportOpen(false);
  };

  // Print-friendly dashboard PDF export — opens a clean print window with all
  // stats + the follow-up worklist, formatted for paper or "Save as PDF".
  const printDashboard = () => {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) {
      toast.error("Pop-up blocked — allow pop-ups to print");
      return;
    }
    const statRows = statCards.map((s) => `<tr><td class="label">${escapeHtml(s.label)}</td><td class="value">${escapeHtml(String(s.value))}</td><td class="hint">${escapeHtml(s.hint)}</td></tr>`).join("");
    // Turn 1 Scope C.2 — Escape all resource-derived values in the follow-up
    // table. No resource field, source note, or user note can become HTML.
    const followUpRows = stats.followUpNeeded.map((r, i) => {
      const cat = CATEGORY_NAME[r.category as CategorySlug] ?? r.category;
      const phone = formatPhone(r.phoneNormalized);
      const last = contacted[r.id] ? contacted[r.id] : "never";
      const note = notes[r.id] ? notes[r.id] : "";
      return `<tr><td>${i + 1}</td><td>${escapeHtml(r.name)}${r.acronym ? ` (${escapeHtml(r.acronym)})` : ""}</td><td>${escapeHtml(cat)}</td><td>${escapeHtml(phone) || "—"}</td><td>${escapeHtml(r.email || "—")}</td><td>${escapeHtml(last)}</td><td>${escapeHtml(note)}</td></tr>`;
    }).join("");
    const chartBars = weeklyChart.weeks.map((w) => {
      const h = Math.max(4, Math.round((w.count / weeklyChart.max) * 100));
      return `<div class="bar-col"><span class="bar-num">${w.count > 0 ? w.count : ""}</span><div class="bar" style="height:${h}%;background:${w.count > 0 ? "#315f8f" : "#ddd"}"></div><span class="bar-label">${w.label}</span></div>`;
    }).join("");

    // ---- Weekly goal progress block --------------------------------------
    // A visual progress bar + "X / Y contacts · (met / N to go)" label,
    // mirroring the on-screen dashboard goal card.
    const goalBarPct = weeklyGoal > 0 ? Math.min(100, Math.round((thisWeekCount / weeklyGoal) * 100)) : 0;
    const goalBarColor = goalMet ? "#059669" : "#315f8f"; // emerald if met, blue if in progress
    const goalBlock = weeklyGoal > 0 ? `
      <h2>Weekly goal</h2>
      <div class="goal">
        <div class="goal-head">
          <span><strong>${thisWeekCount}</strong> / ${weeklyGoal} ${weeklyGoal === 1 ? "contact" : "contacts"}</span>
          <span class="goal-status" style="color:${goalBarColor}">${goalMet ? "✓ Goal met" : `${goalRemaining} to go`}</span>
        </div>
        <div class="goal-track"><div class="goal-fill" style="width:${goalBarPct}%;background:${goalBarColor}"></div></div>
      </div>` : "";

    // ---- Contact-method breakdown block ----------------------------------
    // A horizontal stacked bar + legend, mirroring the on-screen dashboard
    // "Contact methods" section. Only rendered when there are logged contacts.
    const methodColors: Record<string, string> = {
      phone: "#059669",
      email: "#2563eb",
      "in-person": "#ca8a04",
      voicemail: "#dc2626",
      text: "#0891b2",
      other: "#7c3aed",
      unspecified: "#71717a",
    };
    const methodLabels: Record<string, string> = {
      phone: "Phone call",
      email: "Email",
      "in-person": "In person",
      voicemail: "Voicemail",
      text: "Text message",
      other: "Other",
      unspecified: "Unspecified",
    };
    const methodSegments = stats.totalMethodContacts > 0
      ? stats.methodBreakdown.map(([method, count]) => {
          const pct = (count / stats.totalMethodContacts) * 100;
          const color = methodColors[method] ?? methodColors.other;
          return `<div class="mseg" style="width:${pct}%;background:${color}" title="${methodLabels[method] ?? method}: ${count} (${Math.round(pct)}%)"></div>`;
        }).join("")
      : "";
    const methodLegend = stats.totalMethodContacts > 0
      ? stats.methodBreakdown.map(([method, count]) => {
          const pct = Math.round((count / stats.totalMethodContacts) * 100);
          const color = methodColors[method] ?? methodColors.other;
          const label = methodLabels[method] ?? method;
          return `<tr><td class="mchip" style="background:${color}"></td><td class="mlabel">${label}</td><td class="mcount">${count}</td><td class="mpct">${pct}%</td></tr>`;
        }).join("")
      : "";
    const methodBlock = stats.totalMethodContacts > 0 ? `
      <h2>Contact methods (${stats.totalMethodContacts} logged)</h2>
      <div class="mbar">${methodSegments}</div>
      <table class="mlegend">${methodLegend}</table>` : "";

    w.document.write(`<!DOCTYPE html><html><head><title>BNDR. Advocate Dashboard — ${stamp}</title><style>
      body{font:14px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#111;max-width:720px;margin:0 auto;padding:32px 24px}
      h1{font-size:24px;margin:0 0 4px;color:#315f8f}
      .sub{color:#666;font-size:12px;margin-bottom:24px}
      h2{font-size:14px;text-transform:uppercase;letter-spacing:.1em;color:#666;margin:24px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      td{padding:6px 8px;border-bottom:1px solid #eee;vertical-align:top}
      td.label{font-weight:600;width:100px}
      td.value{font-family:monospace;font-size:18px;font-weight:bold;color:#315f8f;text-align:right;width:60px}
      td.hint{color:#888;font-size:11px}
      .followup td{font-size:11px}
      .chart{display:flex;align-items:flex-end;justify-content:space-between;height:100px;gap:8px;margin:12px 0}
      .bar-col{display:flex;flex-direction:column;align-items:center;flex:1;gap:4px}
      .bar{width:100%;max-width:40px;border-radius:4px 4px 0 0}
      .bar-num{font-size:10px;font-weight:bold}
      .bar-label{font-size:9px;color:#888}
      .streak{background:#fce8f3;border:1px solid #315f8f;border-radius:8px;padding:12px 16px;margin:16px 0;display:flex;align-items:center;gap:12px}
      .streak .num{font-size:32px;font-weight:bold;color:#315f8f;font-family:monospace}
      .goal{background:#faf5ff;border:1px solid #e9d5ff;border-radius:8px;padding:12px 16px;margin:12px 0}
      .goal-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;font-size:14px}
      .goal-head strong{font-size:20px;font-family:monospace;color:#315f8f}
      .goal-status{font-size:12px;font-weight:600}
      .goal-track{height:10px;background:#e5e7eb;border-radius:5px;overflow:hidden}
      .goal-fill{height:100%;border-radius:5px;transition:width .3s}
      .mbar{display:flex;height:12px;border-radius:6px;overflow:hidden;background:#e5e7eb;margin:12px 0}
      .mseg{height:100%}
      .mlegend{margin-top:8px}
      .mlegend td{border:none;padding:3px 8px 3px 0;font-size:12px}
      .mchip{width:14px;height:14px;border-radius:3px}
      .mlabel{font-weight:500}
      .mcount{font-family:monospace;font-weight:bold;text-align:right;width:40px}
      .mpct{font-family:monospace;color:#888;text-align:right;width:40px}
      .footer{margin-top:32px;padding-top:12px;border-top:1px solid #ddd;font-size:10px;color:#999}
    </style></head><body>
      <h1>BNDR. Advocate Dashboard</h1>
      <div class="sub">Outreach summary · ${stamp} · Computed locally — no data leaves the browser</div>
      ${streak > 0 ? `<div class="streak"><div class="num">${streak}</div><div><strong>${streak}-week contact streak</strong><br><span style="font-size:11px;color:#666">Consistent outreach over the last ${streak} week${streak === 1 ? "" : "s"}.</span></div></div>` : ""}
      <h2>Outreach at a glance</h2>
      <table>${statRows}</table>
      ${goalBlock}
      <h2>Outreach over time (last 8 weeks)</h2>
      <div class="chart">${chartBars}</div>
      ${methodBlock}
      <h2>Follow-up worklist (${stats.followUpNeeded.length})</h2>
      ${stats.followUpNeeded.length > 0 ? `<table class="followup"><tr><th>#</th><th>Name</th><th>Category</th><th>Phone</th><th>Email</th><th>Last contacted</th><th>Note</th></tr>${followUpRows}</table>` : `<p style="color:#888;font-size:12px">All caught up — no follow-ups needed.</p>`}
      <div class="footer">BNDR. Resource Directory · Source-backed dataset · Printed ${new Date().toLocaleString()}</div>
    </body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
    toast.success("Opening print view of dashboard");
  };

  const statCards = [
    {
      label: "Saved",
      value: stats.savedCount,
      icon: BookmarkCheck,
      hint: "resources in your list",
      accent: "text-primary",
    },
    {
      label: "Contacted",
      value: stats.contactedCount,
      icon: Phone,
      hint: `of ${stats.savedCount} saved`,
      accent: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Follow-up",
      value: stats.followUpCount,
      icon: AlertCircle,
      hint: `> ${FOLLOW_UP_DAYS}d or never`,
      accent: "text-amber-600 dark:text-amber-400",
      highlight: stats.followUpCount > 0,
    },
    {
      label: "Notes",
      value: stats.notesCount,
      icon: StickyNote,
      hint: "private annotations",
      accent: "text-primary",
    },
    {
      label: "Rated",
      value: stats.ratingsCount,
      icon: Star,
      hint: stats.avgRating > 0 ? `avg ${stats.avgRating.toFixed(1)}★` : "no ratings",
      accent: "text-primary",
    },
    {
      label: "Cadence",
      value: stats.cadencePerWeek > 0 ? stats.cadencePerWeek.toFixed(1) : "0",
      icon: TrendingUp,
      hint: "contacts / week (30d)",
      accent: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: "Recent",
      value: recentCount,
      icon: Clock,
      hint: "viewed this session",
      accent: "text-muted-foreground",
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l border-border/60 bg-background/95 p-0 sm:max-w-xl lg:max-w-2xl"
      >
        <SheetHeader className="border-b border-border/60 bg-card/40 px-6 pb-5 pt-6">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <SheetTitle className="flex items-center gap-2.5 text-lg text-foreground">
                <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
                  <TrendingUp className="size-4" aria-hidden />
                </span>
                Advocate Dashboard
              </SheetTitle>
              <SheetDescription className="text-muted-foreground">
                Your personal outreach overview. Computed locally — nothing leaves this browser.
              </SheetDescription>
            </div>
            {/* Export dropdown — only enabled when there are follow-ups */}
            <div className="flex shrink-0 items-center gap-1.5">
              {stats.savedCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={shareDashboard}
                  className="text-muted-foreground hover:text-primary hover:bg-transparent"
                  aria-label="Share dashboard summary"
                  title="Copy summary to clipboard"
                >
                  <Share2 className="size-4" aria-hidden />
                </Button>
              ) : null}
              {stats.savedCount > 0 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={printDashboard}
                  className="text-muted-foreground hover:text-primary hover:bg-transparent"
                  aria-label="Print dashboard (PDF)"
                  title="Print / Save as PDF"
                >
                  <Printer className="size-4" aria-hidden />
                </Button>
              ) : null}
              {stats.savedCount > 0 ? (
                <div className="relative">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setExportOpen((v) => !v)}
                    className="gap-1.5"
                    aria-expanded={exportOpen}
                    aria-label="Export dashboard data"
                  >
                    <Download className="size-3.5" aria-hidden />
                    <span className="hidden sm:inline">Export</span>
                    <ChevronDown className={cn("size-3 transition-transform", exportOpen && "rotate-180")} aria-hidden />
                  </Button>
                <AnimatePresence>
                  {exportOpen ? (
                    <>
                      {/* Click-away backdrop */}
                      <button
                        type="button"
                        aria-hidden
                        tabIndex={-1}
                        className="fixed inset-0 z-40 cursor-default"
                        onClick={() => setExportOpen(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, y: -6, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6, scale: 0.97 }}
                        transition={{ duration: 0.14, ease: "easeOut" }}
                        className="absolute right-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-xl border border-border/60 bg-popover/95 shadow-[0_20px_60px_-12px_rgba(0,0,0,0.6)] backdrop-blur-xl"
                      >
                        <div className="border-b border-border/40 px-3 py-2">
                          <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                            {stats.followUpCount > 0
                              ? `Follow-up worklist (${stats.followUpCount})`
                              : "Dashboard export"}
                          </p>
                        </div>
                        <div className="p-1">
                          <button
                            type="button"
                            onClick={exportFollowUpCSV}
                            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                          >
                            <FileSpreadsheet className="size-4 shrink-0 text-primary" aria-hidden />
                            <span className="min-w-0">
                              <span className="block">CSV spreadsheet</span>
                              <span className="block text-[10px] text-muted-foreground">Excel / Sheets compatible</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={exportFollowUpJSON}
                            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                          >
                            <FileJson className="size-4 shrink-0 text-primary" aria-hidden />
                            <span className="min-w-0">
                              <span className="block">JSON data</span>
                              <span className="block text-[10px] text-muted-foreground">Structured / importable</span>
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={copyFollowUpText}
                            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                          >
                            <ClipboardCopy className="size-4 shrink-0 text-primary" aria-hidden />
                            <span className="min-w-0">
                              <span className="block">Copy as text</span>
                              <span className="block text-[10px] text-muted-foreground">Paste into email / notes</span>
                            </span>
                          </button>
                        </div>
                      </motion.div>
                    </>
                  ) : null}
                </AnimatePresence>
                </div>
              ) : null}
            </div>
          </div>
        </SheetHeader>

        <ScrollArea className="bndr-scroll flex-1">
          <div className="space-y-6 px-6 py-6">
            {/* Stat grid */}
            <section aria-label="Outreach statistics">
              <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Your outreach at a glance
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {statCards.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <motion.div
                      key={s.label}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: i * 0.04 }}
                      className={cn(
                        "bndr-card relative flex flex-col gap-2 rounded-xl p-4",
                        s.highlight && "border-amber-400/40 bg-amber-400/[0.04]",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Icon
                          className={cn("size-4", s.accent)}
                          aria-hidden
                        />
                        {s.highlight ? (
                          <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                            Action
                          </span>
                        ) : null}
                      </div>
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-3xl font-bold tabular-nums text-foreground">
                          {s.value.toLocaleString()}
                        </span>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground/85">
                          {s.label}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {s.hint}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </section>

            {/* Empty state OR follow-up list */}
            {stats.savedCount === 0 ? (
              <section
                aria-label="Getting started"
                className="bndr-card rounded-xl p-6 text-center"
              >
                <FileText className="mx-auto mb-3 size-8 text-muted-foreground/50" aria-hidden />
                <h4 className="text-sm font-medium text-foreground">
                  No saved resources yet
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Save resources from the directory to build your outreach list.
                  This dashboard will populate with saved, contacted, and
                  follow-up stats automatically.
                </p>
              </section>
            ) : (
              <>
                {/* Actionable list with view tabs */}
                <section aria-label="Outreach list">
                  {/* Tab bar */}
                  <div className="mb-3 flex flex-wrap items-center gap-1.5">
                    {([
                      { key: "followUp", label: "Follow-up", count: stats.followUpCount, icon: AlertCircle, color: "amber" },
                      { key: "recent7d", label: "7 days", count: stats.recentlyContacted7d.length, icon: Clock, color: "emerald" },
                      { key: "recent30d", label: "30 days", count: stats.recentlyContacted30d.length, icon: Clock, color: "emerald" },
                      { key: "all", label: "All saved", count: stats.savedCount, icon: BookmarkCheck, color: "primary" },
                    ] as const).map((tab) => {
                      const Icon = tab.icon;
                      const active = view === tab.key;
                      return (
                        <button
                          key={tab.key}
                          type="button"
                          onClick={() => setView(tab.key)}
                          aria-pressed={active}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                            active
                              ? "border-primary/50 bg-primary/15 text-primary"
                              : "border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-primary",
                          )}
                        >
                          <Icon className="size-3" aria-hidden />
                          {tab.label}
                          <span className={cn(
                            "rounded-full px-1.5 text-[9px] tabular-nums",
                            active ? "bg-primary/20 text-primary" : "bg-muted/60 text-muted-foreground",
                          )}>
                            {tab.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* List */}
                  {viewList.length > 0 ? (
                    <ul className="space-y-2">
                      {viewList.slice(0, 12).map((r) => {
                        const contactedDate = contacted[r.id];
                        const age = contactedDate ? relativeAge(contactedDate) : "";
                        const catName =
                          CATEGORY_NAME[r.category as CategorySlug] ?? r.category;
                        const isFollow = isFollowUpNeeded(contactedDate);
                        return (
                          <li key={r.id}>
                            <button
                              type="button"
                              onClick={() => {
                                onOpenChange(false);
                                onOpenResource(r);
                              }}
                              className={cn(
                                "bndr-card group flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors",
                                isFollow ? "hover:border-amber-400/40" : "hover:border-primary/40",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                                  !contactedDate
                                    ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                                    : isFollow
                                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                                )}
                                title={contactedDate ? `Last: ${age}` : "Never contacted"}
                              >
                                <Calendar className="size-3.5" aria-hidden />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {r.name}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {catName}
                                  {contactedDate ? ` · last: ${age}` : " · never contacted"}
                                </p>
                              </div>
                              <ArrowUpRight
                                className="size-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary"
                                aria-hidden
                              />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : view === "followUp" ? (
                    <div className="bndr-card flex items-center gap-3 rounded-xl border-emerald-500/30 bg-emerald-500/[0.04] p-4">
                      <CheckCircle2 className="size-5 text-emerald-600 dark:text-emerald-400" aria-hidden />
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          All caught up
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Every saved resource has been contacted within the last {FOLLOW_UP_DAYS} days.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bndr-card flex flex-col items-center justify-center gap-2 rounded-xl p-8 text-center">
                      <Clock className="size-6 text-muted-foreground/40" aria-hidden />
                      <p className="text-sm font-medium text-foreground">Nothing here yet</p>
                      <p className="text-[11px] text-muted-foreground">
                        {view === "recent7d"
                          ? "No resources contacted in the last 7 days. Log a contact from any resource detail."
                          : view === "recent30d"
                            ? "No resources contacted in the last 30 days."
                            : "Save resources from the directory to populate this list."}
                      </p>
                    </div>
                  )}
                  {viewList.length > 12 ? (
                    <p className="mt-2 text-center text-[11px] text-muted-foreground">
                      + {viewList.length - 12} more — see all in the Saved panel
                    </p>
                  ) : null}
                </section>

                {/* Contact streak callout */}
                {streak > 0 ? (
                  <section aria-label="Contact streak" className="mb-2">
                    <div
                      className={cn(
                        "bndr-card flex items-center gap-3 rounded-xl p-3.5",
                        streakAtRisk
                          ? "border-amber-500/40 bg-amber-500/[0.06]"
                          : "border-primary/30 bg-primary/[0.06]",
                      )}
                    >
                      <span
                        className={cn(
                          "bndr-flame-glow flex size-9 shrink-0 items-center justify-center rounded-full",
                          streakAtRisk
                            ? "bg-gradient-to-br from-amber-500/30 to-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-gradient-to-br from-primary/30 to-primary/10 text-primary",
                        )}
                      >
                        <Flame className="size-4.5 bndr-flame-flicker" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground">
                          {streak}-week streak
                          {newStreakRecord ? (
                            <span className="ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
                              <Trophy className="size-2.5" aria-hidden />
                              New record!
                            </span>
                          ) : null}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {streakAtRisk
                            ? "⚠ Streak at risk — log a contact this week to keep it alive!"
                            : streak === 1
                              ? "You've logged a contact this week — keep it going!"
                              : streak < 4
                                ? "Consistent outreach. Don't break the chain."
                                : streak < 8
                                  ? "Strong cadence — your outreach is building momentum."
                                  : "Exceptional consistency — advocate of the month territory."}
                        </p>
                        {longestStreak > streak ? (
                          <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                            Longest streak: {longestStreak} weeks
                          </p>
                        ) : null}
                      </div>
                      <span
                        className={cn(
                          "font-mono text-2xl font-bold tabular-nums",
                          streakAtRisk
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-primary",
                        )}
                      >
                        {streak}
                      </span>
                    </div>
                  </section>
                ) : null}

                {/* Recently contacted — last 3 contacts across all saved resources */}
                {stats.recentContacts.length > 0 ? (
                  <section aria-label="Recently contacted" className="mb-2">
                    <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                      <Clock className="size-3.5 text-primary" aria-hidden />
                      Recently contacted
                    </h3>
                    <ul className="space-y-1.5">
                      {stats.recentContacts.map(({ entry, resource }) => {
                        const cat = CATEGORY_NAME[resource.category as CategorySlug] ?? resource.category;
                        const ago = daysAgo(entry.date);
                        const agoLabel = ago === 0 ? "today" : ago === 1 ? "1 day ago" : `${ago} days ago`;
                        const MethodIcon = entry.method
                          ? (METHOD_META[entry.method]?.icon ?? <HelpCircle className="size-3.5" aria-hidden />)
                          : null;
                        return (
                          <li key={entry.id}>
                            <button
                              type="button"
                              onClick={() => onOpenResource(resource)}
                              className="bndr-card group flex w-full items-center gap-3 rounded-lg p-2.5 text-left transition-colors hover:border-primary/40"
                            >
                              <span
                                className={cn(
                                  "flex size-8 shrink-0 items-center justify-center rounded-full",
                                  ago !== null && ago <= 7
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400",
                                )}
                                title={entry.method ? METHOD_META[entry.method]?.label : "Contact logged"}
                              >
                                {MethodIcon ?? <Clock className="size-3.5" aria-hidden />}
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {resource.name}
                                </p>
                                <p className="truncate text-[11px] text-muted-foreground">
                                  {cat}
                                  {entry.method ? ` · ${METHOD_META[entry.method]?.label ?? entry.method}` : ""}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-[11px] font-medium text-foreground/80">
                                  {formatDateDisplay(entry.date)}
                                </p>
                                <p
                                  className={cn(
                                    "text-[10px]",
                                    ago !== null && ago <= 7
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-amber-600 dark:text-amber-400",
                                  )}
                                >
                                  {agoLabel}
                                </p>
                              </div>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ) : null}

                {/* Weekly goal progress */}
                <section aria-label="Weekly goal" className="mb-2">
                  <div className="bndr-card rounded-xl p-3.5">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <h3 className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                        <Target className={cn("size-3.5", goalMet ? "text-emerald-600 dark:text-emerald-400" : "text-primary")} aria-hidden />
                        This week's goal
                      </h3>
                      {onUpdateWeeklyGoal ? (
                        editingGoal ? (
                          <div className="flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                const n = Math.max(0, (parseInt(goalDraft, 10) || 0) - 1);
                                setGoalDraft(String(n));
                              }}
                              className="flex size-6 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                              aria-label="Decrease goal by 1"
                            >
                              <Minus className="size-3" aria-hidden />
                            </button>
                            <span className="w-8 text-center font-mono text-sm font-bold tabular-nums text-foreground">
                              {goalDraft}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const n = Math.min(50, (parseInt(goalDraft, 10) || 0) + 1);
                                setGoalDraft(String(n));
                              }}
                              className="flex size-6 items-center justify-center rounded-md border border-border/60 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                              aria-label="Increase goal by 1"
                            >
                              <Plus className="size-3" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={saveGoal}
                              className="ml-1 rounded-md bg-primary/15 p-1 text-primary hover:bg-primary/25"
                              aria-label="Save goal"
                            >
                              <Check className="size-3" aria-hidden />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingGoal(false)}
                              className="rounded-md p-1 text-muted-foreground hover:bg-muted/50"
                              aria-label="Cancel"
                            >
                              <X className="size-3" aria-hidden />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setGoalDraft(String(weeklyGoal));
                              setEditingGoal(true);
                            }}
                            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] text-muted-foreground transition-colors hover:text-primary"
                            aria-label="Edit weekly goal"
                          >
                            <Pencil className="size-2.5" aria-hidden />
                            Edit
                          </button>
                        )
                      ) : null}
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-mono text-2xl font-bold tabular-nums text-foreground">
                        {thisWeekCount}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        / {weeklyGoal} {weeklyGoal === 1 ? "contact" : "contacts"}
                      </span>
                      {goalMet ? (
                        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
                          <CheckCircle2 className="size-3" aria-hidden />
                          Goal met
                        </span>
                      ) : (
                        <span className="ml-auto text-[11px] text-muted-foreground">
                          {goalRemaining} to go
                        </span>
                      )}
                    </div>
                    {/* Progress bar */}
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted/60">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${goalProgress}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                        className={cn(
                          "h-full rounded-full transition-colors",
                          goalMet
                            ? "bg-gradient-to-r from-emerald-500/70 to-emerald-400"
                            : "bg-gradient-to-r from-primary/70 to-primary",
                          // Pulse when ≥80% complete (but not yet met) to encourage the final push.
                          !goalMet && goalProgress >= 80 ? "bndr-goal-near" : "",
                        )}
                      />
                    </div>
                    {/* Celebration banner when goal is met */}
                    <AnimatePresence>
                      {goalMet ? (
                        <motion.div
                          initial={{ opacity: 0, height: 0, y: -4 }}
                          animate={{ opacity: 1, height: "auto", y: 0 }}
                          exit={{ opacity: 0, height: 0, y: -4 }}
                          transition={{ duration: 0.3, ease: "easeOut" }}
                          className="overflow-hidden"
                        >
                          <div className="bndr-celebrate mt-2.5 flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/[0.08] px-3 py-2">
                            <PartyPopper className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden />
                            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
                              Goal achieved! You've reached your weekly target.
                            </p>
                          </div>
                        </motion.div>
                      ) : null}
                    </AnimatePresence>
                  </div>
                </section>

                {/* Outreach over time — 8-week bar chart */}
                <section aria-label="Outreach over time">
                  <div className="mb-3 flex items-center justify-between">
                    <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      <TrendingUp className="size-3.5 text-primary" aria-hidden />
                      Outreach over time
                    </h3>
                    <span className="text-[10px] text-muted-foreground">
                      {weeklyChart.total} contact{weeklyChart.total === 1 ? "" : "s"} · last 8 weeks
                    </span>
                  </div>
                  {weeklyChart.total > 0 ? (
                    <div className="bndr-card rounded-xl p-4">
                      <div className="flex items-end justify-between gap-1.5" style={{ height: "120px" }}>
                        {weeklyChart.weeks.map((w, i) => {
                          const h = Math.max(4, Math.round((w.count / weeklyChart.max) * 100));
                          const isCurrent = i === weeklyChart.weeks.length - 1;
                          // Use the stored weekStart/weekEnd for the tooltip range.
                          const rangeLabel = `${w.weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${w.weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;
                          return (
                            <TooltipProvider key={i} delayDuration={120}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="group flex flex-1 flex-col items-center justify-end gap-1.5 cursor-default">
                                    <span
                                      className={cn(
                                        "text-[10px] tabular-nums transition-colors group-hover:text-primary",
                                        isCurrent ? "font-bold text-primary" : "font-medium text-muted-foreground",
                                      )}
                                    >
                                      {w.count > 0 ? w.count : ""}
                                    </span>
                                    <div
                                      className="w-full rounded-t-md transition-all duration-300 group-hover:opacity-90"
                                      style={{
                                        height: `${h}%`,
                                        background: w.count > 0
                                          ? (isCurrent
                                            ? "linear-gradient(to top, oklch(0.48 0.30 255), oklch(0.62 0.26 255))"
                                            : "linear-gradient(to top, oklch(0.48 0.30 255 / 0.6), oklch(0.62 0.26 255 / 0.6))")
                                          : "var(--muted)",
                                      }}
                                    />
                                    <span
                                      className={cn(
                                        "text-[9px] tabular-nums",
                                        isCurrent ? "font-bold text-foreground" : "text-muted-foreground/70",
                                      )}
                                    >
                                      {w.label}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-xs">
                                  <p className="font-medium text-foreground">{rangeLabel}</p>
                                  <p className="text-muted-foreground">
                                    {w.count} contact{w.count === 1 ? "" : "s"}
                                    {isCurrent ? " · this week" : ""}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="bndr-card flex items-center gap-3 rounded-xl p-4">
                      <TrendingUp className="size-5 text-muted-foreground/40" aria-hidden />
                      <div>
                        <p className="text-sm font-medium text-foreground">No outreach logged yet</p>
                        <p className="text-[11px] text-muted-foreground">
                          Log contacts from any resource detail to see your outreach trend over time.
                        </p>
                      </div>
                    </div>
                  )}
                </section>

                {/* Contact-method breakdown — how contacts were made */}
                {stats.totalMethodContacts > 0 ? (
                  <section aria-label="Contact methods">
                    <div className="mb-3 flex items-center justify-between">
                      <h3 className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                        <Phone className="size-3.5 text-primary" aria-hidden />
                        Contact methods
                      </h3>
                      <span className="text-[10px] text-muted-foreground">
                        {stats.totalMethodContacts} contact{stats.totalMethodContacts === 1 ? "" : "s"} logged
                      </span>
                    </div>
                    <div className="bndr-card rounded-xl p-4">
                      {/* Horizontal stacked bar — shows the proportion of each method at a glance. */}
                      <div
                        className="mb-3 flex h-2.5 w-full overflow-hidden rounded-full bg-muted/60"
                        role="img"
                        aria-label={`Contact method breakdown: ${stats.methodBreakdown
                          .map(([m, c]) => `${METHOD_META[m]?.label ?? m} ${c}`)
                          .join(", ")}`}
                      >
                        {stats.methodBreakdown.map(([method, count]) => {
                          const pct = (count / stats.totalMethodContacts) * 100;
                          if (pct <= 0) return null;
                          return (
                            <div
                              key={method}
                              style={{
                                width: `${pct}%`,
                                backgroundColor: METHOD_META[method]?.color ?? "var(--muted)",
                              }}
                              title={`${METHOD_META[method]?.label ?? method}: ${count} (${Math.round(pct)}%)`}
                            />
                          );
                        })}
                      </div>
                      {/* Legend rows with counts + percentages. */}
                      <ul className="space-y-1.5">
                        {stats.methodBreakdown.map(([method, count]) => {
                          const meta = METHOD_META[method] ?? METHOD_META.other;
                          const pct = Math.round((count / stats.totalMethodContacts) * 100);
                          return (
                            <li
                              key={method}
                              className="flex items-center gap-2.5 text-sm"
                            >
                              <span
                                className="flex size-6 items-center justify-center rounded-full"
                                style={{
                                  backgroundColor: `color-mix(in oklch, ${meta.color} 18%, transparent)`,
                                  color: meta.color,
                                }}
                                aria-hidden
                              >
                                {meta.icon}
                              </span>
                              <span className="flex-1 text-foreground/85">
                                {meta.label}
                              </span>
                              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                                {count} · {pct}%
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  </section>
                ) : null}

                {/* Category breakdown */}
                {stats.categoryBreakdown.length > 0 ? (
                  <section aria-label="Saved by category">
                    <h3 className="mb-3 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      Your saved resources by category
                    </h3>
                    <div className="space-y-2">
                      {stats.categoryBreakdown.map(([slug, count]) => {
                        const pct = Math.round((count / stats.savedCount) * 100);
                        const catName =
                          CATEGORY_NAME[slug as CategorySlug] ?? slug;
                        return (
                          <div key={slug} className="flex items-center gap-3">
                            <span className="w-44 shrink-0 truncate text-xs text-foreground/85">
                              {catName}
                            </span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.5, ease: "easeOut" }}
                                className="h-full rounded-full bg-gradient-to-r from-primary/70 to-primary"
                              />
                            </div>
                            <span className="w-8 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
                              {count}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}
              </>
            )}

            {/* Settings — clear all default contact methods */}
            {onClearAllDefaults && defaultMethodCount > 0 ? (
              <section aria-label="Settings" className="border-t border-border/40 pt-4">
                <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  <Settings className="size-3.5 text-primary" aria-hidden />
                  Settings
                </h3>
                <div className="bndr-card flex items-center gap-3 rounded-xl p-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground">
                      Default contact methods
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {defaultMethodCount} resource{defaultMethodCount === 1 ? " has" : "s have"} a saved
                      default method. Clear all to reset.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (
                        confirm(
                          `Clear all ${defaultMethodCount} saved default contact method${defaultMethodCount === 1 ? "" : "s"}? This cannot be undone.`,
                        )
                      ) {
                        onClearAllDefaults();
                        toast.success("Cleared all default contact methods");
                      }
                    }}
                    className="gap-1.5 text-muted-foreground hover:border-destructive/40 hover:text-destructive"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                    Clear all
                  </Button>
                </div>
              </section>
            ) : null}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
