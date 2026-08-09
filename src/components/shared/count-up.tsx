"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useMotionValue, animate } from "framer-motion";

interface CountUpProps {
  /** Target number to animate to. */
  to: number;
  /** Duration in seconds (default 1.6). */
  duration?: number;
  /** Prefix string (e.g. "$"). */
  prefix?: string;
  /** Suffix string (e.g. "+"). */
  suffix?: string;
  /** Number of decimal places (default 0). */
  decimals?: number;
  /** Thousands separator (default ","). */
  separator?: string;
  className?: string;
}

/**
 * Animates a number from 0 to `to` when it scrolls into view.
 *
 * Uses framer-motion's `animate()` to tween a motion value, and formats
 * the result with prefix/suffix/decimals/separator on each frame.
 * Falls back to showing the final value immediately if JS is disabled
 * (the initial render shows the formatted target).
 */
export function CountUp({
  to,
  duration = 1.6,
  prefix = "",
  suffix = "",
  decimals = 0,
  separator = ",",
  className,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const mv = useMotionValue(0);
  const [display, setDisplay] = useState("0");

  // Format a number into the display string.
  const format = (n: number) => {
    const fixed = n.toFixed(decimals);
    const [intPart, decPart] = fixed.split(".");
    const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, separator);
    return `${prefix}${withSep}${decPart ? `.${decPart}` : ""}${suffix}`;
  };

  useEffect(() => {
    if (!inView) return;
    const controls = animate(mv, to, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(format(v)),
    });
    return () => controls.stop();
  }, [inView, to, duration, mv]);

  // Show the formatted target on first render (before animation) so the
  // content is visible even if JS/animation fails.
  return (
    <motion.span
      ref={ref}
      className={className}
      initial={{ opacity: 0.4 }}
      animate={{ opacity: inView ? 1 : 0.4 }}
      transition={{ duration: 0.3 }}
    >
      {inView ? display : format(to)}
    </motion.span>
  );
}
