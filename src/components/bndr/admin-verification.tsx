"use client";

// Admin Verification tab.
//
// Surfaces the automatic verification pipeline: durable run queue status,
// per-record verifier-v4 results (source vs corroborated values, issues,
// suggested changes, evidence, last checked), review/resolution state, and
// the explicit publication gate. Also hosts the RECOVERY-ONLY artifact import
// for externally produced verifier-v4 outputs; the primary workflow never
// requires exporting data or uploading verifier files.

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  Eye,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  fetchVerificationResults,
  fetchVerificationRuns,
  importVerifierArtifacts,
  publishVerificationResult,
  requestReverification,
  reviewVerificationIssue,
  reviewVerificationResult,
  type VerificationResultDto,
} from "@/lib/api";

const PUBLISH_FILTERS = [
  { value: "", label: "All states" },
  { value: "publish_eligible", label: "Publish eligible" },
  { value: "held", label: "Held for review" },
  { value: "canonical_match", label: "Canonical match" },
  { value: "excluded", label: "Excluded" },
  { value: "published", label: "Published" },
];

function fmtDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleString();
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asRecordArray(value: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => !!asRecord(item));
}

function publishBadgeVariant(state: string): "default" | "secondary" | "destructive" | "outline" {
  if (state === "publish_eligible" || state === "published") return "default";
  if (state === "excluded") return "destructive";
  if (state === "canonical_match") return "outline";
  return "secondary";
}

function statusBadgeVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "VERIFIED") return "default";
  if (status === "WEBSITE_DEAD_CONFIRMED") return "destructive";
  if (status === "PENDING_VERIFICATION") return "outline";
  return "secondary";
}

function severityBadgeVariant(severity: string): "default" | "secondary" | "destructive" | "outline" {
  if (severity === "critical") return "destructive";
  if (severity === "warning") return "default";
  return "secondary";
}

