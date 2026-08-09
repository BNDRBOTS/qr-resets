"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp } from "lucide-react";

/**
 * Floating "back to top" button.
 *
 * Appears after the user scrolls past ~40vh and smoothly scrolls to the top.
 * Uses the bndr-card glassmorphic style with a cool-blue glow on hover.
 *
 * Shared between the BNDR directory and the QR site (the QR site also has
 * its own in QrScrollProgress, but this component can be used standalone).
 */
export function BackToTop({ threshold = 0.4 }: { threshold?: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      setShow(window.scrollY > window.innerHeight * threshold);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return (
    <AnimatePresence>
      {show ? (
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
  );
}
