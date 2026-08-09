"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bookmark,
  BookmarkCheck,
  X,
  Download,
  FileText,
  FileJson,
  Trash2,
  ExternalLink,
  Phone,
  Mail,
  Globe,
  ArrowUpDown,
  Clock,
  Printer,
  CheckSquare,
  Square,
  Check,
  CheckCircle2,
  FolderOpen,
  Plus,
  Flame,
  Printer as PrinterIcon,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CATEGORIES, type Resource, type CategorySlug } from "@/lib/types";
import { formatPhoneDisplay } from "@/lib/pii";
import { toast } from "sonner";
import { buildPrintDocument, csvCell } from "@/lib/export-safety";
import { NoteEditor } from "./note-editor";
import { StarRating } from "./star-rating";
import { ContactDateEditor } from "./contact-date-editor";
import { AddToCollectionPicker, CollectionBadges } from "./collections-panel";
import type { Collection } from "./use-collections";

const CATEGORY_NAME: Record<CategorySlug, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.shortName]),
) as Record<CategorySlug, string>;

interface SavedResourcesPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saved: Resource[];
  onToggle: (r: Resource) => void;
  onClear: () => void;
  onOpen: (r: Resource) => void;
  getNote?: (id: string) => string;
  onSetNote?: (id: string, text: string) => void;
  onDeleteNote?: (id: string) => void;
  noteMaxLength?: number;
  getRating?: (id: string) => number;
  onSetRating?: (id: string, rating: number) => void;
  ratingMax?: number;
  getContacted?: (id: string) => string;
  onSetContacted?: (id: string, dateStr: string) => void;
  onClearContacted?: (id: string) => void;
  // Collections integration
  collections?: Collection[];
  collectionsForResource?: (resourceId: string) => Collection[];
  onToggleCollection?: (collectionId: string, resourceId: string) => void;
  onCreateCollection?: (name: string) => void;
  collectionMaxNameLength?: number;
}

/**
 * Right-side Sheet listing the user's saved/pinned resources, with CSV/JSON
 * export and per-item remove. Designed for advocates building a resource
 * list for a client. Includes private per-resource notes + star ratings +
 * last-contacted date tracking.
 */
