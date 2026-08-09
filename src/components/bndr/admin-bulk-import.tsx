"use client";

import { useMemo, useRef, useState } from "react";
import { Download, FileJson, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { importResources } from "@/lib/api";

type ImportMode = "append" | "replace";

function parseCount(text: string): number | null {
  try {
    const value = JSON.parse(text) as { resources?: unknown };
    return Array.isArray(value.resources) ? value.resources.length : null;
  } catch {
    return null;
  }
}

export function AdminBulkImport({ onDone }: { onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [json, setJson] = useState("");
  const [mode, setMode] = useState<ImportMode>("replace");
  const [confirmation, setConfirmation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const count = useMemo(() => parseCount(json), [json]);

  async function loadFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error("File is larger than 8 MiB.");
      return;
    }
    setJson(await file.text());
  }

  async function submit() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      toast.error("The import is not valid JSON.");
      return;
    }
    if (!parsed || typeof parsed !== "object" || !Array.isArray((parsed as { resources?: unknown }).resources)) {
      toast.error("The JSON must contain a resources array.");
      return;
    }
    if (mode === "replace" && confirmation !== "REPLACE") {
      toast.error('Type REPLACE before replacing the database.');
      return;
    }

    const payload = {
      ...(parsed as Record<string, unknown>),
      mode,
      confirmReplace: mode === "replace",
    };

    setSubmitting(true);
    try {
      const result = await importResources(payload);
      toast.success(
        mode === "replace"
          ? `Replaced ${result.removed} rows with ${result.inserted} validated rows.`
          : `Imported ${result.inserted} validated rows.`,
      );
      setConfirmation("");
      onDone();
    } catch (error) {
      toast.error("Import failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="rounded-xl border border-border/70 bg-card/35 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Bulk resource import</h3>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Upload or paste the audited JSON. Every row is validated before a
              transaction starts. New rows default to unpublished and unverified
              unless those fields are explicitly true.
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href="/api/admin/resources/export">
              <Download className="size-4" aria-hidden /> Download current backup
            </a>
          </Button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="import-mode">Import mode</Label>
            <select
              id="import-mode"
              value={mode}
              onChange={(event) => setMode(event.target.value as ImportMode)}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              <option value="replace">Replace every resource</option>
              <option value="append">Append to current resources</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="resource-file">JSON file</Label>
            <Input
              ref={inputRef}
              id="resource-file"
              type="file"
              accept="application/json,.json"
              onChange={(event) => loadFile(event.target.files?.[0])}
            />
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="resource-json">Import JSON</Label>
            <span className="text-xs text-muted-foreground">
              {count == null ? "No valid resources array detected" : `${count} row${count === 1 ? "" : "s"} detected`}
            </span>
          </div>
          <Textarea
            id="resource-json"
            value={json}
            onChange={(event) => setJson(event.target.value)}
            placeholder={'{"resources": []}'}
            className="min-h-72 font-mono text-xs"
            spellCheck={false}
          />
        </div>

        {mode === "replace" ? (
          <div className="mt-4 space-y-2 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
            <Label htmlFor="replace-confirmation">Type REPLACE to authorize deletion of the current resource rows</Label>
            <Input
              id="replace-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              placeholder="REPLACE"
            />
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={submit}
            disabled={submitting || count == null || count < 1 || (mode === "replace" && confirmation !== "REPLACE")}
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : mode === "replace" ? (
              <Upload className="size-4" aria-hidden />
            ) : (
              <FileJson className="size-4" aria-hidden />
            )}
            {submitting ? "Validating and importing…" : mode === "replace" ? "Replace resources" : "Append resources"}
          </Button>
          <p className="text-xs text-muted-foreground">
            Maximum 1,000 rows / 8 MiB. Invalid input leaves the database unchanged.
          </p>
        </div>
      </div>
    </div>
  );
}
