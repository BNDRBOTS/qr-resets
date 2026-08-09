"use client";

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useLinkStatus, LINK_STATUS_META } from "./use-link-status";

/**
 * A tiny coloured dot that reflects the verified status of a resource's
 * website. Renders nothing when there is no verification data for the
 * resource (e.g. no website, or verification hasn't been run).
 *
 * Read-only — it never triggers a fetch. The verification cache is loaded
 * once at the page level by <LinkStatusProvider>.
 */
export function LinkStatusDot({
  resourceId,
  size = "sm",
}: {
  resourceId: string;
  size?: "sm" | "md";
}) {
  const { getResult } = useLinkStatus();
  const result = getResult(resourceId);
  if (!result) return null;
  const meta = LINK_STATUS_META[result.status];
  const dotSize = size === "md" ? "size-2.5" : "size-2";

  let detail = meta.description;
  if (result.statusCode) detail += ` (HTTP ${result.statusCode})`;
  if (result.offTopicReason) detail += ` — ${result.offTopicReason}`;
  if (result.note && result.note !== "ok")
    detail += ` — ${result.note}`;

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-block shrink-0 rounded-full ${dotSize} ${meta.dotCls} align-middle`}
            role="img"
            aria-label={meta.label}
          />
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          <p className={`font-medium ${meta.textCls}`}>{meta.label}</p>
          <p className="mt-0.5 text-muted-foreground">{detail}</p>
          {result.checkedAt ? (
            <p className="mt-1 text-[10px] text-muted-foreground/70">
              Checked {new Date(result.checkedAt).toLocaleDateString()}
            </p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
