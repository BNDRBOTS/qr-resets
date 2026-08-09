"use client";

// BNDR. — Animated counter
// ----------------------------------------------------------------------------
// A number that counts up from 0 to the target value when it scrolls into
// view. Used in the hero and stats sections for a dynamic feel.

import { useEffect, useRef, useState } from "react";
import { useInView } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  className?: string;
  /** Suffix appended after the number (e.g. "+", "%"). */
  suffix?: string;
}

export function AnimatedCounter({
  value,
  duration = 1200,
  className,
  suffix = "",
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-30px" });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!inView) return;

    let raf = 0;
    const start = performance.now();
    const startVal = 0;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease-out cubic for a smooth deceleration.
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (value - startVal) * eased);
      setDisplay(current);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, value, duration]);

  return (
    <span ref={ref} className={className}>
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
