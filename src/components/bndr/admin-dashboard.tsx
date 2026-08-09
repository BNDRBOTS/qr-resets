"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Database,
  Sparkles,
  History,
  ShieldCheck,
  Search,
  Trash2,
  Pencil,
  Plus,
  Link2,
  CheckCircle2,
  AlertTriangle,
  FileJson,
  HeartHandshake,
} from "lucide-react";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchAdminResources, fetchAdminStats, fetchUrlVerification, deleteResource } from "@/lib/api";
import { CATEGORIES, type Resource, type CategorySlug } from "@/lib/types";
import { AdminResourceForm } from "./admin-resource-form";
import { AdminAuditLog } from "./admin-audit-log";
import { AdminCleanup } from "./admin-cleanup";
import { AdminLinkAudit } from "./admin-link-audit";
import { AdminBulkImport } from "./admin-bulk-import";
import { AdminQrRequests } from "./admin-qr-requests";

const CAT_SHORT: Record<CategorySlug, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.shortName]),
) as Record<CategorySlug, string>;

const PAGE_SIZE = 25;

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="bndr-card border-border/60 bg-card/40">
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {label}
          </p>
          <p className="font-mono text-xl font-bold tabular-nums text-foreground">
            {value}
          </p>
          {hint ? (
            <p className="truncate text-xs text-muted-foreground">{hint}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function ResourcesTable() {
  const qc = useQueryClient();
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategorySlug | "all">("all");
  const [editing, setEditing] = useState<Resource | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-resources", page, search, category],
    queryFn: () =>
      fetchAdminResources({
        q: search,
        category,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      }),
    placeholderData: (prev) => prev,
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteResource(id),
    onSuccess: () => {
      toast.success("Resource deleted");
      qc.invalidateQueries({ queryKey: ["admin-resources"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["audit"] });
    },
    onError: (e: Error) =>
      toast.error("Delete failed", { description: e.message }),
  });

  const resources = data?.resources ?? [];
  const total = data?.total ?? 0;
  const hasMore = (page + 1) * PAGE_SIZE < total;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-xs flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => {
              setPage(0);
              setSearch(e.target.value);
            }}
            placeholder="Search resources…"
            className="bg-background/60 pl-9"
          />
        </div>
        <Select
          value={category}
          onValueChange={(v) => {
            setPage(0);
            setCategory(v as CategorySlug | "all");
          }}
        >
          <SelectTrigger className="w-52 bg-background/60">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.slug} value={c.slug}>
                {c.shortName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">
          {total} {total === 1 ? "match" : "matches"}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card/30">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-48">Name</TableHead>
              <TableHead className="w-40">Category</TableHead>
              <TableHead className="w-36">Phone</TableHead>
              <TableHead className="w-20">Priority</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={5} className="h-12">
                    <div className="h-4 w-full animate-pulse rounded bg-muted/60" />
                  </TableCell>
                </TableRow>
              ))
            ) : resources.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={5}
                  className="py-10 text-center text-sm text-muted-foreground"
                >
                  No resources match.
                </TableCell>
              </TableRow>
            ) : (
              resources.map((r) => (
                <TableRow
                  key={r.id}
                  className="border-border/60 text-sm hover:bg-muted/30"
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">
                        {r.name}
                      </span>
                      {r.acronym ? (
                        <Badge
                          variant="secondary"
                          className="font-mono text-[10px] uppercase"
                        >
                          {r.acronym}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {CAT_SHORT[r.category] ?? r.category}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {r.phoneNormalized?.split("|")[0].trim() ?? "—"}
                  </TableCell>
                  <TableCell>
                    {r.priority >= 1 ? (
                      <Badge className="bg-primary/20 text-primary border border-primary/40">
                        Priority
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground/60">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Edit ${r.name}`}
                        onClick={() => setEditing(r)}
                        className="hover:text-primary"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Delete ${r.name}`}
                        onClick={() => {
                          if (
                            confirm(
                              `Delete "${r.name}"? This is recorded in the audit log.`,
                            )
                          ) {
                            delMut.mutate(r.id);
                          }
                        }}
                        className="hover:text-destructive"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          disabled={page === 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        >
          Previous
        </Button>
        <span className="text-xs text-muted-foreground">
          Page {page + 1} of{" "}
          {Math.max(1, Math.ceil(total / PAGE_SIZE))}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!hasMore}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </Button>
      </div>

      {/* Edit dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
      >
        <DialogContent className="max-h-[88vh] overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b border-border/60 px-6 pt-6 pb-4">
            <DialogTitle className="text-xl text-foreground">
              Edit resource
            </DialogTitle>
            <DialogDescription>
              Changes run through the PII normalization pipeline on save.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto px-6 py-5">
            {editing ? (
              <AdminResourceForm
                editing={editing}
                onDone={() => {
                  setEditing(null);
                  qc.invalidateQueries({ queryKey: ["admin-resources"] });
                  qc.invalidateQueries({ queryKey: ["admin-stats"] });
                  qc.invalidateQueries({ queryKey: ["audit"] });
                }}
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function AdminDashboard() {
  const qc = useQueryClient();
  const { data: stats } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: fetchAdminStats,
  });
  // Link-health summary (reads the cached verification report; no re-fetch).
  const { data: urlVerify } = useQuery({
    queryKey: ["url-verification"],
    queryFn: fetchUrlVerification,
    staleTime: 10 * 60 * 1000,
  });
  const linkFlagged =
    (urlVerify?.byStatus.dead ?? 0) +
    (urlVerify?.byStatus.uncertain ?? 0) +
    (urlVerify?.byStatus["off-topic"] ?? 0) +
    (urlVerify?.byStatus.invalid ?? 0);
  const linkTotal = urlVerify?.total ?? 0;
  const linkHealthPct =
    linkTotal > 0 ? Math.round(((linkTotal - linkFlagged) / linkTotal) * 100) : null;

  return (
    <section id="admin" className="py-12 md:py-16">
      <div className="container mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Heading */}
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-foreground sm:text-3xl">
              Admin dashboard
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Manage resources, Reset requests, the PII pipeline, and the audit
              trail. Every administrative change is recorded.
            </p>
          </div>
        </div>

        {/* Stats cards */}
        <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <StatCard
            icon={<Database className="size-5" />}
            label="Total resources"
            value={stats?.totalResources ?? "—"}
          />
          <StatCard
            icon={<Sparkles className="size-5" />}
            label="Priority"
            value={stats?.priorityCount ?? "—"}
            hint="operator-marked"
          />
          <StatCard
            icon={<ShieldCheck className="size-5" />}
            label="Last PII pass"
            value={
              stats?.lastPiipass
                ? new Date(stats.lastPiipass).toLocaleDateString()
                : "—"
            }
            hint="most recent"
          />
          <StatCard
            icon={<History className="size-5" />}
            label="Audit entries"
            value={stats?.auditCount ?? "—"}
            hint="total logged"
          />
          {/* Link-health card — colour-shifts based on the flagged ratio. */}
          <StatCard
            icon={
              linkFlagged === 0 && linkTotal > 0 ? (
                <CheckCircle2 className="size-5" />
              ) : (
                <Link2 className="size-5" />
              )
            }
            label="Link health"
            value={linkHealthPct != null ? `${linkHealthPct}%` : "—"}
            hint={
              linkTotal > 0
                ? `${linkFlagged} flagged of ${linkTotal}`
                : "not verified yet"
            }
          />
        </div>

        {/* Link-health banner — only shown when there are flagged URLs. */}
        {linkFlagged > 0 ? (
          <div className="mb-8 flex flex-wrap items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
            <AlertTriangle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="font-medium text-foreground">
                {linkFlagged} resource URL{linkFlagged === 1 ? "" : "s"} need attention
              </p>
              <p className="text-xs text-muted-foreground">
                {urlVerify?.byStatus.dead ?? 0} dead ·{" "}
                {urlVerify?.byStatus.uncertain ?? 0} uncertain ·{" "}
                {urlVerify?.byStatus["off-topic"] ?? 0} off-topic ·{" "}
                {urlVerify?.byStatus.invalid ?? 0} invalid.
                {urlVerify?.ranAt
                  ? ` Last checked ${new Date(urlVerify.ranAt).toLocaleDateString()}.`
                  : ""}
                {" "}
                Open the Link Audit tab to review + export.
              </p>
            </div>
          </div>
        ) : null}

        {/* Tabs */}
        <Tabs defaultValue="resources" className="space-y-6">
          <TabsList className="h-auto max-w-full justify-start overflow-x-auto bg-muted/40">
            <TabsTrigger value="resources" className="gap-1.5">
              <Database className="size-4" aria-hidden /> Resources
            </TabsTrigger>
            <TabsTrigger value="add" className="gap-1.5">
              <Plus className="size-4" aria-hidden /> Add Resource
            </TabsTrigger>
            <TabsTrigger value="import" className="gap-1.5">
              <FileJson className="size-4" aria-hidden /> Import
            </TabsTrigger>
            <TabsTrigger value="qr-requests" className="gap-1.5">
              <HeartHandshake className="size-4" aria-hidden /> QR Requests
            </TabsTrigger>
            <TabsTrigger value="audit" className="gap-1.5">
              <History className="size-4" aria-hidden /> Audit Log
            </TabsTrigger>
            <TabsTrigger value="cleanup" className="gap-1.5">
              <ShieldCheck className="size-4" aria-hidden /> PII Cleanup
            </TabsTrigger>
            <TabsTrigger value="links" className="gap-1.5">
              <Link2 className="size-4" aria-hidden /> Link Audit
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resources" className="space-y-4">
            <ResourcesTable />
          </TabsContent>

          <TabsContent value="add">
            <AdminResourceForm />
          </TabsContent>

          <TabsContent value="import">
            <AdminBulkImport
              onDone={() => {
                qc.invalidateQueries({ queryKey: ["admin-resources"] });
                qc.invalidateQueries({ queryKey: ["admin-stats"] });
                qc.invalidateQueries({ queryKey: ["audit"] });
                qc.invalidateQueries({ queryKey: ["url-verification"] });
              }}
            />
          </TabsContent>

          <TabsContent value="qr-requests">
            <AdminQrRequests />
          </TabsContent>

          <TabsContent value="audit">
            <AdminAuditLog />
          </TabsContent>

          <TabsContent value="cleanup">
            <AdminCleanup
              lastPiipass={stats?.lastPiipass ?? null}
              onRan={() => {
                qc.invalidateQueries({ queryKey: ["admin-stats"] });
                qc.invalidateQueries({ queryKey: ["audit"] });
              }}
            />
          </TabsContent>

          <TabsContent value="links">
            <AdminLinkAudit
              onRan={() => {
                qc.invalidateQueries({ queryKey: ["admin-stats"] });
                qc.invalidateQueries({ queryKey: ["audit"] });
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
