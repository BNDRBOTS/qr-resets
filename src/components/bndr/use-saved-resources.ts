"use client";

import { useState, useEffect, useCallback } from "react";
import type { Resource } from "@/lib/types";

const STORAGE_KEY = "bndr:saved-resources";
const MAX_SAVED = 50;

/**
 * localStorage-backed user-curated saved/pinned resources.
 * Unlike recently-viewed (auto-tracked), these are explicitly saved by the
 * user (e.g. an advocate building a resource list for a client). SSR-safe.
 */
export function useSavedResources() {
  const [saved, setSaved] = useState<Resource[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Resource[];
        if (Array.isArray(parsed)) {
          const capped = parsed.slice(0, MAX_SAVED);
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setSaved(capped);
          setSavedIds(new Set(capped.map((r) => r.id)));
        }
      }
    } catch {
      // ignore parse / storage errors
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Resource[]) => {
    setSaved(next);
    setSavedIds(new Set(next.map((r) => r.id)));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage may be full or disabled — silently ignore
    }
  }, []);

  const toggleSaved = useCallback(
    (r: Resource) => {
      setSaved((prev) => {
        const exists = prev.some((x) => x.id === r.id);
        const next = exists
          ? prev.filter((x) => x.id !== r.id)
          : [r, ...prev].slice(0, MAX_SAVED);
        setSavedIds(new Set(next.map((x) => x.id)));
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch {
          // ignore
        }
        return next;
      });
    },
    [],
  );

  const isSaved = useCallback((id: string) => savedIds.has(id), [savedIds]);

  const clearSaved = useCallback(() => {
    persist([]);
  }, [persist]);

  return { saved, savedIds, isSaved, toggleSaved, clearSaved, hydrated };
}
