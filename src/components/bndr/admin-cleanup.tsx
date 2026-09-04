"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, ShieldCheck, AlertCircle, Eye } from "lucide-react";
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
  const [lastRunWasDry, setLastRunWasDry] = useState(false);

  const preview = useMutation({
    mutationFn: () => runCleanup("preview"),
    onSuccess: (data) => {
      setReports(data.reports);
      setRanAt(new Date().toISOString());
      setLastRunWasDry(true);
      toast.info("Dry run complete - nothing was written", {
        description: `${data.changedCount} of ${data.total} resources would change.`,
      });
    },
    onError: (e: Error) =>
      toast.error("Dry run failed", { description: e.message }),
  });

  const apply = useMutation({
    mutationFn: async () => {
      // Mandatory dry run first: the admin confirms the exact effect (and the
      // automatic pre-cleanup snapshot) before anything is written.
      const dry = await runCleanup("preview");
      const confirmed = window.confirm(
        `PII cleanup will update ${dry.changedCount} of ${dry.total} resources.\n\n` +
          "A durable snapshot of the full dataset (with its dataset hash) is " +
          "captured automatically before any write, restorable from the " +
          "Snapshots panel.\n\nApply now?",
      );
      if (!confirmed) return null;
      return runCleanup("apply");
    },
    onSuccess: (data) => {
      if (!data) {
        toast.info("Cleanup cancelled after dry run. Nothing was written.");
        return;
      }
      setReports(data.reports);
      setRanAt(new Date().toISOString());
      setLastRunWasDry(false);
      toast.success("PII pass complete", {
        description:
          `${data.changedCount} of ${data.total} resources updated.` +
          (data.snapshotId
            ? ` Pre-cleanup snapshot captured (${data.snapshotId.slice(0, 8)}).`
            : " No rows changed, so no snapshot was needed."),
      });
      onRan();
    },
    onError: (e: Error) =>
      toast.error("Cleanup failed", { description: e.message }),
  });

  const changedReports = reports?.filter((r) => r.changed) ?? [];
  const busy = preview.isPending || apply.isPending;

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
              Re-runs the normalization pipeline on every resource - phone,
              email, URL, whitespace, and PII redaction. Dry run shows the
              exact effect without writing; applying captures a durable
              pre-cleanup snapshot first and writes an audit entry per
              changed resource.
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
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => preview.mutate()}
              disabled={busy}
            >
              <Eye className="size-4" aria-hidden />
              {preview.isPending ? "Previewing..." : "Dry run"}
            </Button>
            <Button
              onClick={() => apply.mutate()}
              disabled={busy}
              className="bg-primary shadow-[var(--shadow-accent-strong)] hover:bg-primary/90"
            >
              <Play className="size-4" aria-hidden />
              {apply.isPending ? "Running..." : "Run pass"}
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
              {changedReports.length} changed of {reports.length} total
              {ranAt ? ` (ran ${new Date(ranAt).toLocaleString()})` : ""}
            </span>
            {lastRunWasDry ? (
              <span className="rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                Dry run - not written
              </span>
            ) : null}
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
                              - {c}
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
