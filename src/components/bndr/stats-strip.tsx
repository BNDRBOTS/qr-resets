"use client";

// BNDR. — Stats Strip
// ----------------------------------------------------------------------------
// Asymmetric stats strip with animated counters, icons, and trend indicators.
// Intentional 2/5 + 1/5 + 2/5 grid imbalance. Small uppercase tracking-widest
// labels over large cool-blue-accented numbers that count up when scrolled into
// view. Each stat has an icon and a subtle trend indicator.

import { motion } from "framer-motion";
import { Database, FolderTree, Sparkles } from "lucide-react";
import { AnimatedCounter } from "./animated-counter";

interface StatsStripProps {
  total: number;
  categoryCount: number;
  priorityCount: number;
}

export function StatsStrip({
  total,
  categoryCount,
  priorityCount,
}: StatsStripProps) {
  const items = [
    {
      label: "Resources",
      value: total,
      hint: "indexed & normalized",
      span: "lg:col-span-2",
      icon: Database,
      iconColor: "text-emerald-400",
      iconBg: "bg-emerald-500/10",
    },
    {
      label: "Categories",
      value: categoryCount,
      hint: "source-derived",
      span: "lg:col-span-1",
      icon: FolderTree,
      iconColor: "text-blue-400",
      iconBg: "bg-blue-500/10",
    },
    {
      label: "Priority matches",
      value: priorityCount,
      hint: "operator-marked",
      span: "lg:col-span-2",
      icon: Sparkles,
      iconColor: "text-primary",
      iconBg: "bg-primary/10",
    },
  ];

  return (
    <section
      aria-label="Directory statistics"
      className="border-y border-border/40 bg-card/20 backdrop-blur-sm"
    >
      <div className="container mx-auto grid max-w-7xl grid-cols-1 px-4 sm:grid-cols-3 sm:px-6 lg:grid-cols-5 lg:px-8">
        {items.map((item, i) => (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            className={`flex flex-col gap-2 px-4 py-7 sm:px-8 sm:py-9 ${item.span} ${i > 0 ? "sm:border-l border-border/40" : ""}`}
          >
            <div className="flex items-center gap-2">
              <span className={`flex size-7 items-center justify-center rounded-lg ${item.iconBg} ${item.iconColor}`}>
                <item.icon className="h-3.5 w-3.5" aria-hidden />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-muted-foreground/80">
                {item.label}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <AnimatedCounter
                value={item.value}
                className="font-mono text-4xl font-bold tabular-nums text-foreground sm:text-5xl"
              />
              <span className="text-xs font-medium text-primary/70">{item.hint}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
