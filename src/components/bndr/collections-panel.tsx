"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ScrollArea,
} from "@/components/ui/scroll-area";
import {
  FolderPlus,
  Folder,
  Trash2,
  Pencil,
  Check,
  X,
  ArrowUpRight,
  Plus,
  Inbox,
  Tag,
  Download,
  FileJson,
  FileSpreadsheet,
} from "lucide-react";
import type { Resource, CategorySlug } from "@/lib/types";
import { CATEGORIES } from "@/lib/types";
import type { Collection } from "./use-collections";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { csvCell } from "@/lib/export-safety";

/** CSV-escape a single field. Delegates to the shared formula-safe encoder
 * (Turn 1 Scope C.3 — RFC-4180 quoting + formula neutralization). */
function csvEscape(v: string | number | null | undefined): string {
  return csvCell(v == null ? null : String(v));
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

const CATEGORY_NAME: Record<CategorySlug, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.shortName]),
) as Record<CategorySlug, string>;

/** Sanitize a collection name into a filesystem-safe slug. */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "collection";
}

interface CollectionsPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  collections: Collection[];
  saved: Resource[];
  onCreate: (name: string) => Collection | null;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onRemoveResource: (collectionId: string, resourceId: string) => void;
  onOpenResource: (r: Resource) => void;
  maxCollections: number;
  maxNameLength: number;
}

/**
 * Collections panel — lets advocates organize saved resources into named
 * groups (e.g. per-client). Opens as a right-side Sheet. Each collection
 * shows its resource count, a rename field, and an expandable list of its
 * resources with quick-open + remove actions.
 */
