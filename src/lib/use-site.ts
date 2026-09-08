"use client";

import { create } from "zustand";

export type SiteId = "bndr" | "qr";

interface SiteState {
  site: SiteId;
  setSite: (s: SiteId) => void;
  toggle: () => void;
}

/**
 * Which product is visible for the current page session.
 *
 * The public entry point is intentionally ResourceCite on every new load.
 * Site choice is not persisted, so a prior QR Resets visit cannot override
 * the next application entry. Visitors can still switch products at any time.
 */
export const useSiteStore = create<SiteState>()((set, get) => ({
  site: "bndr",
  setSite: (site) => set({ site }),
  toggle: () => set({ site: get().site === "bndr" ? "qr" : "bndr" }),
}));

/** The site store no longer hydrates from persisted browser state. */
export function useSiteHydrated() {
  return true;
}
