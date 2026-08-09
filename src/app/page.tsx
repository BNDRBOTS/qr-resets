"use client";

import { QueryProvider } from "@/components/bndr/query-provider";
import { LinkStatusProvider } from "@/components/bndr/use-link-status";
import { SiteRouter } from "@/components/shared/site-router";
import { SkipToMain } from "@/components/shared/skip-to-main";

export default function Page() {
  return (
    <QueryProvider>
      <LinkStatusProvider>
        <SkipToMain />
        <SiteRouter />
      </LinkStatusProvider>
    </QueryProvider>
  );
}