export function SavedResourcesPanel({
  open,
  onOpenChange,
  saved,
  onToggle,
  onClear,
  onOpen,
  getNote,
  onSetNote,
  onDeleteNote,
  noteMaxLength = 500,
  getRating,
  onSetRating,
  ratingMax = 5,
  getContacted,
  onSetContacted,
  onClearContacted,
  collections = [],
  collectionsForResource,
  onToggleCollection,
  onCreateCollection,
  collectionMaxNameLength = 60,
}: SavedResourcesPanelProps) {
  const [sortBy, setSortBy] = useState<
    "recent" | "name" | "category" | "rating" | "contacted"
  >("recent");
  const [followUpOnly, setFollowUpOnly] = useState(false);
  const [recentOnly, setRecentOnly] = useState(false);
  // ---- Bulk selection state ----
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const selectedCount = selectedIds.size;
  const selectedResources = saved.filter((r) => selectedIds.has(r.id));

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(sorted.map((r) => r.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const exitBulkMode = () => {
    setBulkMode(false);
    clearSelection();
  };

  // Bulk export selected resources as CSV
  const bulkExportCSV = () => {
    if (selectedResources.length === 0) return;
    const rows: string[][] = [
      ["Name", "Acronym", "Category", "Phone", "Email", "Website", "Address", "Last Contacted", "Rating", "Note"],
    ];
    for (const r of selectedResources) {
      rows.push([
        r.name,
        r.acronym ?? "",
        CATEGORY_NAME[r.category as CategorySlug] ?? r.category,
        (r.phoneNormalized ?? "").split("|").filter(Boolean).join(" · "),
        r.email ?? "",
        r.website ?? "",
        r.address ?? "",
        getContacted?.(r.id) ?? "",
        String(getRating?.(r.id) ?? 0),
        getNote?.(r.id) ?? "",
      ]);
    }
    // Turn 1 Scope C.3 — Use the shared formula-safe CSV encoder.
    const csv = rows.map((row) => row.map((v) => csvCell(v ?? "")).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bndr-saved-selection-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`Exported ${selectedResources.length} selected resources to CSV`);
  };

  // Bulk remove selected resources from saved
  const bulkRemove = () => {
    if (selectedResources.length === 0) return;
    const count = selectedResources.length;
    for (const r of selectedResources) {
      onToggle(r);
    }
    toast.success(`Removed ${count} resource${count === 1 ? "" : "s"} from saved`);
    exitBulkMode();
  };

  // Bulk add selected resources to a collection
  const [bulkCollectionOpen, setBulkCollectionOpen] = useState(false);
  const [bulkNewCollectionName, setBulkNewCollectionName] = useState("");

  const bulkAddToCollection = (collectionId: string, collectionName: string) => {
    if (selectedResources.length === 0) return;
    let added = 0;
    for (const r of selectedResources) {
      // onToggleCollection handles add/remove; we always add here.
      // The toggle logic in page.tsx checks if already present.
      onToggleCollection?.(collectionId, r.id);
      added++;
    }
    toast.success(`Added ${added} resource${added === 1 ? "" : "s"} to "${collectionName}"`);
    setBulkCollectionOpen(false);
  };

  const bulkCreateAndAdd = () => {
    const name = bulkNewCollectionName.trim();
    if (!name || selectedResources.length === 0) return;
    onCreateCollection?.(name);
    setBulkNewCollectionName("");
    setBulkCollectionOpen(false);
    toast.success(`Created collection "${name}" — add resources to it from each item's picker`);
  };

  // "Follow-up needed" = contacted >7 days ago (or never contacted).
  const FOLLOW_UP_DAYS = 7;
  const isFollowUp = (id: string) => {
    const dateStr = getContacted?.(id) ?? "";
    if (!dateStr) return true; // never contacted = needs follow-up
    try {
      const d = new Date(dateStr + "T00:00:00");
      const days = Math.floor(
        (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24),
      );
      return days > FOLLOW_UP_DAYS;
    } catch {
      return false;
    }
  };

  // Returns true if the resource was contacted within the last 7 days.
  const isRecentContact = (id: string): boolean => {
    const dateStr = getContacted?.(id) ?? "";
    if (!dateStr) return false; // never contacted
    try {
      const d = new Date(dateStr + "T00:00:00");
      const days = Math.floor(
        (Date.now() - d.getTime()) / (1000 * 60 * 60 * 24),
      );
      return days <= FOLLOW_UP_DAYS;
    } catch {
      return false;
    }
  };

  // Filter + compute sorted copy of saved items.
  // Apply both filters independently — followUpOnly + recentOnly are mutually
  // exclusive in practice (a resource can't be both "needs follow-up" and
  // "recently contacted"), but we compose them with AND so toggling one off
  // doesn't surprise the user.
  let filtered = saved;
  if (followUpOnly) filtered = filtered.filter((r) => isFollowUp(r.id));
  if (recentOnly) filtered = filtered.filter((r) => isRecentContact(r.id));

  // Pre-compute the counts for the filter badges so the user can see how many
  // resources match each filter before toggling.
  const followUpCount = saved.filter((r) => isFollowUp(r.id)).length;
  const recentCount = saved.filter((r) => isRecentContact(r.id)).length;
  const sorted = (() => {
    const arr = [...filtered];
    switch (sortBy) {
      case "name":
        return arr.sort((a, b) => a.name.localeCompare(b.name));
      case "category":
        return arr.sort(
          (a, b) =>
            (CATEGORY_NAME[a.category] ?? a.category).localeCompare(
              CATEGORY_NAME[b.category] ?? b.category,
            ),
        );
      case "rating":
        return arr.sort(
          (a, b) => (getRating?.(b.id) ?? 0) - (getRating?.(a.id) ?? 0),
        );
      case "contacted":
        // Most recently contacted first; never-contacted at the end.
        return arr.sort((a, b) => {
          const da = getContacted?.(a.id) ?? "";
          const db = getContacted?.(b.id) ?? "";
          if (!da && !db) return 0;
          if (!da) return 1;
          if (!db) return -1;
          return db.localeCompare(da);
        });
      default:
        return arr; // "recent" preserves array order (most recent first)
    }
  })();

  const handleExport = (format: "csv" | "json") => {
    if (saved.length === 0) {
      toast.error("No saved resources to export");
      return;
    }
    let content: string;
    let mime: string;
    let ext: string;

    if (format === "json") {
      content = JSON.stringify(
        saved.map((r) => ({
          name: r.name,
          acronym: r.acronym,
          category: r.category,
          subcategory: r.subcategory,
          description: r.description,
          phoneRaw: r.phoneRaw,
          phoneNormalized: r.phoneNormalized,
          email: r.email,
          website: r.website,
          address: r.address,
          tags: r.tags,
          sourceNote: r.sourceNote,
          priority: r.priority,
          privateNote: getNote ? getNote(r.id) || null : null,
          privateRating: getRating ? getRating(r.id) || null : null,
          lastContacted: getContacted ? getContacted(r.id) || null : null,
        })),
        null,
        2,
      );
      mime = "application/json";
      ext = "json";
    } else {
      const escapeCsv = (s: string | null | undefined) => {
        if (s == null) return "";
        const str = String(s);
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      };
      const header = [
        "Name",
        "Acronym",
        "Category",
        "Subcategory",
        "Description",
        "Phone (raw)",
        "Phone (normalized)",
        "Email",
        "Website",
        "Address",
        "Tags",
        "Priority",
        "Source Note",
        "Private Note",
        "Private Rating",
        "Last Contacted",
      ];
      const rows = saved.map((r) =>
        [
          r.name,
          r.acronym,
          CATEGORY_NAME[r.category] ?? r.category,
          r.subcategory,
          r.description,
          r.phoneRaw,
          r.phoneNormalized,
          r.email,
          r.website,
          r.address,
          r.tags,
          r.priority >= 1 ? "Priority" : "",
          r.sourceNote,
          getNote ? getNote(r.id) : "",
          getRating ? String(getRating(r.id) || "") : "",
          getContacted ? getContacted(r.id) : "",
        ]
          .map(escapeCsv)
          .join(","),
      );
      content = [header.join(","), ...rows].join("\n");
      mime = "text/csv";
      ext = "csv";
    }

    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bndr-saved-resources-${new Date().toISOString().slice(0, 10)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${saved.length} resources as ${ext.toUpperCase()}`);
  };

  const handleCopyAll = async () => {
    if (saved.length === 0) {
      toast.error("No saved resources to copy");
      return;
    }
    const text = saved
      .map((r, i) => {
        const phone = r.phoneNormalized
          ? r.phoneNormalized.split("|")[0].trim()
          : null;
        const phoneDisplay = formatPhoneDisplay(phone);
        return `${i + 1}. ${r.name}${r.acronym ? ` (${r.acronym})` : ""}
   ${r.description ?? ""}
   ${phoneDisplay ? "Phone: " + phoneDisplay : ""}
   ${r.email ? "Email: " + r.email : ""}
   ${r.website ? "Web: " + r.website : ""}
   ${r.address ? "Address: " + r.address : ""}`;
      })
      .join("\n\n");
    try {
      await navigator.clipboard.writeText(
        text + "\n\n— Via BNDR. Resource Directory",
      );
      toast.success(`Copied ${saved.length} resources to clipboard`);
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  // Print-friendly PDF handout: opens a clean print window with all saved
  // resources formatted for paper. The user can print or save as PDF.
  const handlePrintPdf = () => {
    if (saved.length === 0) {
      toast.error("No saved resources to print");
      return;
    }
    const printWin = window.open("", "_blank", "width=800,height=900");
    if (!printWin) {
      toast.error("Pop-up blocked — allow pop-ups to print");
      return;
    }
    // Turn 1 Scope C.2 — Use the shared safe print-document builder.
    // All resource fields, notes, and contact logs are HTML-escaped.
    const printResources = saved.map((r) => {
      const phones = r.phoneNormalized
        ? r.phoneNormalized
            .split("|")
            .map((p) => p.trim())
            .filter(Boolean)
            .map((p) => formatPhoneDisplay(p))
            .join(" · ")
        : "";
      const catName = CATEGORY_NAME[r.category] ?? r.category;
      const note = getNote?.(r.id) ?? "";
      const rating = getRating?.(r.id) ?? 0;
      const contacted = getContacted?.(r.id) ?? "";
      const stars = rating > 0 ? "★".repeat(rating) + "☆".repeat(5 - rating) : "";
      const contactLog = [
        contacted ? `Last contacted: ${new Date(contacted + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}` : "",
        stars ? `Rating: ${stars}` : "",
      ].filter(Boolean).join(" · ");
      return {
        name: r.name,
        acronym: r.acronym,
        category: `${catName}${r.subcategory ? " · " + r.subcategory : ""}`,
        description: r.description,
        phoneRaw: phones,
        email: r.email,
        address: r.address,
        website: r.website,
        tags: r.tags,
        sourceNote: r.sourceNote,
        notes: note || null,
        contactLog: contactLog || null,
      };
    });
    const html = buildPrintDocument(
      `BNDR. Saved Resources — ${new Date().toLocaleDateString()}`,
      printResources,
    );
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    toast.success(`Opening print view with ${saved.length} resources`);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l border-border/60 bg-background/95 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border/60 px-6 pb-4 pt-6">
          <SheetTitle className="flex items-center gap-2 text-foreground">
            <span className="flex size-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <BookmarkCheck className="size-4" aria-hidden />
            </span>
            Saved Resources
            <span className="rounded-full bg-primary/20 px-2 py-0.5 text-xs font-medium text-primary">
              {saved.length}
            </span>
          </SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Your curated resource list. Export it as CSV or JSON to share with
            a client, colleague, or for your own records.
          </SheetDescription>
        </SheetHeader>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border/40 px-6 py-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                disabled={saved.length === 0}
                className="gap-1.5 border-border/60 hover:border-primary/40 hover:text-primary"
              >
                <Download className="size-3.5" aria-hidden />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={() => handleExport("csv")}>
                <FileText className="size-4" aria-hidden />
                CSV (spreadsheet)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport("json")}>
                <FileJson className="size-4" aria-hidden />
                JSON (structured)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyAll}>
                <FileText className="size-4" aria-hidden />
                Copy as text
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handlePrintPdf}>
                <Printer className="size-4" aria-hidden />
                Print / PDF handout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                disabled={saved.length < 2}
                className="gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <ArrowUpDown className="size-3.5" aria-hidden />
                Sort:{" "}
                {sortBy === "recent"
                  ? "Recent"
                  : sortBy === "name"
                    ? "Name"
                    : sortBy === "category"
                      ? "Category"
                      : sortBy === "rating"
                        ? "Rating"
                        : "Contacted"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onClick={() => setSortBy("recent")}>
                Recent (date saved)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("name")}>
                Name (A–Z)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("category")}>
                Category
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("rating")}>
                Rating (high→low)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("contacted")}>
                Last contacted (recent→old)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Follow-up needed filter toggle */}
          {getContacted ? (
            <Button
              type="button"
              variant={followUpOnly ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setFollowUpOnly((v) => !v);
                // Mutually exclusive with recentOnly.
                if (!followUpOnly) setRecentOnly(false);
              }}
              disabled={saved.length === 0}
              className={
                followUpOnly
                  ? "gap-1.5 bg-amber-500/20 text-amber-600 hover:bg-amber-500/25 dark:text-amber-400"
                  : "gap-1.5 text-muted-foreground hover:text-foreground"
              }
              aria-pressed={followUpOnly}
              title="Show only resources contacted >7 days ago (or never contacted)"
            >
              <Clock className="size-3.5" aria-hidden />
              Follow-up
              {followUpCount > 0 ? (
                <span
                  className={
                    "ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums " +
                    (followUpOnly
                      ? "bg-amber-600/20 text-amber-700 dark:text-amber-200"
                      : "bg-amber-500/15 text-amber-600 dark:text-amber-400")
                  }
                  aria-label={`${followUpCount} resources need follow-up`}
                >
                  {followUpCount}
                </span>
              ) : null}
            </Button>
          ) : null}
          {/* Recently contacted filter toggle — shows resources contacted ≤7 days ago */}
          {getContacted ? (
            <Button
              type="button"
              variant={recentOnly ? "default" : "ghost"}
              size="sm"
              onClick={() => {
                setRecentOnly((v) => !v);
                // Mutually exclusive with followUpOnly.
                if (!recentOnly) setFollowUpOnly(false);
              }}
              disabled={saved.length === 0}
              className={
                recentOnly
                  ? "gap-1.5 bg-emerald-500/20 text-emerald-600 hover:bg-emerald-500/25 dark:text-emerald-400"
                  : "gap-1.5 text-muted-foreground hover:text-foreground"
              }
              aria-pressed={recentOnly}
              title="Show only resources contacted in the last 7 days"
            >
              <CheckCircle2 className="size-3.5" aria-hidden />
              Recent
              {recentCount > 0 ? (
                <span
                  className={
                    "ml-0.5 rounded-full px-1.5 py-0 text-[10px] font-semibold tabular-nums " +
                    (recentOnly
                      ? "bg-emerald-600/20 text-emerald-700 dark:text-emerald-200"
                      : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400")
                  }
                  aria-label={`${recentCount} resources contacted recently`}
                >
                  {recentCount}
                </span>
              ) : null}
            </Button>
          ) : null}
          {/* Bulk-select toggle */}
          {saved.length >= 2 ? (
            <Button
              type="button"
              variant={bulkMode ? "default" : "ghost"}
              size="sm"
              onClick={() => (bulkMode ? exitBulkMode() : setBulkMode(true))}
              disabled={saved.length === 0}
              className={
                bulkMode
                  ? "gap-1.5 bg-primary/15 text-primary hover:bg-primary/20"
                  : "gap-1.5 text-muted-foreground hover:text-foreground"
              }
              aria-pressed={bulkMode}
              title="Select multiple resources to export or remove in bulk"
            >
              <CheckSquare className="size-3.5" aria-hidden />
              {bulkMode ? `${selectedCount} selected` : "Select"}
            </Button>
          ) : null}
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClear}
                  disabled={saved.length === 0}
                  className="gap-1.5 text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" aria-hidden />
                  Clear all
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Remove all saved resources
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Bulk-action bar — appears when bulk mode is on */}
        <AnimatePresence initial={false}>
          {bulkMode ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="overflow-hidden border-b border-border/60 bg-primary/[0.04]"
            >
              <div className="flex flex-wrap items-center gap-2 px-6 py-2.5">
                <button
                  type="button"
                  onClick={selectedCount === sorted.length ? clearSelection : selectAllFiltered}
                  className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {selectedCount === sorted.length && sorted.length > 0 ? (
                    <CheckSquare className="size-3 text-primary" aria-hidden />
                  ) : (
                    <Square className="size-3" aria-hidden />
                  )}
                  {selectedCount === sorted.length && sorted.length > 0 ? "All selected" : "Select all"}
                </button>
                <span className="text-[11px] text-muted-foreground">
                  {selectedCount} of {sorted.length} selected
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={bulkExportCSV}
                    disabled={selectedCount === 0}
                    className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Download className="size-3" aria-hidden />
                    Export CSV
                  </button>
                  {/* Bulk add to collection — dropdown */}
                  {onToggleCollection && collections ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setBulkCollectionOpen((v) => !v)}
                        disabled={selectedCount === 0}
                        className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-40 disabled:cursor-not-allowed"
                        aria-expanded={bulkCollectionOpen}
                      >
                        <FolderOpen className="size-3" aria-hidden />
                        Add to collection
                      </button>
                      <AnimatePresence>
                        {bulkCollectionOpen ? (
                          <>
                            <button
                              type="button"
                              aria-hidden
                              tabIndex={-1}
                              className="fixed inset-0 z-40 cursor-default"
                              onClick={() => setBulkCollectionOpen(false)}
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
                                  Add {selectedCount} to collection
                                </p>
                              </div>
                              <div className="max-h-48 overflow-y-auto p-1">
                                {collections.length === 0 ? (
                                  <p className="px-2.5 py-3 text-center text-[11px] text-muted-foreground">
                                    No collections yet — create one below
                                  </p>
                                ) : (
                                  collections.map((c) => (
                                    <button
                                      key={c.id}
                                      type="button"
                                      onClick={() => bulkAddToCollection(c.id, c.name)}
                                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs text-foreground transition-colors hover:bg-accent"
                                    >
                                      <FolderOpen className="size-3.5 shrink-0 text-primary" aria-hidden />
                                      <span className="min-w-0 flex-1 truncate">{c.name}</span>
                                      <span className="shrink-0 text-[10px] text-muted-foreground">{c.resourceIds.length}</span>
                                    </button>
                                  ))
                                )}
                              </div>
                              <div className="border-t border-border/40 p-2">
                                <div className="flex gap-1.5">
                                  <Input
                                    value={bulkNewCollectionName}
                                    onChange={(e) => setBulkNewCollectionName(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") bulkCreateAndAdd();
                                      if (e.key === "Escape") {
                                        setBulkNewCollectionName("");
                                        setBulkCollectionOpen(false);
                                      }
                                    }}
                                    placeholder="New collection…"
                                    maxLength={collectionMaxNameLength}
                                    className="h-7 text-xs"
                                    aria-label="New collection name"
                                  />
                                  <button
                                    type="button"
                                    onClick={bulkCreateAndAdd}
                                    disabled={!bulkNewCollectionName.trim()}
                                    className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-[10px] font-medium text-primary transition-colors hover:bg-primary/25 disabled:opacity-40"
                                  >
                                    <Plus className="size-3" aria-hidden />
                                    Create
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          </>
                        ) : null}
                      </AnimatePresence>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Remove ${selectedCount} resource${selectedCount === 1 ? "" : "s"} from saved?`)) {
                        bulkRemove();
                      }
                    }}
                    disabled={selectedCount === 0}
                    className="inline-flex items-center gap-1.5 rounded-md border border-destructive/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-destructive/60 hover:text-destructive disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="size-3" aria-hidden />
                    Remove
                  </button>
                  <button
                    type="button"
                    onClick={exitBulkMode}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="size-3" aria-hidden />
                    Done
                  </button>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        {/* List */}
        <div className="bndr-pill-scroll flex-1 overflow-y-auto px-6 py-4">
          {saved.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted/40">
                <Bookmark className="size-6 text-muted-foreground/60" aria-hidden />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  No saved resources yet
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Click the bookmark icon on any resource card or detail view
                  to save it here for later.
                </p>
              </div>
            </div>
          ) : sorted.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted/40">
                {recentOnly ? (
                  <CheckCircle2 className="size-6 text-muted-foreground/60" aria-hidden />
                ) : (
                  <Clock className="size-6 text-muted-foreground/60" aria-hidden />
                )}
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">
                  {recentOnly
                    ? "No recently contacted resources"
                    : "No follow-up items"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {recentOnly
                    ? "Resources you contact in the last 7 days will appear here."
                    : "All caught up — every saved resource has been contacted recently."}
                </p>
              </div>
            </div>
          ) : (
            <ul className="space-y-2">
              <AnimatePresence initial={false}>
                {sorted.map((r) => {
                  const phone = r.phoneNormalized
                    ? r.phoneNormalized.split("|")[0].trim()
                    : null;
                  const phoneDisplay = formatPhoneDisplay(phone);
                  const catName = CATEGORY_NAME[r.category] ?? r.category;
                  return (
                    <motion.li
                      key={r.id}
                      layout
                      initial={{ opacity: 0, x: 16 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 16 }}
                      transition={{ duration: 0.2 }}
                      className="group rounded-xl border border-border/50 bg-card/40 p-3 transition-colors hover:border-primary/30"
                    >
                      <div className="flex items-start gap-2">
                        {/* Bulk-select checkbox — only in bulk mode */}
                        {bulkMode ? (
                          <button
                            type="button"
                            onClick={() => toggleSelected(r.id)}
                            className="mt-0.5 shrink-0 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                            aria-label={selectedIds.has(r.id) ? `Deselect ${r.name}` : `Select ${r.name}`}
                            aria-pressed={selectedIds.has(r.id)}
                          >
                            {selectedIds.has(r.id) ? (
                              <CheckSquare className="size-4 text-primary" aria-hidden />
                            ) : (
                              <Square className="size-4 text-muted-foreground/50" aria-hidden />
                            )}
                          </button>
                        ) : null}
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="outline"
                              className="border-border/60 text-[10px] text-muted-foreground"
                            >
                              {catName}
                            </Badge>
                            {r.acronym ? (
                              <Badge
                                variant="secondary"
                                className="bg-secondary/70 font-mono text-[9px] uppercase"
                              >
                                {r.acronym}
                              </Badge>
                            ) : null}
                            {r.priority >= 1 ? (
                              <Badge className="border border-primary/30 bg-primary/15 px-1.5 py-0 text-[9px] text-primary">
                                Priority
                              </Badge>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onOpen(r);
                              onOpenChange(false);
                            }}
                            className="mt-1.5 block w-full text-left text-sm font-medium text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline"
                          >
                            {r.name}
                          </button>
                          {r.description ? (
                            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                              {r.description}
                            </p>
                          ) : null}
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                            {phoneDisplay ? (
                              <a
                                href={`tel:${phone}`}
                                className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
                              >
                                <Phone className="size-3" aria-hidden />
                                <span className="font-mono tabular-nums">
                                  {phoneDisplay}
                                </span>
                              </a>
                            ) : null}
                            {r.email ? (
                              <a
                                href={`mailto:${r.email}`}
                                className="inline-flex items-center gap-1 truncate text-muted-foreground transition-colors hover:text-primary"
                              >
                                <Mail className="size-3" aria-hidden />
                                <span className="truncate">{r.email}</span>
                              </a>
                            ) : null}
                            {r.website ? (
                              <a
                                href={r.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 truncate text-muted-foreground transition-colors hover:text-primary"
                              >
                                <Globe className="size-3" aria-hidden />
                                <span className="truncate">
                                  {r.website
                                    .replace(/^https?:\/\//, "")
                                    .replace(/\/$/, "")}
                                </span>
                                <ExternalLink className="size-2.5 opacity-60" aria-hidden />
                              </a>
                            ) : null}
                          </div>
                        </div>
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                onClick={() => onToggle(r)}
                                aria-label={`Remove ${r.name} from saved`}
                                className="shrink-0 rounded-full p-1.5 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
                              >
                                <X className="size-4" aria-hidden />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              Remove from saved
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      {/* Star rating (if ratings hook is wired) */}
                      {getRating && onSetRating ? (
                        <div className="mt-2">
                          <StarRating
                            resourceId={r.id}
                            resourceName={r.name}
                            rating={getRating(r.id)}
                            max={ratingMax}
                            onSet={onSetRating}
                          />
                        </div>
                      ) : null}
                      {/* Last contacted date (if contacted hook is wired) */}
                      {getContacted && onSetContacted && onClearContacted ? (
                        <ContactDateEditor
                          resourceId={r.id}
                          resourceName={r.name}
                          date={getContacted(r.id)}
                          onSet={onSetContacted}
                          onClear={onClearContacted}
                        />
                      ) : null}
                      {/* Private note editor (if notes hook is wired) */}
                      {getNote && onSetNote && onDeleteNote ? (
                        <NoteEditor
                          resourceId={r.id}
                          resourceName={r.name}
                          note={getNote(r.id)}
                          maxLength={noteMaxLength}
                          onSave={onSetNote}
                          onDelete={onDeleteNote}
                        />
                      ) : null}
                      {/* Collections: badges + add-to-collection picker */}
                      {collectionsForResource && onToggleCollection ? (
                        <div className="mt-2 space-y-1.5">
                          <CollectionBadges
                            collections={collectionsForResource(r.id)}
                          />
                          <AddToCollectionPicker
                            collections={collections}
                            isInCollection={(cid) =>
                              collectionsForResource(r.id).some((c) => c.id === cid)
                            }
                            onToggle={(cid) => onToggleCollection(cid, r.id)}
                            onCreate={(name) => onCreateCollection?.(name)}
                            maxNameLength={collectionMaxNameLength}
                          />
                        </div>
                      ) : null}
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ul>
          )}
        </div>

        {saved.length > 0 ? (
          <div className="border-t border-border/40 px-6 py-3">
            <p className="text-[11px] leading-relaxed text-muted-foreground/70">
              {saved.length} saved · localStorage only (not sent to any server).
              Export to keep a permanent copy.
            </p>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
