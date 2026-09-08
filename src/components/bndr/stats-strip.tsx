"use client";

import { motion } from "framer-motion";
import { Database, FolderTree } from "lucide-react";
import { AnimatedCounter } from "./animated-counter";

interface StatsStripProps {
  total: number;
  categoryCount: number;
}

export function StatsStrip({ total, categoryCount }: StatsStripProps) {
  const items = [
    { label: "Resources", value: total, icon: Database },
    { label: "Categories", value: categoryCount, icon: FolderTree },
  ];

  return (
    <section aria-label="ResourceCite directory counts" className="border-y border-border/40 bg-card/20">
      <div className="container mx-auto grid max-w-4xl grid-cols-2 px-4 sm:px-6 lg:px-8">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.45, delay: i * 0.08 }}
            className={`flex items-center justify-center gap-3 px-4 py-6 sm:py-8 ${i ? "border-l border-border/40" : ""}`}
          >
            <span className="flex size-9 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
              <item.icon className="size-4" aria-hidden />
            </span>
            <div>
              <AnimatedCounter value={item.value} className="font-mono text-2xl font-bold tabular-nums text-foreground sm:text-3xl" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground/75">{item.label}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
