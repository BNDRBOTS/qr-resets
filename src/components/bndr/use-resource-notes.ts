"use client";

import { useState, useEffect, useCallback } from "react";

const STORAGE_KEY = "bndr:resource-notes";
const MAX_NOTE_LENGTH = 500;

/**
 * localStorage-backed private notes per resource. Lets advocates annotate
 * saved resources with personal context (e.g. "called 3x, left message",
 * "good for housing", "client preferred this one"). Notes are keyed by
 * resource id and stored entirely client-side — never sent to any server.
 * SSR-safe.
 */
export function useResourceNotes() {
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Record<string, string>;
        if (parsed && typeof parsed === "object") {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setNotes(parsed);
        }
      }
    } catch {
      // ignore
    }
    setHydrated(true);
  }, []);

  const setNote = useCallback((id: string, text: string) => {
    const trimmed = text.slice(0, MAX_NOTE_LENGTH);
    setNotes((prev) => {
      const next = { ...prev };
      if (trimmed.trim()) {
        next[id] = trimmed;
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

  const getNote = useCallback((id: string) => notes[id] ?? "", [notes]);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => {
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

  return { notes, getNote, setNote, deleteNote, hydrated, maxLength: MAX_NOTE_LENGTH };
}
