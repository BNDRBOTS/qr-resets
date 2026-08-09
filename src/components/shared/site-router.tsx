"use client";

import { useSiteStore, useSiteHydrated } from "@/lib/use-site";
import { Directory } from "@/components/bndr/directory";
import { QrSite } from "@/components/qr/qr-site";

/**
 * Renders the active site based on the persisted site store.
 *
 * On the server (and the first client render) we always render the BNDR
 * directory so the HTML is stable and matches the default. Once the client
 * hydrates and reads localStorage, we swap to whichever site the user last
 * selected. This avoids a hydration mismatch while still persisting choice.
 */
export function SiteRouter() {
  const hydrated = useSiteHydrated();
  const site = useSiteStore((s) => s.site);

  if (!hydrated || site === "bndr") {
    return <Directory />;
  }
  return <QrSite />;
}
