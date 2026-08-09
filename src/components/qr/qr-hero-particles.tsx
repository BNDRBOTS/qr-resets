"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";

/**
 * Subtle floating particle field for the QR hero.
 *
 * Renders small cool-blue dots that drift slowly upward with randomized
 * positions, delays, and durations — creating an ambient "atmosphere"
 * effect behind the hero without distracting from the content.
 *
 * Particles start distributed across the full hero height (not just the
 * bottom) so the effect is visible immediately on load. Uses GPU-accelerated
 * transforms and respects prefers-reduced-motion (framer-motion auto-disables
 * animations when reduced motion is requested).
 */
export function QrHeroParticles({ count = 24 }: { count?: number }) {
  // Generate stable random positions once on mount.
  const particles = useMemo(
    () =>
      Array.from({ length: count }).map((_, i) => ({
        id: i,
        left: Math.random() * 100, // % across width
        startTop: Math.random() * 100, // % down height — distributed everywhere
        size: 2 + Math.random() * 4, // px (2–6)
        delay: Math.random() * 8, // s
        duration: 14 + Math.random() * 12, // s (14–26)
        maxOpacity: 0.2 + Math.random() * 0.4, // 0.2–0.6
        drift: (Math.random() - 0.5) * 40, // horizontal drift px
      })),
    [count],
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute rounded-full bg-primary"
          style={{
            left: `${p.left}%`,
            top: `${p.startTop}%`,
            width: p.size,
            height: p.size,
            boxShadow: `0 0 ${p.size * 3}px oklch(0.72 0.28 350 / 0.7)`,
          }}
          animate={{
            y: [0, -120, -240],
            x: [0, p.drift, 0],
            opacity: [0, p.maxOpacity, 0],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
