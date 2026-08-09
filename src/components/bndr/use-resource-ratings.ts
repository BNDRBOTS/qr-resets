"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "bndr:resource-ratings";
const MAX_RATING = 5;

/**
 * localStorage-backed private star ratings (1-5) per resource. Lets advocates
 * rank resources for their own reference (e.g. 5 stars = top recommendation,
 * 1 star = last resort). Ratings are keyed by resource id and stored entirely
 * client-side. SSR-safe.
 */
export function useResourceRatings() {
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, number>;
        if (parsed && typeof parsed === "object") {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setRatings(parsed);
        }
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const setRating = useCallback((id: string, rating: number) => {
    const clamped = Math.max(0, Math.min(MAX_RATING, Math.round(rating)));
    setRatings((prev) => {
      const next = { ...prev };
      if (clamped > 0) {
        next[id] = clamped;
      } else {
        delete next[id];
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const getRating = useCallback((id: string) => ratings[id] ?? 0, [ratings]);

  const clearRating = useCallback((id: string) => {
    setRatings((prev) => {
      const next = { ...prev };
      delete next[id];
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return { ratings, getRating, setRating, clearRating, hydrated, max: MAX_RATING };
}
