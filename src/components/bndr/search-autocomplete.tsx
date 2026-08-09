"use client";

import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Tag, Folder, FileText, CornerDownLeft, TrendingUp, Clock, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CATEGORIES, type CategorySlug } from "@/lib/types";

interface SuggestionCategory {
  slug: CategorySlug;
  name: string;
  shortName: string;
  count: number;
}
interface SuggestionTag {
  tag: string;
  count: number;
}
interface SuggestionName {
  id: string;
  name: string;
  acronym: string | null;
  category: CategorySlug;
  priority: number;
}
interface Suggestions {
  categories: SuggestionCategory[];
  tags: SuggestionTag[];
  names: SuggestionName[];
}

interface SearchAutocompleteProps {
  query: string;
  onQueryChange: (q: string) => void;
  onSelectCategory: (slug: CategorySlug) => void;
  onSelectTag: (tag: string) => void;
  onSelectName: (id: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;
  recentSearches?: string[];
  onClearSearches?: () => void;
}

const CATEGORY_SHORT: Record<CategorySlug, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.shortName]),
) as Record<CategorySlug, string>;

/**
 * Search input with live autocomplete dropdown. As the user types (≥2 chars),
 * shows matching categories, tags, and resource names. Each suggestion is
 * actionable: pick a category → filters grid; pick a tag → fills search;
 * pick a name → opens detail dialog.
 *
 * When the input is focused and empty (or < 2 chars), shows recent search
 * history instead (if any).
 *
 * Keyboard: Up/Down to navigate, Enter to select highlighted, Esc to close.
 */
