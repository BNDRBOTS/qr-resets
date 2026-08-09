"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "bndr:contact-log";
const MAX_ENTRIES_PER_RESOURCE = 50;

export type ContactMethod = "phone" | "email" | "in-person" | "voicemail" | "text" | "other";

export interface ContactLogEntry {
  id: string;
  date: string; // YYYY-MM-DD
  note?: string;
  method?: ContactMethod;
  createdAt: string; // ISO timestamp
}

/**
 * localStorage-backed contact log — the single source of truth for all
 * contact activity per resource. Stores multiple entries (date + optional
 * note + method) per resource as a full history/timeline.
 *
 * The "last contacted" date is derived from the most recent log entry
 * (see getLastContactDate). A one-time migration imports any legacy
 * `bndr:last-contacted` data on first load. SSR-safe.
 */
export function useContactLog() {
  const [logs, setLogs] = useState<Record<string, ContactLogEntry[]>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      let parsed: Record<string, ContactLogEntry[]> = {};
      if (raw) {
        const candidate = JSON.parse(raw) as Record<string, ContactLogEntry[]>;
        if (candidate && typeof candidate === "object") {
          parsed = candidate;
        }
      }

      // ---- One-time migration of legacy `bndr:last-contacted` data --------
      // Older versions of the app stored a separate "last contacted" date per
      // resource in `bndr:last-contacted`. Now the contact-log is the single
      // source of truth. On first load, import any legacy dates that don't
      // already have a matching contact-log entry, then remove the legacy key
      // so we never migrate twice.
      try {
        const legacyRaw = localStorage.getItem("bndr:last-contacted");
        if (legacyRaw) {
          const legacy = JSON.parse(legacyRaw) as Record<string, string>;
          if (legacy && typeof legacy === "object") {
            let migrated = 0;
            for (const [resourceId, dateStr] of Object.entries(legacy)) {
              if (!dateStr || typeof dateStr !== "string") continue;
              const date = dateStr.slice(0, 10);
              if (!date) continue;
              // Only import if there isn't already an entry for this date.
              const existing = parsed[resourceId] ?? [];
              const already = existing.some((e) => e.date === date);
              if (!already) {
                parsed[resourceId] = [
                  {
                    id: `migrated_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
                    date,
                    note: undefined,
                    method: undefined,
                    createdAt: new Date().toISOString(),
                  },
                  ...existing,
                ].slice(0, MAX_ENTRIES_PER_RESOURCE);
                migrated++;
              }
            }
            if (migrated > 0) {
              localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
            }
            // Remove the legacy key so we never migrate again.
            localStorage.removeItem("bndr:last-contacted");
          }
        }
      } catch {
        // ignore legacy-migration errors — non-fatal
      }

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLogs(parsed);
    } catch {
      // ignore parse / storage errors
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Record<string, ContactLogEntry[]>) => {
    setLogs(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage may be full or disabled — silently ignore
    }
  }, []);

  /** Add a contact entry. Returns the created entry. */
  const addEntry = useCallback(
    (resourceId: string, date: string, note?: string, method?: ContactMethod): ContactLogEntry | null => {
      if (!date) return null;
      const entry: ContactLogEntry = {
        id: `log_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        date: date.slice(0, 10),
        note: note?.trim() ? note.trim().slice(0, 200) : undefined,
        method,
        createdAt: new Date().toISOString(),
      };
      persist({
        ...logs,
        [resourceId]: [entry, ...(logs[resourceId] ?? [])].slice(0, MAX_ENTRIES_PER_RESOURCE),
      });
      return entry;
    },
    [logs, persist],
  );

  /** Remove a specific entry by id. */
  const removeEntry = useCallback(
    (resourceId: string, entryId: string) => {
      if (!logs[resourceId]) return;
      persist({
        ...logs,
        [resourceId]: logs[resourceId].filter((e) => e.id !== entryId),
      });
    },
    [logs, persist],
  );

  /** Clear all entries for a resource. */
  const clearLog = useCallback(
    (resourceId: string) => {
      if (!logs[resourceId]) return;
      const next = { ...logs };
      delete next[resourceId];
      persist(next);
    },
    [logs, persist],
  );

  /** Get all entries for a resource, sorted newest-first by date. */
  const getEntries = useCallback(
    (resourceId: string): ContactLogEntry[] => {
      const entries = logs[resourceId] ?? [];
      return [...entries].sort((a, b) => b.date.localeCompare(a.date));
    },
    [logs],
  );

  /** The most recent contact date (YYYY-MM-DD) or "" if none. */
  const getLastContactDate = useCallback(
    (resourceId: string): string => {
      const entries = getEntries(resourceId);
      return entries.length > 0 ? entries[0].date : "";
    },
    [getEntries],
  );

  /** Total contact count across all resources. */
  const totalCount = useCallback((): number => {
    return Object.values(logs).reduce((sum, arr) => sum + arr.length, 0);
  }, [logs]);

  return {
    logs,
    addEntry,
    removeEntry,
    clearLog,
    getEntries,
    getLastContactDate,
    totalCount,
    hydrated,
    maxEntriesPerResource: MAX_ENTRIES_PER_RESOURCE,
  };
}