export function AdminVerification() {
  const qc = useQueryClient();
  const [publishFilter, setPublishFilter] = useState("");
  const [runFilter, setRunFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<VerificationResultDto | null>(null);
  const [recoveryRecordsFile, setRecoveryRecordsFile] = useState<File | null>(null);
  const [recoveryManifestFile, setRecoveryManifestFile] = useState<File | null>(null);
  const [recoveryRestricted, setRecoveryRestricted] = useState(false);

  const runsQuery = useQuery({
    queryKey: ["verification", "runs"],
    queryFn: fetchVerificationRuns,
    refetchInterval: 15_000,
  });

  const resultsQuery = useQuery({
    queryKey: ["verification", "results", publishFilter, runFilter, search],
    queryFn: () =>
      fetchVerificationResults({
        publishState: publishFilter || undefined,
        runId: runFilter || undefined,
        q: search || undefined,
        take: 100,
      }),
    refetchInterval: 15_000,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["verification"] });
    qc.invalidateQueries({ queryKey: ["admin-resources"] });
    qc.invalidateQueries({ queryKey: ["admin-stats"] });
    qc.invalidateQueries({ queryKey: ["audit"] });
  };

  const reviewMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Parameters<typeof reviewVerificationResult>[1];
    }) => reviewVerificationResult(id, payload),
    onSuccess: (data) => {
      toast.success(`Record updated (${data.publishState}, ${data.reviewState}).`);
      setSelected((prev) =>
        prev && prev.id === data.id
          ? { ...prev, publishState: data.publishState, reviewState: data.reviewState }
          : prev,
      );
      invalidate();
    },
    onError: (error) =>
      toast.error("Review update failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      }),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => publishVerificationResult(id),
    onSuccess: (data) => {
      toast.success(
        `Published '${data.name}' (${data.verified ? "verified" : "unverified"}${data.published ? "" : ", held from public list by viability gate"}).`,
      );
      setSelected(null);
      invalidate();
    },
    onError: (error) =>
      toast.error("Publish blocked", {
        description: error instanceof Error ? error.message : "Unknown error",
      }),
  });

  const issueMutation = useMutation({
    mutationFn: ({
      id,
      reviewState,
    }: {
      id: string;
      reviewState: "unresolved" | "accepted" | "dismissed";
    }) => reviewVerificationIssue(id, reviewState),
    onSuccess: (data) => {
      setSelected((prev) =>
        prev
          ? {
              ...prev,
              issues: prev.issues.map((issue) =>
                issue.id === data.id ? { ...issue, reviewState: data.reviewState } : issue,
              ),
            }
          : prev,
      );
      invalidate();
    },
    onError: (error) =>
      toast.error("Issue update failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      }),
  });

  const reverifyMutation = useMutation({
    mutationFn: () => requestReverification(),
    onSuccess: (data) => {
      toast.success(`Re-verification queued (run ${data.runId.slice(0, 8)}, ${data.runStatus}).`);
      invalidate();
    },
    onError: (error) =>
      toast.error("Could not queue re-verification", {
        description: error instanceof Error ? error.message : "Unknown error",
      }),
  });

  const recoveryMutation = useMutation({
    mutationFn: async () => {
      if (!recoveryRecordsFile) throw new Error("Select a verified_resources.json file first.");
      const recordsText = await recoveryRecordsFile.text();
      const recordsParsed: unknown = JSON.parse(recordsText);
      const records = Array.isArray(recordsParsed)
        ? asRecordArray(recordsParsed)
        : asRecordArray(
            asRecord(recordsParsed)?.records ?? asRecord(recordsParsed)?.verified_resources,
          );
      if (records.length === 0) {
        throw new Error("No verifier-v4 records found in the selected file.");
      }
      let manifest: Record<string, unknown> | undefined;
      if (recoveryManifestFile) {
        const manifestParsed: unknown = JSON.parse(await recoveryManifestFile.text());
        manifest = asRecord(manifestParsed) ?? undefined;
      }
      return importVerifierArtifacts({
        verifiedResources: records,
        runManifest: manifest,
        filename: recoveryRecordsFile.name,
        environmentEgressRestricted: recoveryRestricted,
      });
    },
    onSuccess: (data) => {
      toast.success(`Recovered ${data.imported} record(s) into review.`, {
        description: data.note,
      });
      setRecoveryRecordsFile(null);
      setRecoveryManifestFile(null);
      invalidate();
    },
    onError: (error) =>
      toast.error("Recovery import failed", {
        description: error instanceof Error ? error.message : "Unknown error",
      }),
  });

  const counts = runsQuery.data?.publishStateCounts ?? {};
  const runs = runsQuery.data?.runs ?? [];
  const results = resultsQuery.data?.results ?? [];
  const total = resultsQuery.data?.total ?? 0;

  const selectedEvidence = useMemo(() => asRecord(selected?.evidenceJson), [selected]);
  const selectedCandidate = useMemo(
    () => asRecord(selected?.sourceJson) ?? asRecord(selected?.candidateJson),
    [selected],
  );
  const evidenceUrls = asRecordArray(selectedEvidence?.urls);
  const evidencePhones = asRecordArray(selectedEvidence?.phones);
  const evidenceEmails = asRecordArray(selectedEvidence?.emails);
  const selectedFlags = Array.isArray(selected?.flagsJson)
    ? (selected?.flagsJson as unknown[]).filter((f): f is string => typeof f === "string")
    : [];
  const selectedViability = asRecord(selected?.viabilityJson);

  const canPublish =
    !!selected &&
    (selected.publishState === "publish_eligible" ||
      (selected.publishState === "held" && selected.reviewState === "reviewed"));

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border/70 bg-card/35 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">Resource verification</h3>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Imports and new resources are verified automatically: candidates are staged
              into a durable queue, the bundled verifier v4 checks them in the background
              (resuming after restarts), and evidence-qualified records become publish
              eligible. Everything uncertain, conflicting, or ambiguous stays held here
              for your review. Nothing is ever auto-published.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => reverifyMutation.mutate()}
            disabled={reverifyMutation.isPending}
          >
            <RotateCcw className="size-4" aria-hidden /> Re-verify current resources
          </Button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {PUBLISH_FILTERS.filter((f) => f.value).map((f) => (
            <Badge key={f.value} variant={publishBadgeVariant(f.value)}>
              {f.label}: {counts[f.value] ?? 0}
            </Badge>
          ))}
        </div>

        <div className="mt-5 overflow-x-auto">
          <h4 className="text-sm font-semibold text-foreground">Verification runs</h4>
          <Table className="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>Origin</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Records</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Verifier</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Completed</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-sm text-muted-foreground">
                    No verification runs yet. Import resources or add one to queue the first run.
                  </TableCell>
                </TableRow>
              ) : (
                runs.map((run) => (
                  <TableRow
                    key={run.id}
                    className="cursor-pointer"
                    onClick={() => setRunFilter((prev) => (prev === run.id ? "" : run.id))}
                    data-state={runFilter === run.id ? "selected" : undefined}
                  >
                    <TableCell className="font-mono text-xs">{run.id.slice(0, 8)}</TableCell>
                    <TableCell>{run.origin}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          run.status === "completed"
                            ? "default"
                            : run.status === "failed" || run.status === "verifier_unavailable"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {run.status}
                      </Badge>
                      {run.error ? (
                        <span className="ml-2 text-xs text-muted-foreground">{run.error.slice(0, 80)}</span>
                      ) : null}
                    </TableCell>
                    <TableCell>{run.resultCount}</TableCell>
                    <TableCell>{run.attempts}</TableCell>
                    <TableCell>{run.verifierVersion ?? "-"}</TableCell>
                    <TableCell className="text-xs">{fmtDate(run.startedAt)}</TableCell>
                    <TableCell className="text-xs">{fmtDate(run.completedAt)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="rounded-xl border border-border/70 bg-card/35 p-5">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-2">
            <Label htmlFor="verification-state">Publish state</Label>
            <select
              id="verification-state"
              value={publishFilter}
              onChange={(event) => setPublishFilter(event.target.value)}
              className="flex h-10 w-48 rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground"
            >
              {PUBLISH_FILTERS.map((f) => (
                <option key={f.value || "all"} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
          <div className="grow space-y-2">
            <Label htmlFor="verification-search">Search by name</Label>
            <Input
              id="verification-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Filter the review queue"
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              runsQuery.refetch();
              resultsQuery.refetch();
            }}
          >
            <RefreshCw className="size-4" aria-hidden /> Refresh
          </Button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          {total} record(s){runFilter ? " in selected run" : ""}. Click a row for evidence and review actions.
        </p>

        <div className="mt-2 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Verifier status</TableHead>
                <TableHead>Dedupe</TableHead>
                <TableHead>Issues</TableHead>
                <TableHead>Publish state</TableHead>
                <TableHead>Review</TableHead>
                <TableHead>Last checked</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-sm text-muted-foreground">
                    Nothing matches the current filters.
                  </TableCell>
                </TableRow>
              ) : (
                results.map((row) => {
                  const critical = row.issues.filter(
                    (issue) => issue.severity === "critical" && issue.reviewState === "unresolved",
                  ).length;
                  return (
                    <TableRow key={row.id} className="cursor-pointer" onClick={() => setSelected(row)}>
                      <TableCell className="max-w-64">
                        <div className="truncate font-medium">{row.suggestedName ?? row.name}</div>
                        {row.suggestedName && row.suggestedName !== row.name ? (
                          <div className="truncate text-xs text-muted-foreground">source: {row.name}</div>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(row.organizationStatus)}>
                          {row.organizationStatus}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{row.duplicateKind}</TableCell>
                      <TableCell className="text-xs">
                        {row.issues.length}
                        {critical > 0 ? (
                          <span className="ml-1 inline-flex items-center text-destructive">
                            <ShieldAlert className="mr-0.5 size-3" aria-hidden />
                            {critical} critical
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={publishBadgeVariant(row.publishState)}>{row.publishState}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">{row.reviewState}</TableCell>
                      <TableCell className="text-xs">{fmtDate(row.checkedAt)}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" aria-label="Open record detail">
                          <Eye className="size-4" aria-hidden />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-border/70 bg-card/20 p-5">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Upload className="size-4" aria-hidden /> Recovery / interchange import (not the normal path)
        </h4>
        <p className="mt-1 max-w-3xl text-xs text-muted-foreground">
          The primary workflow verifies staged imports automatically in the background;
          you never need to export data or upload verifier files. Use this only to
          restore machine-readable results produced by an external verifier-v4 run
          (disaster recovery, debugging, or cross-environment interchange). Recovered
          records land in this review queue and are never auto-published.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="recovery-records">verified_resources.json (required)</Label>
            <Input
              id="recovery-records"
              type="file"
              accept="application/json,.json"
              onChange={(event) => setRecoveryRecordsFile(event.target.files?.[0] ?? null)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="recovery-manifest">run_manifest.json (optional)</Label>
            <Input
              id="recovery-manifest"
              type="file"
              accept="application/json,.json"
              onChange={(event) => setRecoveryManifestFile(event.target.files?.[0] ?? null)}
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={recoveryRestricted}
              onChange={(event) => setRecoveryRestricted(event.target.checked)}
            />
            The source environment had restricted network egress (treat dead-URL
            conclusions as environment artifacts)
          </label>
          <Button
            size="sm"
            variant="outline"
            onClick={() => recoveryMutation.mutate()}
            disabled={recoveryMutation.isPending || !recoveryRecordsFile}
          >
            Import for review
          </Button>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => (!open ? setSelected(null) : undefined)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-y-auto">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <BadgeCheck className="size-5" aria-hidden />
                  {selected.suggestedName ?? selected.name}
                </DialogTitle>
                <DialogDescription>
                  Record {selected.recordId} - {selected.organizationStatus}
                  {selected.organizationReason ? ` - ${selected.organizationReason}` : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="flex flex-wrap gap-2">
                <Badge variant={publishBadgeVariant(selected.publishState)}>{selected.publishState}</Badge>
                <Badge variant="secondary">review: {selected.reviewState}</Badge>
                <Badge variant="secondary">dedupe: {selected.duplicateKind}</Badge>
                {selected.duplicateConfidence ? (
                  <Badge variant="outline">{selected.duplicateConfidence}</Badge>
                ) : null}
                {selectedViability?.rating ? (
                  <Badge variant="outline">viability: {String(selectedViability.rating)}</Badge>
                ) : null}
                <Badge variant="outline">checked: {fmtDate(selected.checkedAt)}</Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <h5 className="text-sm font-semibold">Source values</h5>
                  <pre className="mt-1 max-h-56 overflow-auto rounded-md bg-muted/40 p-3 text-xs">
                    {JSON.stringify(selectedCandidate ?? {}, null, 2)}
                  </pre>
                </div>
                <div>
                  <h5 className="text-sm font-semibold">Corroborated values</h5>
                  <div className="mt-1 space-y-2 text-xs">
                    {evidenceUrls.map((url, index) => (
                      <div key={index} className="rounded-md border border-border/60 p-2">
                        <div className="break-all font-medium">{String(url.requested_url ?? "")}</div>
                        <div>status: {String(url.website_status ?? "unknown")}</div>
                        {url.canonical_url && url.canonical_url !== url.requested_url ? (
                          <div className="break-all">canonical: {String(url.canonical_url)}</div>
                        ) : null}
                        {typeof url.name_similarity === "number" ? (
                          <div>name similarity: {url.name_similarity.toFixed(2)}</div>
                        ) : null}
                      </div>
                    ))}
                    {evidencePhones.map((phone, index) => (
                      <div key={`phone-${index}`} className="rounded-md border border-border/60 p-2">
                        <div className="font-medium">{String(phone.value ?? "")}</div>
                        <div>
                          {String(phone.status ?? "unknown")} / {String(phone.corroboration ?? "unknown")}
                        </div>
                      </div>
                    ))}
                    {evidenceEmails.map((email, index) => (
                      <div key={`email-${index}`} className="rounded-md border border-border/60 p-2">
                        <div className="break-all font-medium">{String(email.value ?? "")}</div>
                        <div>
                          {String(email.status ?? "unknown")} / {String(email.corroboration ?? "unknown")}
                        </div>
                      </div>
                    ))}
                    {evidenceUrls.length + evidencePhones.length + evidenceEmails.length === 0 ? (
                      <p className="text-muted-foreground">
                        No verifier evidence recorded yet (record may still be pending).
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {selectedFlags.length > 0 ? (
                <div>
                  <h5 className="text-sm font-semibold">Verifier flags</h5>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {selectedFlags.map((flag) => (
                      <Badge key={flag} variant="outline">
                        {flag}
                      </Badge>
                    ))}
                  </div>
                </div>
              ) : null}

              <div>
                <h5 className="text-sm font-semibold">Issues and suggested changes</h5>
                {selected.issues.length === 0 ? (
                  <p className="mt-1 text-xs text-muted-foreground">No issues recorded.</p>
                ) : (
                  <div className="mt-1 space-y-2">
                    {selected.issues.map((issue) => (
                      <div key={issue.id} className="rounded-md border border-border/60 p-2 text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={severityBadgeVariant(issue.severity)}>{issue.severity}</Badge>
                          <span className="font-mono">{issue.code}</span>
                          <span className="text-muted-foreground">field: {issue.field}</span>
                          <Badge variant="outline">{issue.reviewState}</Badge>
                        </div>
                        {issue.currentValue ? (
                          <div className="mt-1 break-all">current: {issue.currentValue}</div>
                        ) : null}
                        {issue.suggestedValue ? (
                          <div className="break-all">suggested: {issue.suggestedValue}</div>
                        ) : null}
                        {issue.evidenceJson ? (
                          <details className="mt-1">
                            <summary className="cursor-pointer text-muted-foreground">Evidence</summary>
                            <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted/40 p-2">
                              {JSON.stringify(issue.evidenceJson, null, 2)}
                            </pre>
                          </details>
                        ) : null}
                        <div className="mt-2 flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={issueMutation.isPending || issue.reviewState === "accepted"}
                            onClick={() =>
                              issueMutation.mutate({ id: issue.id, reviewState: "accepted" })
                            }
                          >
                            Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={issueMutation.isPending || issue.reviewState === "dismissed"}
                            onClick={() =>
                              issueMutation.mutate({ id: issue.id, reviewState: "dismissed" })
                            }
                          >
                            Dismiss
                          </Button>
                          {issue.reviewState !== "unresolved" ? (
                            <Button
                              size="sm"
                              variant="ghost"
                              disabled={issueMutation.isPending}
                              onClick={() =>
                                issueMutation.mutate({ id: issue.id, reviewState: "unresolved" })
                              }
                            >
                              Reopen
                            </Button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <details>
                <summary className="cursor-pointer text-xs text-muted-foreground">
                  Full verifier evidence (raw)
                </summary>
                <pre className="mt-1 max-h-64 overflow-auto rounded-md bg-muted/40 p-3 text-xs">
                  {JSON.stringify(selected.evidenceJson ?? null, null, 2)}
                </pre>
              </details>

              <div className="flex flex-wrap gap-2 border-t border-border/60 pt-3">
                {selected.publishState !== "published" ? (
                  <>
                    <Button
                      size="sm"
                      disabled={!canPublish || publishMutation.isPending}
                      onClick={() => publishMutation.mutate(selected.id)}
                    >
                      Publish to directory
                    </Button>
                    {selected.reviewState !== "reviewed" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            id: selected.id,
                            payload: { reviewState: "reviewed" },
                          })
                        }
                      >
                        Mark reviewed
                      </Button>
                    ) : null}
                    {selected.publishState !== "excluded" ? (
                      <Button
                        size="sm"
                        variant="destructive"
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            id: selected.id,
                            payload: { publishState: "excluded", reviewState: "reviewed" },
                          })
                        }
                      >
                        Exclude
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={reviewMutation.isPending}
                        onClick={() =>
                          reviewMutation.mutate({
                            id: selected.id,
                            payload: { publishState: "held" },
                          })
                        }
                      >
                        Move back to held
                      </Button>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    Published to the directory. Manage the live row from the Resources tab.
                  </p>
                )}
                {!canPublish && selected.publishState === "held" ? (
                  <p className="w-full text-xs text-muted-foreground">
                    Held records require an explicit review (Mark reviewed) before the
                    publish gate opens. Unresolved critical issues also block publication.
                  </p>
                ) : null}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
