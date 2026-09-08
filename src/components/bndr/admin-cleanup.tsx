"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, ShieldCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { runCleanup } from "@/lib/api";
import type { PIIPassReport } from "@/lib/types";

interface AdminCleanupProps {
  lastPiipass: string | null;
  onRan: () => void;
}

export function AdminCleanup({ lastPiipass, onRan }: AdminCleanupProps) {
  const [reports, setReports] = useState<PIIPassReport[] | null>(null);
  const [ranAt, setRanAt] = useState<string | null>(null);
  const [previewReady, setPreviewReady] = useState(false);

  const mut = useMutation({
    mutationFn: (mode: "preview" | "apply") => runCleanup(mode),
    onSuccess: (data) => {
      setReports(data.reports);
      setRanAt(new Date().toISOString());
      if (data.dryRun) {
        setPreviewReady(true);
        toast.success("Cleanup preview complete", {
          description: `${data.changedCount} of ${data.total} resources would change. No data was written.`,
        });
      } else {
        setPreviewReady(false);
        toast.success("PII cleanup applied", {
          description: data.snapshotId
            ? `${data.changedCount} resources updated after snapshot ${data.snapshotId}.`
            : `${data.changedCount} resources updated; no snapshot was needed because no rows changed.`,
        });
        onRan();
      }
    },
    onError: (e: Error) =>
      toast.error("Cleanup failed", { description: e.message }),
  });

  const changedReports = reports?.filter((r) => r.changed) ?? [];

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/80 bg-card/30 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <ShieldCheck className="size-6" aria-hidden />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              Run PII normalization pass
            </h3>
            <p className="text-sm text-muted-foreground">
              Re-runs the normalization pipeline on every resource — phone,
              email, URL, whitespace, and PII redaction. Preview writes
              nothing; Apply snapshots the full dataset before persisting drift
              and auditing each changed resource.
            </p>
            {lastPiipass ? (
              <p className="text-xs text-muted-foreground">
                Last pass:{" "}
                <span className="font-mono">
                  {new Date(lastPiipass).toLocaleString()}
                </span>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No prior pass recorded.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => mut.mutate("preview")}
              disabled={mut.isPending}
            >
              <Play className="size-4" aria-hidden />
              {mut.isPending ? "Running…" : "Preview only"}
            </Button>
            <Button
              onClick={() => {
                const affected = changedReports.length;
                if (affected === 0) return;
                const confirmed = window.confirm(
                  `Apply cleanup to ${affected} resource${affected === 1 ? "" : "s"}?\n\n` +
                    "This will normalize the previewed records. A full recovery snapshot of the exact pre-change dataset will be captured before any write. " +
                    "If snapshot creation fails, the cleanup will not be applied.",
                );
                if (confirmed) mut.mutate("apply");
              }}
              disabled={mut.isPending || !previewReady || changedReports.length === 0}
              className="bg-primary shadow-[var(--shadow-accent-strong)] hover:bg-primary/90"
            >
              <ShieldCheck className="size-4" aria-hidden />
              Apply cleanup
            </Button>
          </div>
        </div>
      </div>

      {reports ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Report
            </h3>
            <span className="text-xs text-muted-foreground">
              {changedReports.length} changed · {reports.length} total · ran{" "}
              {ranAt ? new Date(ranAt).toLocaleString() : ""}
            </span>
          </div>

          {changedReports.length === 0 ? (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-600 dark:text-emerald-300">
              <ShieldCheck className="size-5" aria-hidden />
              All resources are already normalized. No drift detected.
            </div>
          ) : (
            <ScrollArea className="max-h-[55vh] rounded-xl border border-border/80 bg-card/30">
              <ul className="divide-y divide-border/60">
                {changedReports.map((r) => (
                  <li key={r.resourceId} className="p-4">
                    <div className="flex items-start gap-2">
                      <AlertCircle
                        className="mt-0.5 size-4 shrink-0 text-primary"
                        aria-hidden
                      />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-foreground">
                          {r.name}
                        </p>
                        <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                          {r.changes.map((c, i) => (
                            <li
                              key={i}
                              className="font-mono leading-relaxed"
                            >
                              · {c}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </ScrollArea>
          )}
        </div>
      ) : null}
    </div>
  );
}
