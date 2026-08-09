"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Link2,
  Play,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Ban,
  RefreshCw,
  ExternalLink,
  Search,
  ShieldCheck,
  Info,
  Download,
  FileSpreadsheet,
  FileJson,
  Copy,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { fetchUrlVerification, runUrlVerification } from "@/lib/api";
import { csvCell } from "@/lib/export-safety";
import type { UrlStatus, UrlVerificationResult } from "@/lib/types";

interface AdminLinkAuditProps {
  onRan: () => void;
}

/** CSV-escape a single field. Delegates to the shared formula-safe encoder
 * (RFC-4180 quoting + formula neutralization). */
function csvEscape(v: string | number | null | undefined): string {
  return csvCell(v == null ? null : String(v));
}

/** Trigger a browser download of a text file. */
function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const STATUS_META: Record<
  UrlStatus,
  {
    label: string;
    icon: React.ReactNode;
    badgeCls: string;
    dotCls: string;
    description: string;
  }
> = {
  live: {
    label: "Live",
    icon: <CheckCircle2 className="size-4" aria-hidden />,
    badgeCls: "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
    dotCls: "bg-emerald-500",
    description: "Reachable (HTTP 2xx/3xx after following redirects).",
  },
  dead: {
    label: "Dead",
    icon: <XCircle className="size-4" aria-hidden />,
    badgeCls: "border-rose-500/40 bg-rose-500/15 text-rose-600 dark:text-rose-300",
    dotCls: "bg-rose-500",
    description: "Hard 404/410/451 — the page is gone.",
  },
  uncertain: {
    label: "Uncertain",
    icon: <HelpCircle className="size-4" aria-hidden />,
    badgeCls: "border-amber-500/40 bg-amber-500/15 text-amber-600 dark:text-amber-300",
    dotCls: "bg-amber-500",
    description: "Timed out, DNS failure, or 5xx — could be transient. Re-check later.",
  },
  "off-topic": {
    label: "Off-topic",
    icon: <AlertTriangle className="size-4" aria-hidden />,
    badgeCls: "border-orange-500/40 bg-orange-500/15 text-orange-600 dark:text-orange-300",
    dotCls: "bg-orange-500",
    description: "Host/path matches a non-resource pattern (gig marketplace, social login, chat invite…). Kept for review — not deleted.",
  },
  invalid: {
    label: "Invalid",
    icon: <Ban className="size-4" aria-hidden />,
    badgeCls: "border-zinc-500/40 bg-zinc-500/15 text-zinc-600 dark:text-zinc-300",
    dotCls: "bg-zinc-500",
    description: "URL could not be normalised (malformed).",
  },
};

function StatTile({
  status,
  count,
  active,
  onClick,
}: {
  status: UrlStatus;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  const meta = STATUS_META[status];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "group flex items-center gap-3 rounded-xl border p-3 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 " +
        (active
          ? "border-primary/60 bg-primary/10 "
          : "border-border/60 bg-card/40 hover:border-primary/40 hover:bg-card/60")
      }
    >
      <span
        className={
          "flex size-9 items-center justify-center rounded-full " +
          (status === "live"
            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300"
            : status === "dead"
              ? "bg-rose-500/15 text-rose-600 dark:text-rose-300"
              : status === "uncertain"
                ? "bg-amber-500/15 text-amber-600 dark:text-amber-300"
                : status === "off-topic"
                  ? "bg-orange-500/15 text-orange-600 dark:text-orange-300"
                  : "bg-zinc-500/15 text-zinc-600 dark:text-zinc-300")
        }
      >
        {meta.icon}
      </span>
      <div className="min-w-0">
        <p className="font-mono text-xl font-bold tabular-nums text-foreground">
          {count}
        </p>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {meta.label}
        </p>
      </div>
    </button>
  );
}

