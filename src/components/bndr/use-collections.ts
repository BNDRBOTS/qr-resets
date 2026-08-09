"use client";

import { useState, useEffect, useCallback } from "react";
import type { Resource } from "@/lib/types";

const STORAGE_KEY = "bndr:collections";
const MAX_COLLECTIONS = 20;
const MAX_NAME_LENGTH = 60;

export interface Collection {
  id: string;
  name: string;
  resourceIds: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * localStorage-backed named groups of saved resources. Lets advocates
 * organize saved resources into named collections for different clients
 * (e.g. "Client A — housing", "Client B — legal aid"). Resources are
 * referenced by id; the actual Resource objects live in useSavedResources.
 * SSR-safe.
 */
export function useCollections() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Collection[];
        if (Array.isArray(parsed)) {
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setCollections(parsed.slice(0, MAX_COLLECTIONS));
        }
      }
    } catch {
      // ignore parse / storage errors
    }
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Collection[]) => {
    setCollections(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // storage may be full or disabled — silently ignore
    }
  }, []);

  const createCollection = useCallback(
    (name: string): Collection | null => {
      const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
      if (!trimmed) return null;
      if (collections.length >= MAX_COLLECTIONS) return null;
      const now = new Date().toISOString();
      const col: Collection = {
        id: `col_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        name: trimmed,
        resourceIds: [],
        createdAt: now,
        updatedAt: now,
      };
      persist([col, ...collections]);
      return col;
    },
    [collections, persist],
  );

  const renameCollection = useCallback(
    (id: string, name: string) => {
      const trimmed = name.trim().slice(0, MAX_NAME_LENGTH);
      if (!trimmed) return;
      persist(
        collections.map((c) =>
          c.id === id ? { ...c, name: trimmed, updatedAt: new Date().toISOString() } : c,
        ),
      );
    },
    [collections, persist],
  );

  const deleteCollection = useCallback(
    (id: string) => {
      persist(collections.filter((c) => c.id !== id));
    },
    [collections, persist],
  );

  /** Add a resource to a collection. Returns true if added, false if already present. */
  const addToCollection = useCallback(
    (collectionId: string, resourceId: string): boolean => {
      let added = false;
      persist(
        collections.map((c) => {
          if (c.id !== collectionId) return c;
          if (c.resourceIds.includes(resourceId)) return c;
          added = true;
          return {
            ...c,
            resourceIds: [...c.resourceIds, resourceId],
            updatedAt: new Date().toISOString(),
          };
        }),
      );
      return added;
    },
    [collections, persist],
  );

  /** Remove a resource from a collection. */
  const removeFromCollection = useCallback(
    (collectionId: string, resourceId: string) => {
      persist(
        collections.map((c) =>
          c.id === collectionId
            ? {
                ...c,
                resourceIds: c.resourceIds.filter((r) => r !== resourceId),
                updatedAt: new Date().toISOString(),
              }
            : c,
        ),
      );
    },
    [collections, persist],
  );

  /** Which collections contain a given resource (for badge display). */
  const collectionsForResource = useCallback(
    (resourceId: string): Collection[] =>
      collections.filter((c) => c.resourceIds.includes(resourceId)),
    [collections],
  );

  /** Get the Resource objects for a collection (caller provides the saved list). */
  const resourcesForCollection = useCallback(
    (collection: Collection, saved: Resource[]): Resource[] =>
      saved.filter((r) => collection.resourceIds.includes(r.id)),
    [],
  );

  return {
    collections,
    createCollection,
    renameCollection,
    deleteCollection,
    addToCollection,
    removeFromCollection,
    collectionsForResource,
    resourcesForCollection,
    hydrated,
    maxCollections: MAX_COLLECTIONS,
    maxNameLength: MAX_NAME_LENGTH,
  };
}
