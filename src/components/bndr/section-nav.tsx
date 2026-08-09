"use client";

// BNDR. — Section navigation dots
// ----------------------------------------------------------------------------
// A vertical floating dot navigation that appears on the right side of the
// screen (desktop only). Each dot represents a page section, with a tooltip
// on hover. The active section is highlighted based on scroll position.

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface SectionNavProps {
  sections: Array<{ id: string; label: string }>;
}

export function SectionNav({ sections }: SectionNavProps) {
  const [activeId, setActiveId] = useState<string>("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: "-30% 0px -50% 0px" },
    );

    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }

    const onScroll = () => {
      setVisible(window.scrollY > 400);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, [sections]);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.nav
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          aria-label="Section navigation"
          className="fixed right-4 top-1/2 z-30 hidden -translate-y-1/2 flex-col items-center gap-3 lg:flex"
        >
          {sections.map((s) => {
            const isActive = activeId === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  const el = document.getElementById(s.id);
                  if (el) {
                    const top = el.getBoundingClientRect().top + window.scrollY - 80;
                    window.scrollTo({ top, behavior: "smooth" });
                  }
                }}
                aria-label={`Jump to ${s.label}`}
                className="group relative flex items-center"
              >
                {/* Tooltip */}
                <span className="pointer-events-none absolute right-6 whitespace-nowrap rounded-md border border-border/60 bg-card/90 px-2 py-1 text-[10px] font-medium text-foreground opacity-0 backdrop-blur transition-opacity group-hover:opacity-100">
                  {s.label}
                </span>
                {/* Dot */}
                <span
                  className={`block rounded-full transition-all duration-300 ${
                    isActive
                      ? "size-3 bg-primary shadow-[0_0_8px_var(--glow-primary)]"
                      : "size-2 bg-muted-foreground/40 group-hover:bg-muted-foreground/70"
                  }`}
                />
              </button>
            );
          })}
        </motion.nav>
      ) : null}
    </AnimatePresence>
  );
}
