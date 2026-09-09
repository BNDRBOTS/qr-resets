"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, useScroll, useSpring, AnimatePresence } from "framer-motion";
import { ArrowUp, ChevronLeft, ChevronRight } from "lucide-react";
import { QR_NAV } from "@/lib/qr-resets-content";
import { cn } from "@/lib/utils";

/**
 * Scroll-progress bar + back-to-top FAB for the QR Resets site.
 *
 * The progress bar is a thin cool-blue line fixed to the very top of the
 * viewport (above the sticky header) that fills as the user scrolls down
 * the long single-page site.
 *
 * The back-to-top FAB appears after scrolling past ~40vh and smoothly
 * scrolls to the top. It uses the bndr-card glassmorphic style with a
 * cool-blue glow on hover.
 */
export function QrScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  const [showTop, setShowTop] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShowTop(window.scrollY > window.innerHeight * 0.4);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <>
      <motion.div
        className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-gradient-to-r from-primary via-primary to-primary/60"
        style={{ scaleX }}
        aria-hidden="true"
      />

      <AnimatePresence>
        {showTop ? (
          <motion.button
            type="button"
            initial={{ opacity: 0, scale: 0.8, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 10 }}
            transition={{ duration: 0.2 }}
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            aria-label="Back to top"
            className="fixed bottom-6 right-6 z-50 flex size-11 items-center justify-center rounded-full border border-primary/40 bg-card/80 backdrop-blur-xl shadow-[var(--shadow-accent-soft)] transition-all hover:border-primary/70 hover:bg-primary/15 hover:shadow-[var(--shadow-accent-strong)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            <ArrowUp className="size-5 text-primary" aria-hidden />
          </motion.button>
        ) : null}
      </AnimatePresence>
    </>
  );
}

export function useQrActiveSection(): string | null {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const ids = QR_NAV.map((n) => n.id);
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);

    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let best: { id: string; ratio: number } | null = null;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const ratio = entry.intersectionRatio;
            if (!best || ratio > best.ratio) {
              best = { id: entry.target.id, ratio };
            }
          }
        }
        if (best) setActive(best.id);
      },
      {
        rootMargin: "-20% 0px -50% 0px",
        threshold: [0, 0.1, 0.3, 0.5, 0.7, 1],
      },
    );

    for (const s of sections) observer.observe(s);
    return () => observer.disconnect();
  }, []);

  return active;
}

interface QrScrollSpyNavProps {
  className?: string;
}

export function QrScrollSpyPills({ className }: QrScrollSpyNavProps) {
  const active = useQrActiveSection();
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const syncScrollControls = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    setCanScrollLeft(scroller.scrollLeft > 2);
    setCanScrollRight(scroller.scrollLeft < maxScrollLeft - 2);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    syncScrollControls();
    const observer = new ResizeObserver(syncScrollControls);
    observer.observe(scroller);
    for (const child of Array.from(scroller.children)) observer.observe(child);

    scroller.addEventListener("scroll", syncScrollControls, { passive: true });
    window.addEventListener("resize", syncScrollControls, { passive: true });

    return () => {
      observer.disconnect();
      scroller.removeEventListener("scroll", syncScrollControls);
      window.removeEventListener("resize", syncScrollControls);
    };
  }, [syncScrollControls]);

  const scrollCarousel = (direction: -1 | 1) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;
    const distance = Math.max(180, Math.round(scroller.clientWidth * 0.68));
    scroller.scrollBy({ left: direction * distance, behavior: "smooth" });
  };

  const handleWheel = (event: React.WheelEvent<HTMLUListElement>) => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) return;

    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const canMove = delta < 0 ? scroller.scrollLeft > 2 : scroller.scrollLeft < maxScrollLeft - 2;
    if (!canMove) return;

    event.preventDefault();
    scroller.scrollLeft += delta;
  };

  const handleClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    id: string,
  ) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const arrowClass =
    "relative z-20 flex size-8 shrink-0 items-center justify-center rounded-full border border-border/75 bg-background/90 text-foreground shadow-[var(--shadow-accent-soft)] backdrop-blur-md transition-all hover:border-primary/55 hover:bg-accent hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:pointer-events-none disabled:opacity-0";

  return (
    <div className="grid min-w-0 grid-cols-[2rem_minmax(0,1fr)_2rem] items-center gap-2">
      <button
        type="button"
        onClick={() => scrollCarousel(-1)}
        disabled={!canScrollLeft}
        aria-label="Scroll section navigation left"
        className={arrowClass}
      >
        <ChevronLeft className="size-4" aria-hidden />
      </button>

      <div className="relative min-w-0">
        <ul
          ref={scrollerRef}
          onWheel={handleWheel}
          className={cn(
            "bndr-pill-scroll flex min-w-0 items-center gap-1 overflow-x-auto pb-2.5 scroll-smooth",
            className,
          )}
        >
          {QR_NAV.map((item) => {
            const isActive = active === item.id;
            return (
              <li key={item.id} className="shrink-0">
                <button
                  type="button"
                  onClick={(e) => handleClick(e, item.id)}
                  aria-current={isActive ? "true" : undefined}
                  className={cn(
                    "relative flex h-9 items-center rounded-full border px-3 text-xs font-medium transition-all",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                    isActive
                      ? "border-primary/55 bg-accent text-foreground shadow-[var(--shadow-accent-soft)]"
                      : "border-border/60 bg-card text-muted-foreground hover:border-primary/40 hover:bg-accent hover:text-foreground",
                  )}
                >
                  {isActive ? (
                    <span className="mr-1.5 inline-block size-1.5 rounded-full bg-primary align-middle" aria-hidden />
                  ) : null}
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>

        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-background via-background/80 to-transparent transition-opacity",
            canScrollLeft ? "opacity-100" : "opacity-0",
          )}
        />
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-background via-background/80 to-transparent transition-opacity",
            canScrollRight ? "opacity-100" : "opacity-0",
          )}
        />
      </div>

      <button
        type="button"
        onClick={() => scrollCarousel(1)}
        disabled={!canScrollRight}
        aria-label="Scroll section navigation right"
        className={arrowClass}
      >
        <ChevronRight className="size-4" aria-hidden />
      </button>
    </div>
  );
}