export function SearchAutocomplete({
  query,
  onQueryChange,
  onSelectCategory,
  onSelectTag,
  onSelectName,
  searchInputRef,
  recentSearches = [],
  onClearSearches,
}: SearchAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const internalRef = useRef<HTMLInputElement | null>(null);
  const inputRef = searchInputRef ?? internalRef;

  // Fetch suggestions (debounced via React Query's 150ms default + 2-char gate)
  const { data } = useQuery<Suggestions>({
    queryKey: ["suggest", query],
    queryFn: async () => {
      const res = await fetch(`/api/suggest?q=${encodeURIComponent(query.trim())}&limit=6`);
      if (!res.ok) throw new Error("suggest failed");
      return res.json();
    },
    enabled: query.trim().length >= 2,
    staleTime: 30_000,
  });

  const suggestions = data ?? { categories: [], tags: [], names: [] };

  // Flatten into a single navigable list for keyboard up/down
  const flat: Array<
    | { kind: "category"; data: SuggestionCategory }
    | { kind: "tag"; data: SuggestionTag }
    | { kind: "name"; data: SuggestionName }
  > = [
    ...suggestions.categories.map((data) => ({ kind: "category" as const, data })),
    ...suggestions.tags.map((data) => ({ kind: "tag" as const, data })),
    ...suggestions.names.map((data) => ({ kind: "name" as const, data })),
  ];

  const totalSuggestions = flat.length;
  const hasAny = totalSuggestions > 0;

  // Reset highlight when the query changes — derive rather than effect.
  const safeHighlight = Math.min(highlighted, Math.max(0, totalSuggestions - 1));

  const handleSelect = (index: number) => {
    const item = flat[index];
    if (!item) return;
    if (item.kind === "category") {
      onSelectCategory(item.data.slug);
      setOpen(false);
      inputRef.current?.blur();
    } else if (item.kind === "tag") {
      onQueryChange(item.data.tag);
      setOpen(false);
      inputRef.current?.blur();
    } else if (item.kind === "name") {
      onSelectName(item.data.id);
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || !hasAny) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => (h + 1) % totalSuggestions);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => (h - 1 + totalSuggestions) % totalSuggestions);
    } else if (e.key === "Enter" && hasAny) {
      // Only intercept Enter if the dropdown is open AND the user has been
      // navigating it (otherwise let the normal search run).
      e.preventDefault();
      handleSelect(safeHighlight);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => {
          onQueryChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={onKeyDown}
        placeholder="Search by name, acronym, tag, location, or need…"
        aria-label="Search resources"
        aria-expanded={open && hasAny}
        aria-controls="search-suggestions"
        role="combobox"
        aria-autocomplete="list"
        className="bndr-search bndr-search-shadow h-14 rounded-full border-border bg-card/60 pl-12 pr-12 text-base backdrop-blur-xl transition-all duration-300 placeholder:text-muted-foreground focus:border-primary/50 focus:bg-card/80 focus:shadow-[var(--shadow-accent-strong)]"
      />
      {/* Clear button — one-click reset when there's a query */}
      {query.trim().length > 0 ? (
        <button
          type="button"
          onClick={() => {
            onQueryChange("");
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          aria-label="Clear search"
          title="Clear search"
        >
          <X className="size-4" aria-hidden />
        </button>
      ) : null}

      <AnimatePresence>
        {/* Recent searches (when focused + query < 2 chars) */}
        {open && query.trim().length < 2 && recentSearches.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border/60 bg-popover/95 shadow-[var(--shadow-surface-hover)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between px-3 py-1.5">
              <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                Recent searches
              </p>
              {onClearSearches ? (
                <button
                  type="button"
                  onClick={onClearSearches}
                  className="text-[10px] text-muted-foreground/60 transition-colors hover:text-primary"
                >
                  Clear
                </button>
              ) : null}
            </div>
            {recentSearches.map((s, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  onQueryChange(s);
                }}
                className="flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/40"
              >
                <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                  <Clock className="size-4 text-muted-foreground" aria-hidden />
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                  {s}
                </span>
                <CornerDownLeft className="size-3.5 shrink-0 text-muted-foreground/40" aria-hidden />
              </button>
            ))}
          </motion.div>
        ) : null}

        {/* Live suggestions (when typing ≥ 2 chars) */}
        {open && hasAny && query.trim().length >= 2 ? (
          <motion.div
            id="search-suggestions"
            role="listbox"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-border/60 bg-popover/95 shadow-[var(--shadow-surface-hover)] backdrop-blur-xl"
          >
            {/* Categories */}
            {suggestions.categories.length > 0 ? (
              <SuggestionGroup label="Categories">
                {suggestions.categories.map((c, i) => {
                  const idx = flat.findIndex(
                    (f) => f.kind === "category" && f.data.slug === c.slug,
                  );
                  return (
                    <SuggestionItem
                      key={`cat-${c.slug}`}
                      icon={<Folder className="size-4 text-primary" aria-hidden />}
                      title={c.shortName}
                      subtitle={c.name}
                      meta={`${c.count} resources`}
                      highlighted={safeHighlight === idx}
                      onMouseEnter={() => setHighlighted(idx)}
                      onClick={() => handleSelect(idx)}
                    />
                  );
                })}
              </SuggestionGroup>
            ) : null}

            {/* Tags */}
            {suggestions.tags.length > 0 ? (
              <SuggestionGroup label="Tags">
                {suggestions.tags.map((t) => {
                  const idx = flat.findIndex(
                    (f) => f.kind === "tag" && f.data.tag === t.tag,
                  );
                  return (
                    <SuggestionItem
                      key={`tag-${t.tag}`}
                      icon={<Tag className="size-4 text-primary" aria-hidden />}
                      title={t.tag}
                      meta={`${t.count} ${t.count === 1 ? "resource" : "resources"}`}
                      highlighted={safeHighlight === idx}
                      onMouseEnter={() => setHighlighted(idx)}
                      onClick={() => handleSelect(idx)}
                    />
                  );
                })}
              </SuggestionGroup>
            ) : null}

            {/* Names */}
            {suggestions.names.length > 0 ? (
              <SuggestionGroup label="Resources">
                {suggestions.names.map((n) => {
                  const idx = flat.findIndex(
                    (f) => f.kind === "name" && f.data.id === n.id,
                  );
                  return (
                    <SuggestionItem
                      key={`name-${n.id}`}
                      icon={
                        n.priority >= 1 ? (
                          <TrendingUp className="size-4 text-primary" aria-hidden />
                        ) : (
                          <FileText className="size-4 text-muted-foreground" aria-hidden />
                        )
                      }
                      title={n.name}
                      meta={n.acronym ? n.acronym : CATEGORY_SHORT[n.category]}
                      highlighted={safeHighlight === idx}
                      onMouseEnter={() => setHighlighted(idx)}
                      onClick={() => handleSelect(idx)}
                    />
                  );
                })}
              </SuggestionGroup>
            ) : null}

            {/* Footer hint */}
            <div className="border-t border-border/40 px-3 py-1.5 text-[10px] text-muted-foreground/60">
              <kbd className="rounded border border-border/60 bg-muted/40 px-1 py-0.5 font-mono">↑↓</kbd>{" "}
              navigate{" "}
              <kbd className="ml-1 rounded border border-border/60 bg-muted/40 px-1 py-0.5 font-mono">↵</kbd>{" "}
              select{" "}
              <kbd className="ml-1 rounded border border-border/60 bg-muted/40 px-1 py-0.5 font-mono">Esc</kbd>{" "}
              close
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function SuggestionGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-1">
      <p className="px-3 py-1 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
        {label}
      </p>
      {children}
    </div>
  );
}

function SuggestionItem({
  icon,
  title,
  subtitle,
  meta,
  highlighted,
  onMouseEnter,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  meta?: string;
  highlighted: boolean;
  onMouseEnter: () => void;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={highlighted}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      className={
        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors " +
        (highlighted ? "bg-primary/10" : "hover:bg-muted/40")
      }
    >
      <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted/50">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-foreground">{title}</p>
        {subtitle ? (
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        ) : null}
      </div>
      {meta ? (
        <span className="shrink-0 text-[11px] text-muted-foreground/70">{meta}</span>
      ) : null}
      {highlighted ? (
        <CornerDownLeft className="size-3.5 shrink-0 text-primary" aria-hidden />
      ) : null}
    </button>
  );
}
