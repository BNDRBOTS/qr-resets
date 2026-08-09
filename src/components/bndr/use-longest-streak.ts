"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const STORAGE_KEY = "bndr:longest-streak";

/**
 * localStorage-backed "longest streak" record tracker. Persists the maximum
 * contact streak ever achieved across all sessions. When the current streak
 * exceeds the stored record, the record is updated + a flag is returned so
 * the caller can fire a celebration toast.
 *
 * SSR-safe. The record is only updated when `currentStreak` increases beyond
 * the stored value — it never decreases.
 */
export function useLongestStreak(currentStreak: number) {
  const [longest, setLongest] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [newRecord, setNewRecord] = useState(false);

  // Load the stored record on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = parseInt(raw, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setLongest(parsed);
        }
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  // Track the previous streak so we only update on an actual increase (not
  // on every render where currentStreak equals longest). This avoids the
  // setState-in-effect lint rule while still reacting to prop changes.
  const prevStreakRef = useRef(currentStreak);

  // When the current streak exceeds the stored record, update it.
  useEffect(() => {
    if (!hydrated) return;
    if (currentStreak > longest) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLongest(currentStreak);
      setNewRecord(true);
      try {
        localStorage.setItem(STORAGE_KEY, String(currentStreak));
      } catch {
        // ignore
      }
    }
    // Reset the newRecord flag when the streak drops back (so a future record
    // can fire the flag again). Guard with prevStreakRef to avoid redundant
    // setState calls.
    if (currentStreak < longest && prevStreakRef.current >= longest) {
      setNewRecord(false);
    }
    prevStreakRef.current = currentStreak;
  }, [currentStreak, longest, hydrated]);

  const resetRecord = useCallback(() => {
    setLongest(0);
    setNewRecord(false);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { longest, newRecord, resetRecord, hydrated };
}