export function CollectionsPanel({
  open,
  onOpenChange,
  collections,
  saved,
  onCreate,
  onRename,
  onDelete,
  onRemoveResource,
  onOpenResource,
  maxCollections,
  maxNameLength,
}: CollectionsPanelProps) {
  const [newName, setNewName] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  // ---- Per-collection export helpers ---------------------------------------
  const exportCollectionCSV = (col: Collection, items: Resource[]) => {
    const rows: string[][] = [
      ["Name", "Acronym", "Category", "Phone", "Email", "Website", "Address", "Tags"],
    ];
    for (const r of items) {
      rows.push([
        r.name,
        r.acronym ?? "",
        CATEGORY_NAME[r.category as CategorySlug] ?? r.category,
        formatPhone(r.phoneNormalized),
        r.email ?? "",
        r.website ?? "",
        r.address ?? "",
        r.tags ?? "",
      ]);
    }
    const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(`bndr-${slugify(col.name)}-${stamp}.csv`, csv, "text/csv;charset=utf-8");
    toast.success(`Exported "${col.name}" (${items.length} resources) to CSV`);
  };

  const exportCollectionJSON = (col: Collection, items: Resource[]) => {
    const data = {
      exportedAt: new Date().toISOString(),
      exportType: "bndr-collection",
      collection: {
        id: col.id,
        name: col.name,
        createdAt: col.createdAt,
        updatedAt: col.updatedAt,
      },
      count: items.length,
      resources: items.map((r) => ({
        id: r.id,
        name: r.name,
        acronym: r.acronym ?? null,
        category: r.category,
        categoryLabel: CATEGORY_NAME[r.category as CategorySlug] ?? r.category,
        phone: formatPhone(r.phoneNormalized),
        email: r.email ?? null,
        website: r.website ?? null,
        address: r.address ?? null,
        tags: r.tags ?? null,
        description: r.description ?? null,
      })),
    };
    const stamp = new Date().toISOString().slice(0, 10);
    downloadFile(
      `bndr-${slugify(col.name)}-${stamp}.json`,
      JSON.stringify(data, null, 2),
      "application/json",
    );
    toast.success(`Exported "${col.name}" (${items.length} resources) to JSON`);
  };

  const handleCreate = () => {
    const col = onCreate(newName);
    if (col) {
      setNewName("");
      setExpandedId(col.id);
    }
  };

  const startEdit = (col: Collection) => {
    setEditingId(col.id);
    setEditName(col.name);
  };

  const commitEdit = () => {
    if (editingId) {
      onRename(editingId, editName);
    }
    setEditingId(null);
    setEditName("");
  };

  const savedById = useMemo(() => {
    const m = new Map<string, Resource>();
    for (const r of saved) m.set(r.id, r);
    return m;
  }, [saved]);

  const atLimit = collections.length >= maxCollections;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 border-l border-border/60 bg-background/95 p-0 sm:max-w-lg"
      >
        <SheetHeader className="border-b border-border/60 bg-card/40 px-6 pb-5 pt-6">
          <SheetTitle className="flex items-center gap-2.5 text-lg text-foreground">
            <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Folder className="size-4" aria-hidden />
            </span>
            Collections
          </SheetTitle>
          <SheetDescription className="text-muted-foreground">
            Organize saved resources into named groups for different clients or cases.
          </SheetDescription>
        </SheetHeader>

        {/* Create new collection */}
        <div className="border-b border-border/60 px-6 py-4">
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newName.trim()) handleCreate();
              }}
              placeholder={atLimit ? `Limit reached (${maxCollections})` : "New collection name…"}
              disabled={atLimit}
              maxLength={maxNameLength}
              className="h-10 bg-card/60"
              aria-label="New collection name"
            />
            <Button
              type="button"
              onClick={handleCreate}
              disabled={!newName.trim() || atLimit}
              size="sm"
              className="shrink-0 gap-1.5"
            >
              <FolderPlus className="size-4" aria-hidden />
              <span className="hidden sm:inline">Create</span>
            </Button>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {collections.length} / {maxCollections} collections used
          </p>
        </div>

        <ScrollArea className="bndr-scroll flex-1">
          <div className="px-6 py-4">
            {collections.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <Inbox className="size-8 text-muted-foreground/50" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-foreground">No collections yet</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Create a collection above, then add saved resources to it
                    from the resource detail dialog or saved panel.
                  </p>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {collections.map((col) => {
                  const isExpanded = expandedId === col.id;
                  const isEditing = editingId === col.id;
                  const resources = col.resourceIds
                    .map((id) => savedById.get(id))
                    .filter((r): r is Resource => Boolean(r));
                  const orphanCount = col.resourceIds.length - resources.length;
                  return (
                    <li
                      key={col.id}
                      className="bndr-card overflow-hidden rounded-xl"
                    >
                      {/* Collection header row */}
                      <div className="flex items-center gap-2 p-3">
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : col.id)}
                          className="flex min-w-0 flex-1 items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-md"
                          aria-expanded={isExpanded}
                          aria-label={`${col.name} — ${col.resourceIds.length} resources`}
                        >
                          <Folder
                            className={cn(
                              "size-4 shrink-0 transition-colors",
                              isExpanded ? "text-primary" : "text-muted-foreground",
                            )}
                            aria-hidden
                          />
                          {isEditing ? (
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitEdit();
                                if (e.key === "Escape") {
                                  setEditingId(null);
                                  setEditName("");
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              autoFocus
                              maxLength={maxNameLength}
                              className="h-7 py-0 text-sm"
                            />
                          ) : (
                            <span className="truncate text-sm font-medium text-foreground">
                              {col.name}
                            </span>
                          )}
                          <span className="ml-auto shrink-0 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] font-medium tabular-nums text-muted-foreground">
                            {col.resourceIds.length}
                          </span>
                        </button>
                        {isEditing ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 shrink-0 text-primary hover:bg-primary/10"
                              onClick={commitEdit}
                              aria-label="Save name"
                            >
                              <Check className="size-3.5" aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 shrink-0 text-muted-foreground hover:bg-muted/50"
                              onClick={() => {
                                setEditingId(null);
                                setEditName("");
                              }}
                              aria-label="Cancel rename"
                            >
                              <X className="size-3.5" aria-hidden />
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 shrink-0 text-muted-foreground hover:text-primary hover:bg-transparent"
                              onClick={() => startEdit(col)}
                              aria-label={`Rename ${col.name}`}
                            >
                              <Pencil className="size-3.5" aria-hidden />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-7 shrink-0 text-muted-foreground hover:text-destructive hover:bg-transparent"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Delete "${col.name}"? This removes the collection but not the saved resources themselves.`,
                                  )
                                ) {
                                  onDelete(col.id);
                                }
                              }}
                              aria-label={`Delete ${col.name}`}
                            >
                              <Trash2 className="size-3.5" aria-hidden />
                            </Button>
                          </>
                        )}
                      </div>

                      {/* Expanded resource list */}
                      <AnimatePresence initial={false}>
                        {isExpanded ? (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            className="overflow-hidden"
                          >
                            <div className="border-t border-border/50 px-3 py-2">
                              {resources.length === 0 ? (
                                <p className="py-4 text-center text-xs text-muted-foreground">
                                  No saved resources in this collection yet.
                                  {orphanCount > 0
                                    ? ` (${orphanCount} resource${orphanCount === 1 ? "" : "s"} no longer saved — they were removed.)`
                                    : ""}
                                </p>
                              ) : (
                                <>
                                {/* Export toolbar */}
                                <div className="mb-2 flex items-center justify-between gap-2">
                                  <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                                    {resources.length} resource{resources.length === 1 ? "" : "s"}
                                  </p>
                                  <div className="flex items-center gap-1">
                                    <button
                                      type="button"
                                      onClick={() => exportCollectionCSV(col, resources)}
                                      className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                                      aria-label={`Export ${col.name} as CSV`}
                                      title="Export as CSV spreadsheet"
                                    >
                                      <FileSpreadsheet className="size-3" aria-hidden />
                                      CSV
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => exportCollectionJSON(col, resources)}
                                      className="inline-flex items-center gap-1 rounded-md border border-border/60 px-2 py-1 text-[10px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                                      aria-label={`Export ${col.name} as JSON`}
                                      title="Export as JSON data"
                                    >
                                      <FileJson className="size-3" aria-hidden />
                                      JSON
                                    </button>
                                  </div>
                                </div>
                                <ul className="space-y-1">
                                  {resources.map((r) => (
                                    <li
                                      key={r.id}
                                      className="group flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/40"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onOpenChange(false);
                                          onOpenResource(r);
                                        }}
                                        className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 rounded-md"
                                        aria-label={`Open ${r.name}`}
                                      >
                                        <span className="min-w-0 flex-1">
                                          <span className="block truncate text-xs font-medium text-foreground">
                                            {r.name}
                                          </span>
                                          {r.acronym ? (
                                            <span className="block truncate text-[10px] text-muted-foreground font-mono uppercase">
                                              {r.acronym}
                                            </span>
                                          ) : null}
                                        </span>
                                        <ArrowUpRight
                                          className="size-3 shrink-0 text-muted-foreground/50 transition-colors group-hover:text-primary"
                                          aria-hidden
                                        />
                                      </button>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        className="size-6 shrink-0 text-muted-foreground/60 hover:text-destructive hover:bg-transparent"
                                        onClick={() => onRemoveResource(col.id, r.id)}
                                        aria-label={`Remove ${r.name} from ${col.name}`}
                                      >
                                        <X className="size-3" aria-hidden />
                                      </Button>
                                    </li>
                                  ))}
                                </ul>
                                </>
                              )}
                              {orphanCount > 0 && resources.length > 0 ? (
                                <p className="mt-2 border-t border-border/40 pt-2 text-[10px] text-muted-foreground/70">
                                  + {orphanCount} resource{orphanCount === 1 ? "" : "s"} no longer saved
                                </p>
                              ) : null}
                            </div>
                          </motion.div>
                        ) : null}
                      </AnimatePresence>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </ScrollArea>

        {/* Footer hint */}
        <div className="border-t border-border/60 bg-card/30 px-6 py-3">
          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Tag className="size-3" aria-hidden />
            Tip: add resources to a collection from the saved panel or detail dialog.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** A compact badge row showing which collections a resource belongs to. */
