"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { Resource } from "@/lib/types";
import type { ContactLogEntry } from "./use-contact-log";
import { useOutreachStats } from "./use-outreach-stats";

interface UseGoalCelebrationArgs {
  saved: Resource[];
  contactLogs: Record<string, ContactLogEntry[]>;
  weeklyGoal: number;
}

/** Streak milestones that trigger a celebration toast (in weeks). */
const STREAK_MILESTONES = [4, 8, 12, 16, 20, 26, 52];

/**
 * Fires a celebration toast when the weekly outreach goal transitions from
 * not-met → met — regardless of whether the Advocate Dashboard is open.
 *
 * Also fires a milestone toast when the contact streak reaches a milestone
 * (4, 8, 12, 16, 20, 26, 52 weeks) — celebrating consistent outreach.
 *
 * This complements the in-dashboard celebration banner (which only renders
 * when the dashboard is open). The toast fires the moment a contact logged
 * from the resource detail dialog pushes this-week's count to the target
 * or extends the streak to a new milestone.
 */
export function useGoalCelebration({
  saved,
  contactLogs,
  weeklyGoal,
}: UseGoalCelebrationArgs) {
  // Use the shared outreach-stats hook so the streak + thisWeekCount match
  // the dashboard + site header exactly.
  const { streak, thisWeekCount, goalMet } = useOutreachStats({
    saved,
    contactLogs,
    weeklyGoal,
  });

  const prevGoalMetRef = useRef(false);
  const prevStreakRef = useRef(0);

  useEffect(() => {
    // Only fire on the not-met → met transition (not on every render where
    // goalMet is true, and not on initial mount if the goal was already met).
    if (goalMet && !prevGoalMetRef.current) {
      toast.success("🎉 Weekly goal achieved!", {
        description: `You've logged ${thisWeekCount} contact${thisWeekCount === 1 ? "" : "s"} this week — target reached.`,
        duration: 5000,
      });
    }
    prevGoalMetRef.current = goalMet;
  }, [goalMet, thisWeekCount]);

  // Streak milestone toast — fires when the streak crosses a milestone value
  // (e.g. from 3 → 4 weeks). Uses a ref to only fire on the transition, not
  // on every render where the streak is at/above the milestone.
  useEffect(() => {
    if (streak > prevStreakRef.current) {
      // Check if the new streak crossed a milestone.
      const hitMilestone = STREAK_MILESTONES.includes(streak);
      if (hitMilestone) {
        toast.success(`🔥 ${streak}-week streak!`, {
          description: `Consistent outreach for ${streak} consecutive weeks — outstanding dedication.`,
          duration: 6000,
        });
      }
    }
    prevStreakRef.current = streak;
  }, [streak]);

  return { thisWeekCount, goalMet, streak };
}
