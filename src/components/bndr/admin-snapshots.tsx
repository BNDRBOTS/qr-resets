"use client";

// BNDR. Admin - durable dataset snapshots and audited restore.
// Snapshots are captured automatically before destructive operations (bulk
// replace, restore) and can be captured manually here. Restore always runs a
// dry run first, shows the exact effect, captures a pre-restore snapshot of
// the current rows, and writes an audit log entry.

import { useCallback, useEffect, useState } from "react";
import { Camera, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createSnapshot,
  fetchSnapshots,
  restoreSnapshot,
  type ResourceSnapshotDto,
} from "@/lib/api";

function describeTrigger(trigger: string): string {
  if (trigger === "pre-replace-import") return "Before bulk replace";
  if (trigger === "pre-restore") return "Before restore";
  if (trigger === "manual") return "Manual";
  return trigger;
}

export function AdminSnapshots() {
  const [snapshots, setSnapshots] = useState<ResourceSnapshotDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchSnapshots();
      setSnapshots(data.snapshots);
      setTotal(data.total);
    } catch (error) {
      toast.error("Failed to load snapshots", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function capture() {
    setCreating(true);
    try {
      const result = await createSnapshot("Manual snapshot from admin");
      const hashNote = result.datasetHash
        ? `, hash ${result.datasetHash.slice(0, 12)}`
        : "";
      toast.success(`Snapshot captured (${result.rowCount} rows${hashNote}).`);
      await refresh();
    } catch (error) {
      toast.error("Snapshot failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setCreating(false);
    }
  }

  async function restore(snapshot: ResourceSnapshotDto) {
    setBusyId(snapshot.id);
    try {
      // Mandatory dry run first: show the exact effect before any write.
      const preview = await restoreSnapshot(snapshot.id, true);
      const confirmed = window.confirm(
        `Restore snapshot from ${new Date(snapshot.createdAt).toLocaleString()}?\n\n` +
          `Dry run: ${preview.wouldRemove ?? 0} current rows would be replaced with ` +
          `${preview.wouldRestore ?? 0} snapshot rows (snapshot hash ` +
          `${preview.datasetHash ? preview.datasetHash.slice(0, 12) : "unknown"} verified).\n\n` +
          "A pre-restore snapshot of the current rows is captured automatically, " +
          "the restored rows are re-read and hash-proven before commit, and the " +
          "restore is written to the audit log.",
      );
      if (!confirmed) {
        toast.info("Restore cancelled after dry run. Nothing was written.");
        return;
      }
      const result = await restoreSnapshot(snapshot.id, false);
      const proof = result.verified
        ? ` Verified: ${result.verified.rowCount} rows, hash ${result.verified.datasetHash.slice(0, 12)}.`
        : "";
      toast.success(
        `Restored ${result.restored ?? 0} rows (replaced ${result.removed ?? 0}).${proof} Audit log updated.`,
      );
      await refresh();
    } catch (error) {
      toast.error("Restore failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="rounded-xl border border-border/70 bg-card/35 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Snapshots and restore</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Durable full-row history of the resource dataset. A snapshot is
            captured automatically before every destructive operation; restores
            are dry-run first, reversible, and audited.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={capture} disabled={creating}>
          {creating ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            <Camera className="size-4" aria-hidden />
          )}
          Capture snapshot
        </Button>
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading snapshots...</p>
        ) : snapshots.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No snapshots yet. One is captured automatically before any bulk
            replace or restore.
          </p>
        ) : (
          <ul className="divide-y divide-border/60">
            {snapshots.map((snapshot) => (
              <li
                key={snapshot.id}
                className="flex flex-wrap items-center justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {new Date(snapshot.createdAt).toLocaleString()} - {snapshot.rowCount} rows
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {describeTrigger(snapshot.trigger)} - {snapshot.reason} - {snapshot.actor}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => restore(snapshot)}
                  disabled={busyId !== null}
                >
                  {busyId === snapshot.id ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <RotateCcw className="size-4" aria-hidden />
                  )}
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
        {total > snapshots.length ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Showing {snapshots.length} of {total} snapshots.
          </p>
        ) : null}
      </div>
    </div>
  );
}
