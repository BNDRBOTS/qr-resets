"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchUrlVerification } from "@/lib/api";
import type { UrlStatus, UrlVerificationResult } from "@/lib/types";

/**
 * Provides read-only URL-verification status to resource cards + the detail
 * dialog. Fetches the cached verification report once (no re-probing) and
 * exposes a fast id → status lookup.
 *
 * The verification itself is run from the Admin → Link Audit tab; this context
 * only reads the on-disk cache so the public directory surface stays cheap.
 */
interface LinkStatusValue {
  /** status for a resource id, or null if not verified / no website */
  getStatus: (id: string) => UrlStatus | null;
  /** full result for a resource id (for tooltips with status code / reason) */
  getResult: (id: string) => UrlVerificationResult | null;
  /** whether a verification report exists at all */
  hasData: boolean;
  /** when the report was generated (ISO or null) */
  ranAt: string | null;
}

const LinkStatusContext = createContext<LinkStatusValue>({
  getStatus: () => null,
  getResult: () => null,
  hasData: false,
  ranAt: null,
});

export function LinkStatusProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ["url-verification"],
    queryFn: fetchUrlVerification,
    // Cache for 10 minutes — verification is an admin action, not real-time.
    staleTime: 10 * 60 * 1000,
  });

  const value = useMemo<LinkStatusValue>(() => {
    const byId = new Map<string, UrlVerificationResult>();
    if (data?.results) {
      for (const r of data.results) byId.set(r.resourceId, r);
    }
    return {
      getStatus: (id: string) => byId.get(id)?.status ?? null,
      getResult: (id: string) => byId.get(id) ?? null,
      hasData: !!data && data.results.length > 0,
      ranAt: data?.ranAt ?? null,
    };
  }, [data]);

  return (
    <LinkStatusContext.Provider value={value}>
      {children}
    </LinkStatusContext.Provider>
  );
}

export function useLinkStatus(): LinkStatusValue {
  return useContext(LinkStatusContext);
}

/** Compact metadata for rendering a status dot + tooltip. */
export const LINK_STATUS_META: Record<
  UrlStatus,
  { label: string; dotCls: string; textCls: string; description: string }
> = {
  live: {
    label: "Link live",
    dotCls: "bg-emerald-500",
    textCls: "text-emerald-600 dark:text-emerald-400",
    description: "Website is reachable (verified).",
  },
  dead: {
    label: "Link dead",
    dotCls: "bg-rose-500",
    textCls: "text-rose-600 dark:text-rose-400",
    description: "Website returned 404/410 — the page is gone. Review needed.",
  },
  uncertain: {
    label: "Link uncertain",
    dotCls: "bg-amber-500",
    textCls: "text-amber-600 dark:text-amber-400",
    description:
      "Website timed out or returned a server error — could be transient.",
  },
  "off-topic": {
    label: "Off-topic link",
    dotCls: "bg-orange-500",
    textCls: "text-orange-600 dark:text-orange-400",
    description:
      "URL points to a non-resource destination (marketplace, social, chat invite). Flagged for review.",
  },
  invalid: {
    label: "Invalid link",
    dotCls: "bg-zinc-500",
    textCls: "text-zinc-600 dark:text-zinc-400",
    description: "URL could not be normalised (malformed).",
  },
};