export function AdminLinkAudit({ onRan }: AdminLinkAuditProps) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<UrlStatus | "all" | "flagged">("all");
  const [search, setSearch] = useState("");

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["url-verification"],
    queryFn: fetchUrlVerification,
  });

  const runMut = useMutation({
    mutationFn: () => runUrlVerification(),
    onSuccess: (report) => {
      toast.success("URL verification complete", {
        description: `${report.byStatus.live} live · ${report.byStatus.dead} dead · ${report.byStatus.uncertain} uncertain · ${report.byStatus["off-topic"]} off-topic`,
        duration: 5000,
      });
      qc.invalidateQueries({ queryKey: ["url-verification"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
      onRan();
    },
    onError: (e: Error) =>
      toast.error("Verification failed", { description: e.message }),
  });

  const recheckMut = useMutation({
    mutationFn: (id: string) => runUrlVerification([id]),
    onSuccess: (report, id) => {
      const r = report.results.find((item) => item.resourceId === id);
      if (r) {
        toast.success(`Re-checked "${r.name}"`, {
          description: `→ ${STATUS_META[r.status].label}${r.statusCode ? ` (HTTP ${r.statusCode})` : ""}`,
          duration: 4000,
        });
      }
      qc.invalidateQueries({ queryKey: ["url-verification"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (e: Error) =>
      toast.error("Re-check failed", { description: e.message }),
  });

  const results = data?.results ?? [];
  const byStatus = data?.byStatus ?? {
    live: 0,
    dead: 0,
    uncertain: 0,
    "off-topic": 0,
    invalid: 0,
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return results
      .filter((r) => {
        if (filter === "all") return true;
        if (filter === "flagged") return r.status !== "live";
        return r.status === filter;
      })
      .filter((r) => {
        if (!q) return true;
        return (
          r.name.toLowerCase().includes(q) ||
          r.website.toLowerCase().includes(q) ||
          (r.offTopicReason ?? "").toLowerCase().includes(q) ||
          (r.note ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        // Flagged first (non-live), then by name.
        const aFlag = a.status === "live" ? 1 : 0;
        const bFlag = b.status === "live" ? 1 : 0;
        if (aFlag !== bFlag) return aFlag - bFlag;
        return a.name.localeCompare(b.name);
      });
  }, [results, filter, search]);

  const hasResults = results.length > 0;
  const hasActiveViewFilter = filter !== "all" || search.trim().length > 0;
  const exportRows = hasActiveViewFilter ? filtered : results;
  const flaggedCount =
    byStatus.dead + byStatus.uncertain + byStatus["off-topic"] + byStatus.invalid;

  // ---- Export helpers (CSV / JSON / clipboard) -----------------------------
  // Exports respect the current filter + search so an admin can export just
  // the flagged subset, or the full report. Always includes the verification
  // metadata (status, HTTP code, off-topic reason, check date) so the export
  // is useful for offline review.
  const exportFilename = (ext: string) =>
    `bndr-url-audit-${new Date().toISOString().slice(0, 10)}.${ext}`;

  const handleExportCsv = () => {
    const rows = exportRows;
    const header = [
      "resourceId",
      "name",
      "website",
      "status",
      "statusCode",
      "finalUrl",
      "offTopicReason",
      "note",
      "durationMs",
      "checkedAt",
    ];
    const lines = [header.join(",")];
    for (const r of rows) {
      lines.push(
        [
          r.resourceId,
          r.name,
          r.website,
          r.status,
          r.statusCode ?? "",
          r.finalUrl ?? "",
          r.offTopicReason ?? "",
          r.note ?? "",
          r.durationMs,
          r.checkedAt,
        ]
          .map(csvEscape)
          .join(","),
      );
    }
    downloadFile(exportFilename("csv"), lines.join("\r\n"), "text/csv;charset=utf-8");
    toast.success("CSV exported", {
      description: `${rows.length} row${rows.length === 1 ? "" : "s"} · ${rows.length === flaggedCount && filter !== "all" ? "current filter" : "all results"}`,
    });
  };

  const handleExportJson = () => {
    const rows = exportRows;
    const payload = {
      exportedAt: new Date().toISOString(),
      filter,
      search,
      total: rows.length,
      byStatus: rows.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] ?? 0) + 1;
          return acc;
        },
        {} as Record<string, number>,
      ),
      results: rows,
    };
    downloadFile(
      exportFilename("json"),
      JSON.stringify(payload, null, 2),
      "application/json",
    );
    toast.success("JSON exported", {
      description: `${rows.length} record${rows.length === 1 ? "" : "s"}`,
    });
  };

  const handleCopyFlagged = async () => {
    const rows = exportRows.filter(
      (r) => r.status !== "live",
    );
    if (rows.length === 0) {
      toast.info("Nothing to copy — no flagged URLs in the current view");
      return;
    }
    const text = rows
      .map((r) => `${r.status}\t${r.name}\t${r.website}${r.offTopicReason ? `\t${r.offTopicReason}` : ""}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard", {
        description: `${rows.length} flagged URL${rows.length === 1 ? "" : "s"} (tab-separated)`,
      });
    } catch {
      toast.error("Could not copy to clipboard");
    }
  };

  return (
    <div className="space-y-6">
      {/* Intro + run button */}
      <div className="rounded-xl border border-border/80 bg-card/30 p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Link2 className="size-6" aria-hidden />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="text-base font-semibold text-foreground">
              Verify resource URLs
            </h3>
            <p className="text-sm text-muted-foreground">
              Safely checks every resource website (HEAD → GET fallback,
              8&nbsp;s timeout, one retry, redirects followed). Classifies each
              as <strong>live</strong>, <strong>dead</strong>,{" "}
              <strong>uncertain</strong>, or <strong>off-topic</strong>. No
              record is ever deleted — flagged URLs are kept for your review.
            </p>
            {data?.ranAt ? (
              <p className="text-xs text-muted-foreground">
                Last verification:{" "}
                <span className="font-mono">
                  {new Date(data.ranAt).toLocaleString()}
                </span>
                {data.durationMs
                  ? ` · took ${(data.durationMs / 1000).toFixed(1)}s`
                  : ""}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                No verification run yet.
              </p>
            )}
          </div>
          <Button
            onClick={() => {
              if (
                hasResults &&
                !confirm(
                  "Re-verify all resource URLs? This probes every website and may take 1–3 minutes.",
                )
              )
                return;
              runMut.mutate();
            }}
            disabled={runMut.isPending}
            className="bg-primary shadow-[0_0_20px_-6px_oklch(0.70_0.26_255/0.7)] hover:bg-primary/90"
          >
            {runMut.isPending ? (
              <RefreshCw className="size-4 animate-spin" aria-hidden />
            ) : (
              <Play className="size-4" aria-hidden />
            )}
            {runMut.isPending
              ? "Verifying…"
              : hasResults
                ? "Re-verify all"
                : "Run verification"}
          </Button>
          {/* Production-grade verification JSON export — includes a
              double-source verification prompt for an external LLM agent
              with live web search. */}
          <a
            href="/api/admin/verification-export"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-border/60 px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            title="Export all resources as JSON with a production-grade double-source verification prompt (for an LLM agent with live web search)"
          >
            <FileJson className="size-4" aria-hidden />
            Verification JSON
          </a>
        </div>
      </div>

      {/* Stats tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          status="live"
          count={byStatus.live}
          active={filter === "live"}
          onClick={() => setFilter(filter === "live" ? "all" : "live")}
        />
        <StatTile
          status="dead"
          count={byStatus.dead}
          active={filter === "dead"}
          onClick={() => setFilter(filter === "dead" ? "all" : "dead")}
        />
        <StatTile
          status="uncertain"
          count={byStatus.uncertain}
          active={filter === "uncertain"}
          onClick={() => setFilter(filter === "uncertain" ? "all" : "uncertain")}
        />
        <StatTile
          status="off-topic"
          count={byStatus["off-topic"]}
          active={filter === "off-topic"}
          onClick={() => setFilter(filter === "off-topic" ? "all" : "off-topic")}
        />
        <StatTile
          status="invalid"
          count={byStatus.invalid}
          active={filter === "invalid"}
          onClick={() => setFilter(filter === "invalid" ? "all" : "invalid")}
        />
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, URL, or reason…"
            className="bg-background/60 pl-9"
          />
        </div>
        <Select
          value={filter}
          onValueChange={(v) => setFilter(v as UrlStatus | "all" | "flagged")}
        >
          <SelectTrigger className="w-44 bg-background/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="flagged">Flagged only</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="dead">Dead</SelectItem>
            <SelectItem value="uncertain">Uncertain</SelectItem>
            <SelectItem value="off-topic">Off-topic</SelectItem>
            <SelectItem value="invalid">Invalid</SelectItem>
          </SelectContent>
        </Select>
        {hasResults ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 bg-background/60 hover:border-primary/40 hover:text-primary"
                aria-label="Export URL audit data"
              >
                <Download className="size-4" aria-hidden />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={handleExportCsv} className="gap-2">
                <FileSpreadsheet className="size-4 text-primary" aria-hidden />
                <div className="flex flex-col">
                  <span>CSV (filtered)</span>
                  <span className="text-[10px] text-muted-foreground">
                    {filtered.length || results.length} rows · spreadsheet-friendly
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportJson} className="gap-2">
                <FileJson className="size-4 text-primary" aria-hidden />
                <div className="flex flex-col">
                  <span>JSON (filtered)</span>
                  <span className="text-[10px] text-muted-foreground">
                    full metadata · machine-readable
                  </span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleCopyFlagged} className="gap-2">
                <Copy className="size-4 text-primary" aria-hidden />
                <div className="flex flex-col">
                  <span>Copy flagged</span>
                  <span className="text-[10px] text-muted-foreground">
                    {flaggedCount} non-live URLs to clipboard
                  </span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <span className="ml-auto text-xs text-muted-foreground">
          {filtered.length} of {results.length} shown
          {flaggedCount > 0 ? ` · ${flaggedCount} flagged` : ""}
        </span>
      </div>

      {/* Results list */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-16 animate-pulse rounded-lg bg-muted/40"
            />
          ))}
        </div>
      ) : !hasResults ? (
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/30 p-6 text-sm text-muted-foreground">
          <Info className="size-5 shrink-0 text-primary" aria-hidden />
          No URL verification data yet. Click{" "}
          <strong>&ldquo;Run verification&rdquo;</strong> to safely probe every
          resource website. Results are cached on disk and recorded in the audit
          log — no resource is modified or deleted.
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/30 p-6 text-sm text-muted-foreground">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          No results match the current filter.
        </div>
      ) : (
        <ScrollArea className="max-h-[60vh] rounded-xl border border-border/80 bg-card/30">
          <ul className="divide-y divide-border/60">
            {filtered.map((r) => (
              <ResultRow
                key={r.resourceId}
                result={r}
                onRecheck={() => recheckMut.mutate(r.resourceId)}
                rechecking={
                  recheckMut.isPending &&
                  recheckMut.variables === r.resourceId
                }
              />
            ))}
          </ul>
        </ScrollArea>
      )}

      {/* Data-integrity note */}
      <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
        <ShieldCheck className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div className="text-muted-foreground">
          <p className="font-medium text-foreground">
            Data-integrity mandate
          </p>
          <p className="mt-0.5">
            Verification never deletes or mutates a resource record. Off-topic
            and dead URLs are flagged here and in the audit log so you can
            review them manually. Use the row actions to open the live URL or
            re-check a single resource.
          </p>
        </div>
      </div>
    </div>
  );
}

function ResultRow({
  result,
  onRecheck,
  rechecking,
}: {
  result: UrlVerificationResult;
  onRecheck: () => void;
  rechecking: boolean;
}) {
  const meta = STATUS_META[result.status];
  return (
    <li className="p-4">
      <div className="flex items-start gap-3">
        <span className={`mt-1.5 size-2 shrink-0 rounded-full ${meta.dotCls}`} aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-foreground">{result.name}</p>
            <Badge className={`border ${meta.badgeCls}`}>
              {meta.icon}
              {meta.label}
            </Badge>
            {result.statusCode != null ? (
              <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground">
                HTTP {result.statusCode}
              </Badge>
            ) : null}
            <span className="ml-auto text-[10px] text-muted-foreground">
              {new Date(result.checkedAt).toLocaleString()} ·{" "}
              {(result.durationMs / 1000).toFixed(1)}s
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            <a
              href={result.website}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 truncate font-mono text-xs text-primary/90 hover:text-primary hover:underline"
            >
              <ExternalLink className="size-3 shrink-0" aria-hidden />
              <span className="truncate">
                {result.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
              </span>
            </a>
            {result.finalUrl ? (
              <span className="truncate text-[11px] text-muted-foreground/70">
                →{" "}
                {result.finalUrl
                  .replace(/^https?:\/\//, "")
                  .replace(/\/$/, "")}
              </span>
            ) : null}
          </div>
          {result.offTopicReason ? (
            <p className="mt-1 text-xs text-orange-600 dark:text-orange-300">
              <AlertTriangle className="mr-1 inline size-3" aria-hidden />
              {result.offTopicReason}
            </p>
          ) : null}
          {result.note && result.note !== "ok" ? (
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground/80">
              {result.note}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={onRecheck}
                  disabled={rechecking}
                  aria-label={`Re-check ${result.name}`}
                  className="hover:text-primary"
                >
                  <RefreshCw
                    className={`size-4 ${rechecking ? "animate-spin" : ""}`}
                    aria-hidden
                  />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                Re-check this URL now
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </li>
  );
}
