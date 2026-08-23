"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { GrainOverlay } from "@/components/bndr/grain-overlay";
import { SiteHeader } from "@/components/bndr/site-header";
import { Hero } from "@/components/bndr/hero";
import { RecentlyViewedStrip } from "@/components/bndr/recently-viewed-strip";
import { StatsStrip } from "@/components/bndr/stats-strip";
import { CategoryPills } from "@/components/bndr/category-pills";
import { CategoryGrid } from "@/components/bndr/category-grid";
import { CountBar } from "@/components/bndr/count-bar";
import { ResourceGrid } from "@/components/bndr/resource-grid";
import { ResourceDetailDialog } from "@/components/bndr/resource-detail-dialog";
import { SiteFooter } from "@/components/bndr/site-footer";
// Turn 1 Scope A.6 — AdminDashboard moved to server-gated /admin route.
// Client state is never authorization.
import { CrisisHelpButton } from "@/components/bndr/crisis-help-button";
import { QuickAccess } from "@/components/bndr/quick-access";
import { BackToTop } from "@/components/bndr/back-to-top";
import { SectionNav } from "@/components/bndr/section-nav";
import { RecentlyViewed } from "@/components/bndr/recently-viewed";
import { ActiveFilters } from "@/components/bndr/active-filters";
import { useRecentlyViewed } from "@/components/bndr/use-recently-viewed";
import { useSavedResources } from "@/components/bndr/use-saved-resources";
import { useCompare } from "@/components/bndr/use-compare";
import { useResourceNotes } from "@/components/bndr/use-resource-notes";
import { useResourceRatings } from "@/components/bndr/use-resource-ratings";
import { useSearchHistory } from "@/components/bndr/use-search-history";
import { SavedResourcesPanel } from "@/components/bndr/saved-resources-panel";
import { CategoryModal } from "@/components/bndr/category-modal";
import { CompareModal } from "@/components/bndr/compare-modal";
import { CompareTray } from "@/components/bndr/compare-tray";
import { ShortcutHelp } from "@/components/bndr/shortcut-help";
import { RecentlyViewedPanel } from "@/components/bndr/recently-viewed-panel";
import { AdvocateDashboard } from "@/components/bndr/advocate-dashboard";
import { CollectionsPanel } from "@/components/bndr/collections-panel";
import { useCollections } from "@/components/bndr/use-collections";
import { useContactLog } from "@/components/bndr/use-contact-log";
import { useDefaultContactMethod } from "@/components/bndr/use-default-contact-method";
import { useWeeklyGoal } from "@/components/bndr/use-weekly-goal";
import { useGoalCelebration } from "@/components/bndr/use-goal-celebration";
import { useOutreachStats } from "@/components/bndr/use-outreach-stats";
import { fetchResources, fetchStats, fetchResource } from "@/lib/api";
import { CATEGORIES, type Resource, type CategorySlug } from "@/lib/types";
import { toast } from "sonner";

/**
 * Parse the current URL search params into directory state.
 * Supports: ?q=<query>&cat=<category>&pri=1
 */
function parseUrlState(): {
  query: string;
  category: CategorySlug | "all";
  priorityOnly: boolean;
} {
  if (typeof window === "undefined")
    return { query: "", category: "all", priorityOnly: false };
  const sp = new URLSearchParams(window.location.search);
  const q = sp.get("q") ?? "";
  const cat = sp.get("cat") ?? "all";
  const pri = sp.get("pri") === "1";
  // Validate category slug
  const validSlugs = new Set(CATEGORIES.map((c) => c.slug));
  const category = (cat === "all" || validSlugs.has(cat as CategorySlug)
    ? cat
    : "all") as CategorySlug | "all";
  return { query: q, category, priorityOnly: pri };
}

/**
 * Serialize directory state into URL search params (for deep-linking).
 */
