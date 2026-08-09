"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "bndr:search-history";
const MAX_HISTORY = 8;

/**
 * localStorage-backed search history. Records recent search queries (≥2
 * chars) so they can be shown when the search input is focused and empty.
 * Dedupes + most-recent-first. SSR-safe.
 */
export function useSearchHistory() {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setHistory(parsed.slice(0, MAX_HISTORY));
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const addSearch = useCallback((q: string) => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    setHistory((prev) => {
      // Dedupe (case-insensitive) + move to front
      const filtered = prev.filter((s) => s.toLowerCase() !== trimmed.toLowerCase());
      const next = [trimmed, ...filtered].slice(0, MAX_HISTORY);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { history, addSearch, clearHistory };
}
