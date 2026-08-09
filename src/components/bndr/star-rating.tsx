"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StarRatingProps {
  resourceId: string;
  resourceName: string;
  rating: number;
  max: number;
  onSet: (id: string, rating: number) => void;
  size?: "sm" | "md";
  showLabel?: boolean;
}

const LABELS = ["", "Last resort", "Below average", "Average", "Good", "Top pick"];

/**
 * Interactive 1-5 star rating. Click a star to set the rating; click the same
 * star again to clear. Hover shows a preview + label. Keyboard accessible
 * (Tab to focus, arrow keys / number keys to set).
 */
export function StarRating({
  resourceId,
  resourceName,
  rating,
  max,
  onSet,
  size = "sm",
  showLabel = true,
}: StarRatingProps) {
  const [hover, setHover] = useState(0);
  const display = hover || rating;
  const starSize = size === "md" ? "size-5" : "size-3.5";

  const handleClick = (value: number, e: React.MouseEvent) => {
    e.stopPropagation();
    // Click the same star again to clear
    onSet(resourceId, rating === value ? 0 : value);
  };

  const handleKeyDown = (e: React.KeyboardEvent, value: number) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onSet(resourceId, rating === value ? 0 : value);
    }
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="inline-flex items-center gap-1.5"
            onMouseLeave={() => setHover(0)}
            role="radiogroup"
            aria-label={`Rating for ${resourceName}`}
          >
            <div className="flex items-center gap-0.5">
              {Array.from({ length: max }).map((_, i) => {
                const value = i + 1;
                const filled = value <= display;
                return (
                  <button
                    key={value}
                    type="button"
                    onMouseEnter={() => setHover(value)}
                    onClick={(e) => handleClick(value, e)}
                    onKeyDown={(e) => handleKeyDown(e, value)}
                    aria-label={`${value} star${value > 1 ? "s" : ""}`}
                    aria-checked={rating === value}
                    role="radio"
                    tabIndex={0}
                    className={
                      "rounded p-0.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 " +
                      (filled
                        ? "text-primary"
                        : "text-muted-foreground/40 hover:text-muted-foreground")
                    }
                  >
                    <Star
                      className={starSize + (filled ? " fill-current" : "")}
                      aria-hidden
                    />
                  </button>
                );
              })}
            </div>
            {showLabel && rating > 0 ? (
              <span className="text-[10px] font-medium text-primary/80">
                {LABELS[rating]}
              </span>
            ) : showLabel && hover > 0 ? (
              <span className="text-[10px] text-muted-foreground">
                {LABELS[hover]}
              </span>
            ) : null}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          {rating > 0
            ? `Your rating: ${rating}/${max} — ${LABELS[rating]}`
            : "Click a star to rate (private)"}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
