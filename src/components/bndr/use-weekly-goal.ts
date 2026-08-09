"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "bndr:weekly-goal";

/**
 * localStorage-backed weekly outreach goal. Lets advocates set a target
 * number of contacts per week; the dashboard shows progress toward it.
 * Default = 3. SSR-safe.
 */
export function useWeeklyGoal() {
  const [goal, setGoal] = useState(3);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 50) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setGoal(parsed);
        }
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const updateGoal = useCallback((newGoal: number) => {
    const clamped = Math.max(0, Math.min(50, Math.round(newGoal)));
    setGoal(clamped);
    try {
      localStorage.setItem(STORAGE_KEY, String(clamped));
    } catch {
      // ignore
    }
  }, []);

  return { goal, updateGoal, hydrated };
}
