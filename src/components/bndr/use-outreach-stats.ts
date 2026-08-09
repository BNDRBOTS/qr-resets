"use client";

import { useMemo } from "react";
import type { Resource } from "@/lib/types";
import type { ContactLogEntry } from "./use-contact-log";

interface UseOutreachStatsArgs {
  saved: Resource[];
  contactLogs: Record<string, ContactLogEntry[]>;
  weeklyGoal: number;
}

/**
 * Shared outreach-stats hook — computes the weekly contact chart, streak, and
 * goal progress from the contact-log + saved resources. Used by both the
 * Advocate Dashboard (full chart rendering) and the Site Header (compact
 * streak + goal indicators).
 *
 * Extracting this to a shared hook avoids duplicating the week-bucketing
 * logic across components and ensures the header indicators stay in sync
 * with the dashboard.
 */
export function useOutreachStats({
  saved,
  contactLogs,
  weeklyGoal,
}: UseOutreachStatsArgs) {
  const weeklyChart = useMemo(() => {
    const weeks: { label: string; count: number; weekStart: Date; weekEnd: Date }[] = [];
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    // Build 8 week buckets, oldest first. Each bucket = [weekEnd - 7, weekEnd].
    for (let i = 7; i >= 0; i--) {
      const weekEnd = new Date(now);
      weekEnd.setDate(now.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekEnd.getDate() - 6); // 7-day inclusive window
      weekStart.setHours(0, 0, 0, 0);
      const label = weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      weeks.push({ label, count: 0, weekStart, weekEnd });
    }
    // Count every contact-log entry into the appropriate week bucket.
    const savedIds = new Set(saved.map((r) => r.id));
    for (const [resourceId, entries] of Object.entries(contactLogs)) {
      if (!savedIds.has(resourceId)) continue;
      for (const entry of entries) {
        const d = new Date(entry.date + "T12:00:00");
        if (isNaN(d.getTime())) continue;
        for (let i = 0; i < weeks.length; i++) {
          if (d >= weeks[i].weekStart && d <= weeks[i].weekEnd) {
            weeks[i].count++;
            break;
          }
        }
      }
    }
    const max = Math.max(1, ...weeks.map((w) => w.count));
    const total = weeks.reduce((sum, w) => sum + w.count, 0);
    return { weeks, max, total };
  }, [contactLogs, saved]);

  // Contact streak: consecutive weeks (ending this week) with ≥1 contact.
  const streak = useMemo(() => {
    let count = 0;
    for (let i = weeklyChart.weeks.length - 1; i >= 0; i--) {
      if (weeklyChart.weeks[i].count > 0) {
        count++;
      } else if (count > 0) {
        break;
      }
    }
    return count;
  }, [weeklyChart]);

  const thisWeekCount = weeklyChart.weeks[weeklyChart.weeks.length - 1]?.count ?? 0;
  const goalProgress = weeklyGoal > 0 ? Math.min(100, Math.round((thisWeekCount / weeklyGoal) * 100)) : 0;
  const goalMet = thisWeekCount >= weeklyGoal && weeklyGoal > 0;
  const goalRemaining = Math.max(0, weeklyGoal - thisWeekCount);

  return {
    weeklyChart,
    streak,
    thisWeekCount,
    goalProgress,
    goalMet,
    goalRemaining,
  };
}
