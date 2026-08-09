"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Light/dark theme toggle. Uses next-themes. Renders a ghost icon button
 * with a Moon icon in light mode (click → dark) and a Sun icon in dark mode
 * (click → light). SSR-safe: renders a placeholder until mounted to avoid
 * hydration mismatch.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch — only render the real icon after mount.
  // The setState-in-effect rule is intentionally disabled: we need to flip
  // the mounted flag exactly once on the client to gate SSR/CSR rendering.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const isDark = theme === "dark";

  if (!mounted) {
    // Placeholder with the same dimensions to prevent layout shift.
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="text-muted-foreground"
        aria-hidden
        tabIndex={-1}
      >
        <span className="size-4" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="text-muted-foreground hover:text-primary hover:bg-transparent"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="size-4" aria-hidden />
      ) : (
        <Moon className="size-4" aria-hidden />
      )}
    </Button>
  );
}
