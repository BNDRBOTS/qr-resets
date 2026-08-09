"use client";

import { useState, useEffect, useCallback } from "react";
import type { Resource } from "@/lib/types";

const STORAGE_KEY = "bndr:recently-viewed";
const MAX_RECENT = 6;

/**
 * localStorage-backed recently-viewed resources. SSR-safe (reads only after
 * mount). Caps at MAX_RECENT entries, dedupes by id, most-recent-first.
 */
export function useRecentlyViewed() {
  const [recent, setRecent] = useState<Resource[]>([]);

  // SSR-safe localStorage read: must run after mount to avoid hydration
  // mismatch (server renders [], client may have stored entries). This is
  // the canonical pattern for client-persisted state in Next.js.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Resource[];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (Array.isArray(parsed)) setRecent(parsed.slice(0, MAX_RECENT));
    } catch {
      // ignore parse / storage errors
    }
  }, []);

  const addRecent = useCallback((r: Resource) => {
    setRecent((prev) => {
      const filtered = prev.filter((x) => x.id !== r.id);
      const next = [r, ...filtered].slice(0, MAX_RECENT);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // storage may be full or disabled — silently ignore
      }
      return next;
    });
  }, []);

  const clearRecent = useCallback(() => {
    setRecent([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { recent, addRecent, clearRecent };
}
