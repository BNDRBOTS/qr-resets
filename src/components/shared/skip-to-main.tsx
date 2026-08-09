"use client";

import { useSyncExternalStore } from "react";

/**
 * "Skip to main content" link for keyboard accessibility.
 *
 * Invisible by default (sr-only). Becomes visible when the user presses Tab
 * on a fresh page load — the link receives focus and slides into view as a
 * fixed pill at the top-left. Clicking it moves focus to the main content
 * landmark so keyboard users can bypass the header navigation.
 *
 * The link targets the first `<main>` element on the page. If no `<main>`
 * exists, it falls back to scrolling to the top.
 */
const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

export function SkipToMain() {
  const mounted = useMounted();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    const main = document.querySelector("main");
    if (main) {
      main.setAttribute("tabindex", "-1");
      (main as HTMLElement).focus();
      main.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  if (!mounted) return null;

  return (
    <a
      href="#main-content"
      onClick={handleClick}
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:border focus:border-primary/50 focus:bg-card focus:px-5 focus:py-2.5 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-[0_0_24px_-6px_oklch(0.62_0.19_18/0.6)] focus:outline-none focus:ring-2 focus:ring-primary/60"
    >
      Skip to main content
    </a>
  );
}
