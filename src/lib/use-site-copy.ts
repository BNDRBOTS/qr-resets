"use client";

import { useQuery } from "@tanstack/react-query";
import { normalizeSiteCopy, SITE_COPY_DEFAULTS, type SiteCopyContent } from "@/lib/site-copy";

export function useSiteCopy(): SiteCopyContent {
  const { data } = useQuery({
    queryKey: ["site-copy"],
    queryFn: async () => {
      const res = await fetch("/api/site-copy", { cache: "no-store" });
      if (!res.ok) throw new Error("Unable to load site copy");
      return res.json() as Promise<{ content: unknown }>;
    },
    staleTime: 60_000,
  });
  return data?.content ? normalizeSiteCopy(data.content) : { ...SITE_COPY_DEFAULTS };
}