export function CollectionBadges({
  collections,
  onRemove,
}: {
  collections: Collection[];
  onRemove?: (collectionId: string, resourceId: string) => void;
}) {
  if (collections.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {collections.slice(0, 4).map((c) => (
        <span
          key={c.id}
          className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
          title={c.name}
        >
          <Folder className="size-2.5" aria-hidden />
          <span className="max-w-[120px] truncate">{c.name}</span>
        </span>
      ))}
      {collections.length > 4 ? (
        <span className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground">
          +{collections.length - 4}
        </span>
      ) : null}
    </div>
  );
}

/** A small "add to collection" picker — used in the detail dialog + saved panel. */
export function AddToCollectionPicker({
  collections,
  isInCollection,
  onToggle,
  onCreate,
  maxNameLength,
}: {
  collections: Collection[];
  isInCollection: (collectionId: string) => boolean;
  onToggle: (collectionId: string) => void;
  onCreate: (name: string) => void;
  maxNameLength: number;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");

  return (
    <div className="space-y-1.5">
      {collections.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No collections yet — create one below.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {collections.map((c) => {
            const inCol = isInCollection(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onToggle(c.id)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  inCol
                    ? "border-primary/40 bg-primary/15 text-primary"
                    : "border-border bg-card/40 text-muted-foreground hover:border-primary/30 hover:text-primary",
                )}
                aria-pressed={inCol}
                title={inCol ? `Remove from ${c.name}` : `Add to ${c.name}`}
              >
                {inCol ? (
                  <Check className="size-3" aria-hidden />
                ) : (
                  <Plus className="size-3" aria-hidden />
                )}
                <span className="max-w-[140px] truncate">{c.name}</span>
              </button>
            );
          })}
        </div>
      )}
      {showCreate ? (
        <div className="flex gap-1.5">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                onCreate(newName);
                setNewName("");
                setShowCreate(false);
              }
              if (e.key === "Escape") {
                setShowCreate(false);
                setNewName("");
              }
            }}
            placeholder="Collection name…"
            autoFocus
            maxLength={maxNameLength}
            className="h-8 text-xs"
            aria-label="New collection name"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 shrink-0"
            onClick={() => {
              if (newName.trim()) {
                onCreate(newName);
                setNewName("");
                setShowCreate(false);
              }
            }}
          >
            <Check className="size-3" aria-hidden />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-8 shrink-0"
            onClick={() => {
              setShowCreate(false);
              setNewName("");
            }}
          >
            <X className="size-3" aria-hidden />
          </Button>
        </div>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1 px-2 text-[11px] text-muted-foreground hover:text-primary"
          onClick={() => setShowCreate(true)}
        >
          <FolderPlus className="size-3" aria-hidden />
          New collection
        </Button>
      )}
    </div>
  );
}
