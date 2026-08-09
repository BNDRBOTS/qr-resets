"use client";

import { useState, useEffect, useCallback } from "react";
import type { Resource } from "@/lib/types";

const STORAGE_KEY = "bndr:compare-resources";
const MAX_COMPARE = 3;

/**
 * localStorage-backed comparison tray. Lets a user select 2-3 resources to
 * compare side-by-side. Persists across reloads. SSR-safe.
 */
export function useCompare() {
  const [items, setItems] = useState<Resource[]>([]);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Resource[];
        if (Array.isArray(parsed)) {
          const capped = parsed.slice(0, MAX_COMPARE);
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setItems(capped);
          setIds(new Set(capped.map((r) => r.id)));
        }
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Resource[]) => {
    setItems(next);
    setIds(new Set(next.map((r) => r.id)));
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }, []);

  const toggleCompare = useCallback(
    (r: Resource) => {
      setItems((prev) => {
        const exists = prev.some((x) => x.id === r.id);
        let next: Resource[];
        if (exists) {
          next = prev.filter((x) => x.id !== r.id);
        } else {
          if (prev.length >= MAX_COMPARE) return prev; // at capacity, ignore
          next = [...prev, r];
        }
        setIds(new Set(next.map((x) => x.id)));
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

  const isComparing = useCallback((id: string) => ids.has(id), [ids]);

  const clearCompare = useCallback(() => {
    persist([]);
  }, [persist]);

  return { items, ids, isComparing, toggleCompare, clearCompare, hydrated, max: MAX_COMPARE };
}