function serializeUrlState(
  query: string,
  category: CategorySlug | "all",
  priorityOnly: boolean,
): string {
  const sp = new URLSearchParams();
  if (query.trim()) sp.set("q", query.trim());
  if (category !== "all") sp.set("cat", category);
  if (priorityOnly) sp.set("pri", "1");
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function Directory() {
  // ---- Initialize state empty (SSR-safe), then sync from URL in an effect --
  // Reading window.location.search during render causes a hydration mismatch
  // (server renders "All resources" while client renders "Results for …").
  // Start empty and let the effect below hydrate from the URL on mount.
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [category, setCategory] = useState<CategorySlug | "all">("all");
  const [priorityOnly, setPriorityOnly] = useState(false);

  // ---- Hydrate from URL on mount (client-only) -----------------------------
  // A `hydrated` ref defers the URL-write effect below until after we've read
  // the initial URL, so we don't wipe ?q=… on mount before reading it.
  const hydratedRef = useRef(false);
  useEffect(() => {
    const s = parseUrlState();
    // This one-time client hydration intentionally synchronizes URL state after SSR.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuery(s.query);
    setDebouncedQuery(s.query.trim());
    setCategory(s.category);
    setPriorityOnly(s.priorityOnly);
    hydratedRef.current = true;
  }, []);
  const [selected, setSelected] = useState<Resource | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [categoryModal, setCategoryModal] = useState<CategorySlug | null>(null);
  const [shortcutHelpOpen, setShortcutHelpOpen] = useState(false);
  const [recentOpen, setRecentOpen] = useState(false);
  const [advocateDashboardOpen, setAdvocateDashboardOpen] = useState(false);
  const [collectionsOpen, setCollectionsOpen] = useState(false);
  const [renderedAt] = useState(() => Date.now());

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const { recent, addRecent, clearRecent } = useRecentlyViewed();
  const { saved, isSaved, toggleSaved, clearSaved } = useSavedResources();
  const compare = useCompare();
  const notes = useResourceNotes();
  const ratings = useResourceRatings();
  const searchHistory = useSearchHistory();
  const { addSearch, clearHistory: clearSearchHistory, history: searchHistoryItems } = searchHistory;
  const collections = useCollections();
  const contactLog = useContactLog();
  const defaultContactMethod = useDefaultContactMethod();
  const weeklyGoal = useWeeklyGoal();

  // Fire a celebration toast when the weekly goal is met — even when the
  // Advocate Dashboard isn't open (e.g. right after logging a contact from
  // the resource detail dialog).
  useGoalCelebration({
    saved,
    contactLogs: contactLog.logs,
    weeklyGoal: weeklyGoal.goal,
  });

  // Shared outreach stats — used by the site header (streak + goal ring) and
  // available for any other component that needs them.
  const outreachStats = useOutreachStats({
    saved,
    contactLogs: contactLog.logs,
    weeklyGoal: weeklyGoal.goal,
  });

  // ---- "Last contacted" — derived from the contact-log (single source of truth)
  // Previously this was a separate useLastContacted() hook with its own
  // localStorage key, requiring manual sync. Now it's derived from contactLog
  // so the two can never drift. The derived object preserves the same API
  // (dates / getContacted / setContacted / clearContacted) so all consumers
  // work unchanged.
  const lastContacted = useMemo(
    () => ({
      dates: Object.fromEntries(
        Object.entries(contactLog.logs).map(([id, entries]) => {
          const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
          return [id, sorted[0]?.date ?? ""];
        }),
      ),
      getContacted: (id: string) => contactLog.getLastContactDate(id),
      setContacted: (id: string, dateStr: string) => {
        if (!dateStr) {
          contactLog.clearLog(id);
          return;
        }
        const existing = contactLog.getEntries(id);
        if (!existing.some((e) => e.date === dateStr.slice(0, 10))) {
          contactLog.addEntry(id, dateStr);
        }
      },
      clearContacted: (id: string) => {
        const entries = contactLog.getEntries(id);
        if (entries.length > 0) contactLog.removeEntry(id, entries[0].id);
      },
    }),
    [contactLog],
  );

  // Debounce search input (300ms) + record search history.
  useEffect(() => {
    const t = setTimeout(() => {
      const trimmed = query.trim();
      setDebouncedQuery(trimmed);
      if (trimmed.length >= 2) {
        addSearch(trimmed);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query, addSearch]);

  // ---- URL deep-linking: update URL when state changes ---------------------
  // Skipped on the first render pass (before hydration) to preserve any
  // ?q=… / ?cat=… / ?pri=1 the user arrived with.
  useEffect(() => {
    if (!hydratedRef.current) return;
    const url = serializeUrlState(debouncedQuery, category, priorityOnly);
    const newUrl = url || window.location.pathname;
    window.history.replaceState(null, "", newUrl);
  }, [debouncedQuery, category, priorityOnly]);

  // ---- Back/forward button support -----------------------------------------
  useEffect(() => {
    const onPop = () => {
      const s = parseUrlState();
      setQuery(s.query);
      setCategory(s.category);
      setPriorityOnly(s.priorityOnly);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const { data, isLoading, isFetching, isError, refetch } = useQuery({
    queryKey: ["resources", debouncedQuery, category, priorityOnly],
    queryFn: () =>
      fetchResources({
        q: debouncedQuery,
        category,
        priorityOnly,
        limit: 500,
        offset: 0,
      }),
  });

  const { data: stats } = useQuery({
    queryKey: ["stats"],
    queryFn: fetchStats,
  });

  const resources = data?.resources ?? [];
  const totalCount = data?.total ?? 0;

  // Per-category counts for the pill bar.
  const categoryCounts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of CATEGORIES) map[c.slug] = 0;
    if (stats?.byCategory) {
      for (const row of stats.byCategory) {
        map[row.category] = row.count;
      }
    }
    return map;
  }, [stats]);

  // Per-category contact coverage comes from the unfiltered public stats API,
  // so category cards remain source-accurate while the user searches/filters.
  const categoryStats = useMemo(() => {
    const map: Record<string, { withPhone: number; withEmail: number; withWebsite: number }> = {};
    for (const c of CATEGORIES) {
      map[c.slug] = { withPhone: 0, withEmail: 0, withWebsite: 0 };
    }
    for (const row of stats?.categoryContactCoverage ?? []) {
      map[row.category] = {
        withPhone: row.withPhone,
        withEmail: row.withEmail,
        withWebsite: row.withWebsite,
      };
    }
    return map;
  }, [stats]);

  const handleOpen = useCallback(
    (r: Resource) => {
      setSelected(r);
      setDetailOpen(true);
      addRecent(r);
    },
    [addRecent],
  );

  const handleToggleSave = useCallback(
    (r: Resource) => {
      const wasSaved = isSaved(r.id);
      toggleSaved(r);
      toast.success(
        wasSaved ? `Removed "${r.name}" from saved` : `Saved "${r.name}"`,
        { duration: 2200 },
      );
    },
    [isSaved, toggleSaved],
  );

  const handleToggleCompare = useCallback(
    (r: Resource) => {
      const wasComparing = compare.isComparing(r.id);
      if (!wasComparing && compare.items.length >= compare.max) {
        toast.info(`Comparison tray is full (max ${compare.max})`, {
          description: "Remove one to add another.",
          duration: 2800,
        });
        return;
      }
      compare.toggleCompare(r);
      toast.success(
        wasComparing
          ? `Removed "${r.name}" from comparison`
          : `Added "${r.name}" to comparison`,
        { duration: 2000 },
      );
    },
    [compare],
  );

  // Open a resource by id (used by the autocomplete name suggestions).
  const handleOpenById = useCallback(
    async (id: string) => {
      try {
        const r = await fetchResource(id);
        handleOpen(r);
      } catch {
        toast.error("Could not open that resource");
      }
    },
    [handleOpen],
  );

  // Selecting a category from autocomplete closes the dropdown and filters.
  const handleSelectCategoryFromSearch = (slug: CategorySlug) => {
    setCategory(slug);
    setQuery("");
    // Scroll to the resources section so the user sees the filtered grid.
    setTimeout(() => {
      document
        .getElementById("resources")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  // Clicking a tag on a resource card fills the search with that tag.
  const handleTagClick = (tag: string) => {
    setQuery(tag);
    // Scroll to the resources section so the user sees the filtered grid.
    setTimeout(() => {
      document
        .getElementById("resources")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  };

  const handleJump = useCallback((id: string) => {
    if (id === "top") {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    if (id === "admin") {
      window.location.assign("/admin");
      return;
    }
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const clearSearch = () => {
    setQuery("");
    setCategory("all");
    setPriorityOnly(false);
  };

  // ---- Keyboard shortcuts --------------------------------------------------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;
      const dialogOpen = !!document.querySelector("[role=dialog]");
      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/") {
        e.preventDefault();
        const input =
          searchInputRef.current ??
          document.querySelector<HTMLInputElement>('input[type="search"]');
        input?.focus();
        input?.select();
      } else if (e.key === "Escape" && !dialogOpen) {
        if (query || category !== "all" || priorityOnly) {
          clearSearch();
          toast.info("Filters cleared");
        }
        // Blur the active element so subsequent single-key shortcuts (like X
        // for random resource) don't get typed into the search field.
        if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA") {
          (target as HTMLElement).blur();
        }
      } else if (e.key === "p" || e.key === "P") {
        if (!dialogOpen) {
          setPriorityOnly((v) => !v);
        }
      } else if (e.key === "a" || e.key === "A") {
        if (!dialogOpen) {
          setCategory("all");
        }
      } else if (e.key === "s" || e.key === "S") {
        if (!dialogOpen) {
          setSavedOpen(true);
        }
      } else if (e.key === "c" || e.key === "C") {
        if (!dialogOpen) {
          if (compare.items.length >= 2) {
            setCompareOpen(true);
          } else if (compare.items.length > 0) {
            toast.info("Add at least 2 resources to compare", { duration: 2200 });
          } else {
            toast.info("Use the compare icon on resource cards to add resources", { duration: 2800 });
          }
        }
      } else if (e.key === "r" || e.key === "R") {
        if (!dialogOpen) {
          if (recent.length > 0) {
            setRecentOpen(true);
          } else {
            toast.info("No recently viewed resources yet", { duration: 2200 });
          }
        }
      } else if (e.key === "d" || e.key === "D") {
        if (!dialogOpen) {
          setAdvocateDashboardOpen(true);
        }
      } else if (e.key === "x" || e.key === "X") {
        // Surprise me — open a random resource from the current visible list.
        if (!dialogOpen && resources.length > 0) {
          const random = resources[Math.floor(Math.random() * resources.length)];
          handleOpen(random);
          toast.success("Surprise! Here's a random resource.", { duration: 2000 });
        }
      } else if (e.key === "?") {
        // The help overlay can open even when other dialogs are open.
        e.preventDefault();
        setShortcutHelpOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [query, category, priorityOnly, clearSearch, resources, handleOpen]);

  const gridKey = `${debouncedQuery}::${category}::${priorityOnly}`;

  return (
    <div className="relative flex min-h-screen flex-col">
      <GrainOverlay />

      <SiteHeader
        onJump={handleJump}
        savedCount={saved.length}
        onOpenSaved={() => setSavedOpen(true)}
        annotatedCount={saved.filter(
          (r) => !!notes.getNote(r.id) || ratings.getRating(r.id) > 0,
        ).length}
        recentlyViewedCount={recent.length}
        onOpenRecent={() => setRecentOpen(true)}
        followUpCount={saved.filter((r) => {
          const d = lastContacted.getContacted(r.id);
          if (!d) return true; // never contacted
          const dt = new Date(d);
          if (isNaN(dt.getTime())) return true;
          return (renderedAt - dt.getTime()) / (1000 * 60 * 60 * 24) > 7;
        }).length}
        onOpenAdvocateDashboard={() => setAdvocateDashboardOpen(true)}
        collectionsCount={collections.collections.length}
        onOpenCollections={() => setCollectionsOpen(true)}
        streak={outreachStats.streak}
        goalProgress={outreachStats.goalProgress}
        goalMet={outreachStats.goalMet}
        totalResources={stats?.totalResources ?? 0}
      />

      <main id="main-content" tabIndex={-1} className={"flex-1" + (compare.items.length > 0 ? " pb-28 sm:pb-24" : "")}>
        <Hero
              query={query}
              onQueryChange={setQuery}
              priorityOnly={priorityOnly}
              onTogglePriority={() => setPriorityOnly((v) => !v)}
              total={stats?.totalResources ?? 0}
              priorityCount={stats?.priorityCount ?? 0}
              searchInputRef={searchInputRef}
              onSelectCategory={handleSelectCategoryFromSearch}
              onSelectName={handleOpenById}
              recentSearches={searchHistoryItems}
              onClearSearches={clearSearchHistory}
              onBrowseAll={() => handleJump("resources")}
            />


            <RecentlyViewedStrip
              recent={recent}
              onOpen={handleOpen}
              onClear={clearRecent}
              isComparing={compare.isComparing}
              onToggleCompare={handleToggleCompare}
              compareCount={compare.items.length}
              onOpenCompare={() => {
                if (compare.items.length >= 2) setCompareOpen(true);
              }}
            />

            <StatsStrip
              total={stats?.totalResources ?? 0}
              categoryCount={CATEGORIES.length}
              priorityCount={stats?.priorityCount ?? 0}
            />

            <CategoryGrid
              counts={categoryCounts}
              categoryStats={categoryStats}
              onSelect={(slug) => {
                setCategory(slug);
                // Delay scroll to ensure the filter is applied and the
                // resources section is rendered before scrolling.
                setTimeout(() => {
                  const el = document.getElementById("resources");
                  if (el) {
                    const top = el.getBoundingClientRect().top + window.scrollY - 80;
                    window.scrollTo({ top, behavior: "smooth" });
                  }
                }, 100);
              }}
            />

            <CategoryPills
              active={category}
              onChange={setCategory}
              counts={categoryCounts}
              total={stats?.totalResources ?? 0}
              onShowCategory={(slug) => setCategoryModal(slug)}
            />

            <section
              id="resources"
              aria-label="Resource directory"
              className="py-12 md:py-16"
            >
              <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="mb-6 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-bold text-foreground sm:text-2xl">
                      {priorityOnly
                        ? "Priority resources"
                        : debouncedQuery
                          ? `Results for "${debouncedQuery}"`
                          : "All resources"}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isLoading
                        ? "Searching…"
                        : `${totalCount} ${
                            totalCount === 1 ? "match" : "matches"
                          }`}
                      {priorityOnly ? " · priority only" : ""}
                    </p>
                  </div>
                  <p className="hidden items-center gap-1.5 text-[11px] text-muted-foreground/60 lg:flex">
                    <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">/</kbd>
                    search
                    <span className="mx-1.5 text-border/60">·</span>
                    <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">P</kbd>
                    priority
                    <span className="mx-1.5 text-border/60">·</span>
                    <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">S</kbd>
                    saved
                    <span className="mx-1.5 text-border/60">·</span>
                    <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">D</kbd>
                    dashboard
                    <span className="mx-1.5 text-border/60">·</span>
                    <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">C</kbd>
                    compare
                    <span className="mx-1.5 text-border/60">·</span>
                    <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">X</kbd>
                    random
                    <span className="mx-1.5 text-border/60">·</span>
                    <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">Esc</kbd>
                    clear
                    <span className="mx-1.5 text-border/60">·</span>
                    <button
                      type="button"
                      onClick={() => setShortcutHelpOpen(true)}
                      className="inline-flex items-center gap-1 rounded transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline"
                    >
                      <kbd className="rounded border border-border/60 bg-muted/40 px-1.5 py-0.5 font-mono text-[10px]">?</kbd>
                      help
                    </button>
                  </p>
                </div>

                <ActiveFilters
                  query={debouncedQuery}
                  category={category}
                  priorityOnly={priorityOnly}
                  onClearQuery={() => setQuery("")}
                  onClearCategory={() => setCategory("all")}
                  onClearPriority={() => setPriorityOnly(false)}
                  onClearAll={clearSearch}
                />

                <CountBar
                  filtered={totalCount}
                  total={stats?.totalResources ?? 0}
                  hasFilters={!!debouncedQuery || category !== "all" || priorityOnly}
                  onClearFilters={clearSearch}
                />

                <RecentlyViewed
                  recent={recent}
                  onOpen={handleOpen}
                  onClear={clearRecent}
                />

                {isError ? (
                  <div className="rounded-2xl border border-border/70 bg-card/30 px-6 py-12 text-center">
                    <h3 className="text-lg font-semibold text-foreground">Resource directory unavailable</h3>
                    <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">
                      The resource request failed. Nothing is being represented as an empty search result.
                    </p>
                    <button
                      type="button"
                      onClick={() => void refetch()}
                      className="mt-5 rounded-full border border-foreground/25 bg-foreground px-5 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-85"
                    >
                      Retry
                    </button>
                  </div>
                ) : (
                  <ResourceGrid
                    key={gridKey}
                    resources={resources}
                    query={debouncedQuery}
                    loading={isLoading || (isFetching && resources.length === 0)}
                    totalCount={totalCount}
                    directoryTotal={stats?.totalResources ?? 0}
                    pageSize={500}
                    onReset={clearSearch}
                    onOpen={handleOpen}
                    isSaved={isSaved}
                    onToggleSave={handleToggleSave}
                    isComparing={compare.isComparing}
                    onToggleCompare={handleToggleCompare}
                    hasNote={(id) => !!notes.getNote(id)}
                    getRating={ratings.getRating}
                    onTagClick={handleTagClick}
                    isFollowUpNeeded={(id) => {
                      if (!isSaved(id)) return false;
                      const d = lastContacted.getContacted(id);
                      if (!d) return true;
                      const dt = new Date(d);
                      if (isNaN(dt.getTime())) return true;
                      return (renderedAt - dt.getTime()) / (1000 * 60 * 60 * 24) > 7;
                    }}
                    getContactLogCount={(id) => contactLog.getEntries(id).length}
                    getDefaultContactMethod={defaultContactMethod.getMethod}
                    onSuggestionClick={(term) => {
                      setQuery(term);
                      setDebouncedQuery(term.trim());
                    }}
                  />
                )}
              </div>
            </section>
      </main>

      <SiteFooter
        onJump={handleJump}
        totalResources={stats?.totalResources ?? 0}
      />

      <ResourceDetailDialog
        resource={selected}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        isSaved={selected ? isSaved(selected.id) : false}
        onToggleSave={handleToggleSave}
        isComparing={selected ? compare.isComparing(selected.id) : false}
        onToggleCompare={handleToggleCompare}
        note={selected ? notes.getNote(selected.id) : ""}
        onSetNote={notes.setNote}
        onDeleteNote={notes.deleteNote}
        noteMaxLength={notes.maxLength}
        rating={selected ? ratings.getRating(selected.id) : 0}
        onSetRating={ratings.setRating}
        ratingMax={ratings.max}
        contactedDate={selected ? lastContacted.getContacted(selected.id) : ""}
        onSetContacted={lastContacted.setContacted}
        onClearContacted={lastContacted.clearContacted}
        contactLogEntries={selected ? contactLog.getEntries(selected.id) : []}
        onAddContactLog={(resourceId, date, note, method) => {
          // The contact-log is now the single source of truth — no manual
          // sync needed. lastContacted is derived from contactLog (above),
          // so follow-up indicators update automatically on re-render.
          contactLog.addEntry(resourceId, date, note, method);
        }}
        onRemoveContactLog={(resourceId, entryId) => {
          contactLog.removeEntry(resourceId, entryId);
        }}
        defaultContactMethod={
          selected ? defaultContactMethod.getMethod(selected.id) : undefined
        }
        onSetDefaultContactMethod={(resourceId, method) =>
          defaultContactMethod.setMethod(resourceId, method)
        }
      />

      <SavedResourcesPanel
        open={savedOpen}
        onOpenChange={setSavedOpen}
        saved={saved}
        onToggle={handleToggleSave}
        onClear={clearSaved}
        onOpen={handleOpen}
        getNote={notes.getNote}
        onSetNote={notes.setNote}
        onDeleteNote={notes.deleteNote}
        noteMaxLength={notes.maxLength}
        getRating={ratings.getRating}
        onSetRating={ratings.setRating}
        ratingMax={ratings.max}
        getContacted={lastContacted.getContacted}
        onSetContacted={lastContacted.setContacted}
        onClearContacted={lastContacted.clearContacted}
        collections={collections.collections}
        collectionsForResource={collections.collectionsForResource}
        onToggleCollection={(collectionId, resourceId) => {
          const col = collections.collections.find((c) => c.id === collectionId);
          const wasIn = col?.resourceIds.includes(resourceId) ?? false;
          if (wasIn) {
            collections.removeFromCollection(collectionId, resourceId);
            toast.success(`Removed from "${col?.name}"`);
          } else {
            collections.addToCollection(collectionId, resourceId);
            toast.success(`Added to "${col?.name}"`);
          }
        }}
        onCreateCollection={(name) => {
          const col = collections.createCollection(name);
          if (col) toast.success(`Created collection "${col.name}"`);
        }}
        collectionMaxNameLength={collections.maxNameLength}
      />

      <CategoryModal
        category={categoryModal}
        open={categoryModal !== null}
        onOpenChange={(o) => !o && setCategoryModal(null)}
        onOpenResource={handleOpen}
        onSelectCategory={(c) => setCategory(c)}
      />

      <CompareModal
        items={compare.items}
        open={compareOpen}
        onOpenChange={setCompareOpen}
        onRemove={compare.toggleCompare}
        onClear={compare.clearCompare}
        onOpenResource={handleOpen}
      />

      <CompareTray
        items={compare.items}
        max={compare.max}
        onOpen={() => setCompareOpen(true)}
        onRemove={compare.toggleCompare}
        onClear={compare.clearCompare}
      />

      <CrisisHelpButton />

      <QuickAccess
        savedCount={saved.length}
        recentCount={recent.length}
        compareCount={compare.items.length}
        onOpenSaved={() => setSavedOpen(true)}
        onOpenRecent={() => setRecentOpen(true)}
        onOpenCompare={() => {
          if (compare.items.length >= 2) setCompareOpen(true);
        }}
      />

      <BackToTop />

      <SectionNav
        sections={[
          { id: "top", label: "Home" },
          { id: "categories", label: "Browse by Category" },
          { id: "resources", label: "Resource Directory" },
        ]}
      />

      <RecentlyViewedPanel
        open={recentOpen}
        onOpenChange={setRecentOpen}
        recent={recent}
        onOpen={handleOpen}
        onClear={clearRecent}
      />

      <AdvocateDashboard
        open={advocateDashboardOpen}
        onOpenChange={setAdvocateDashboardOpen}
        saved={saved}
        notes={notes.notes}
        ratings={ratings.ratings}
        contacted={lastContacted.dates}
        recentCount={recent.length}
        onOpenResource={handleOpen}
        contactLogs={contactLog.logs}
        weeklyGoal={weeklyGoal.goal}
        onUpdateWeeklyGoal={weeklyGoal.updateGoal}
        defaultMethodCount={Object.keys(defaultContactMethod.prefs).length}
        onClearAllDefaults={() => {
          defaultContactMethod.clearAll();
        }}
      />

      <CollectionsPanel
        open={collectionsOpen}
        onOpenChange={setCollectionsOpen}
        collections={collections.collections}
        saved={saved}
        onCreate={(name) => {
          const col = collections.createCollection(name);
          if (col) {
            toast.success(`Created collection "${col.name}"`);
            return col;
          }
          toast.error(
            collections.collections.length >= collections.maxCollections
              ? `Collection limit reached (${collections.maxCollections})`
              : "Could not create collection",
          );
          return null;
        }}
        onRename={(id, name) => collections.renameCollection(id, name)}
        onDelete={(id) => {
          collections.deleteCollection(id);
          toast.success("Collection deleted");
        }}
        onRemoveResource={(collectionId, resourceId) => {
          collections.removeFromCollection(collectionId, resourceId);
        }}
        onOpenResource={handleOpen}
        maxCollections={collections.maxCollections}
        maxNameLength={collections.maxNameLength}
      />

      <ShortcutHelp open={shortcutHelpOpen} onOpenChange={setShortcutHelpOpen} />
    </div>
  );
}
