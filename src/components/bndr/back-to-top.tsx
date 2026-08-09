"use client";

// BNDR. — Back to Top floating button
// ----------------------------------------------------------------------------
// A floating button that appears in the bottom-right corner when the user
// scrolls past the hero section. Clicking smoothly scrolls back to the top.
// Includes a progress ring showing scroll progress through the page.

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useScroll, useSpring } from "framer-motion";
import { ArrowUp } from "lucide-react";

export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 30,
    restDelta: 0.001,
  });

  useEffect(() => {
    const onScroll = () => {
      // Show after scrolling past ~1 viewport height
      setVisible(window.scrollY > window.innerHeight * 0.8);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          type="button"
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.5, y: 20 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-30 flex size-11 items-center justify-center rounded-full border border-border/60 bg-card/90 shadow-lg backdrop-blur-xl transition-colors hover:border-primary/40 hover:bg-card hover:text-primary"
        >
          {/* Progress ring */}
          <svg
            className="absolute inset-0 size-full -rotate-90"
            viewBox="0 0 44 44"
            aria-hidden
          >
            <circle
              cx="22"
              cy="22"
              r="20"
              fill="none"
              strokeWidth="2"
              className="stroke-muted/40"
            />
            <motion.circle
              cx="22"
              cy="22"
              r="20"
              fill="none"
              strokeWidth="2"
              strokeLinecap="round"
              className="stroke-primary"
              style={{ pathLength: progress }}
            />
          </svg>
          <ArrowUp className="size-4" aria-hidden />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
