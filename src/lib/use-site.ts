"use client";

import { useSyncExternalStore } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type SiteId = "bndr" | "qr";

interface SiteState {
  site: SiteId;
  setSite: (s: SiteId) => void;
  toggle: () => void;
}

/**
 * Which of the two mission sites is currently visible.
 * Persisted to localStorage so a refresh keeps the user on the same site.
 */
export const useSiteStore = create<SiteState>()(
  persist(
    (set, get) => ({
      site: "bndr",
      setSite: (site) => set({ site }),
      toggle: () => set({ site: get().site === "bndr" ? "qr" : "bndr" }),
    }),
    { name: "bndr-site" },
  ),
);

/**
 * Returns true once the persisted store has hydrated on the client.
 * Prevents a flash of the default site before localStorage loads.
 * Uses useSyncExternalStore to avoid setState-in-effect (React 19 lint rule).
 */
const emptySubscribe = () => () => {};
export function useSiteHydrated() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true, // client snapshot
    () => false, // server snapshot
  );
}
