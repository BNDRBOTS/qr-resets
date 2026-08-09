"use client";

import { useState, useEffect, useCallback } from "react";
import type { ContactMethod } from "./use-contact-log";

const STORAGE_KEY = "bndr:default-contact-method";

/**
 * localStorage-backed "default contact method" preference per resource.
 *
 * When an advocate logs a new contact for a resource, the contact-log form
 * auto-selects this method (if set) instead of falling back to "phone".
 * This lets advocates who always call a specific org, or always email
 * another, skip re-selecting the method each time.
 *
 * The preference is optional — if no preference is set for a resource, the
 * form falls back to "phone" (the original default). SSR-safe.
 */
export function useDefaultContactMethod() {
  const [prefs, setPrefs] = useState<Record<string, ContactMethod>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, ContactMethod>;
        if (parsed && typeof parsed === "object") {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setPrefs(parsed);
        }
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const getMethod = useCallback(
    (id: string): ContactMethod | undefined => prefs[id],
    [prefs],
  );

  const setMethod = useCallback((id: string, method: ContactMethod | null) => {
    setPrefs((prev) => {
      const next = { ...prev };
      if (method) {
        next[id] = method;
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

  const clearAll = useCallback(() => {
    setPrefs({});
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }, []);

  return { prefs, getMethod, setMethod, clearAll, hydrated };
}
