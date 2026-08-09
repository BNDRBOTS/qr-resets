"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Eye, RefreshCw, ShieldCheck } from "lucide-react";

const STATUSES = [
  "received",
  "reviewing",
  "needs-info",
  "approved",
  "alternate-offered",
  "declined",
  "withdrawn",
  "closed",
] as const;

type QrStatus = (typeof STATUSES)[number];

type Review = {
  id: string;
  stage: number;
  decision: string;
  reasonCode: string | null;
  notes: string | null;
  actor: string;
  createdAt: string;
};

type ResetRequest = {
  id: string;
  displayName: string | null;
  contactMethod: string | null;
  contactDetails: string | null;
  location: string | null;
  situation: string | null;
  urgentProblem: string | null;
  blockers: string | null;
  proposedHelp: string | null;
  unwantedSupport: string | null;
  deadline: string | null;
  alreadyWorking: string | null;
  currentHelp: string | null;
  planPreference: string | null;
  documentsNote: string | null;
  consentRequired: unknown;
  consentOptional: unknown;
  status: QrStatus;
  createdAt: string;
  updatedAt: string;
  reviews: Review[];
};

type ListResponse = { requests: ResetRequest[]; error?: string };

function labelStatus(status: string) {
  return status
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function fetchRequests(status: string): Promise<ListResponse> {
  const params = new URLSearchParams();
  if (status !== "all") params.set("status", status);
  const res = await fetch(`/api/admin/qr/requests?${params.toString()}`, {
    credentials: "same-origin",
    cache: "no-store",
  });
  const body = (await res.json()) as ListResponse;
  if (!res.ok) throw new Error(body.error || "Could not load Reset requests.");
  return body;
}

async function reviewRequest(input: {
  id: string;
  status: QrStatus;
  stage: 1 | 2;
  decision: string;
  reasonCode: string;
  notes: string;
}) {
  const res = await fetch(`/api/admin/qr/requests/${encodeURIComponent(input.id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      status: input.status,
      stage: input.stage,
      decision: input.decision,
      reasonCode: input.reasonCode,
      notes: input.notes,
    }),
  });
  const body = (await res.json()) as { ok?: boolean; error?: string };
  if (!res.ok || !body.ok) throw new Error(body.error || "Could not save review.");
  return body;
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-1 rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </p>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{value}</p>
    </div>
  );
}

export function AdminQrRequests() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");
  const [selected, setSelected] = useState<ResetRequest | null>(null);
  const [nextStatus, setNextStatus] = useState<QrStatus>("reviewing");
  const [stage, setStage] = useState<1 | 2>(1);
  const [decision, setDecision] = useState("Review update");
  const [reasonCode, setReasonCode] = useState("");
  const [notes, setNotes] = useState("");

  const query = useQuery({
    queryKey: ["admin-qr-requests", statusFilter],
    queryFn: () => fetchRequests(statusFilter),
    staleTime: 15_000,
  });

  const mutation = useMutation({
    mutationFn: reviewRequest,
    onSuccess: async () => {
      toast.success("Reset request review saved");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-qr-requests"] }),
        qc.invalidateQueries({ queryKey: ["audit"] }),
      ]);
      setSelected(null);
      setNotes("");
      setReasonCode("");
      setDecision("Review update");
    },
    onError: (error: Error) => toast.error("Review failed", { description: error.message }),
  });

  const requests = query.data?.requests ?? [];
  const openCount = useMemo(
    () => requests.filter((r) => !["declined", "withdrawn", "closed"].includes(r.status)).length,
    [requests],
  );

  const openRequest = (request: ResetRequest) => {
    setSelected(request);
    setNextStatus(request.status === "received" ? "reviewing" : request.status);
    setStage(request.reviews.some((review) => review.stage === 1) ? 2 : 1);
    setDecision("Review update");
    setReasonCode("");
    setNotes("");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h3 className="text-lg font-semibold text-foreground">QR Reset requests</h3>
          <p className="text-xs text-muted-foreground">
            Server-stored requests only. Review decisions are recorded in the audit trail.
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Badge variant="secondary">{openCount} open in view</Badge>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-44 bg-background/60">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {STATUSES.map((status) => (
                <SelectItem key={status} value={status}>
                  {labelStatus(status)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={() => query.refetch()}
            disabled={query.isFetching}
            aria-label="Refresh Reset requests"
          >
            <RefreshCw className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card/30">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-36">Received</TableHead>
              <TableHead className="min-w-44">Name / location</TableHead>
              <TableHead className="min-w-64">Urgent problem</TableHead>
              <TableHead className="w-40">Status</TableHead>
              <TableHead className="w-20 text-right">View</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  <TableCell colSpan={5} className="h-12">
                    <div className="h-4 w-full animate-pulse rounded bg-muted/60" />
                  </TableCell>
                </TableRow>
              ))
            ) : query.isError ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-destructive">
                  {query.error instanceof Error ? query.error.message : "Could not load requests."}
                </TableCell>
              </TableRow>
            ) : requests.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                  No Reset requests match this filter.
                </TableCell>
              </TableRow>
            ) : (
              requests.map((request) => (
                <TableRow key={request.id} className="border-border/60 text-sm hover:bg-muted/30">
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {new Date(request.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <p className="font-medium text-foreground">{request.displayName || "Name not supplied"}</p>
                    <p className="text-xs text-muted-foreground">{request.location || "Location not supplied"}</p>
                  </TableCell>
                  <TableCell>
                    <p className="line-clamp-2 text-xs leading-relaxed text-foreground/90">
                      {request.urgentProblem || request.situation || "No narrative supplied"}
                    </p>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">{labelStatus(request.status)}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button type="button" size="icon" variant="ghost" onClick={() => openRequest(request)} aria-label="Review request">
                      <Eye className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          {selected ? (() => {
            const optionalConsent = Array.isArray(selected.consentOptional) ? selected.consentOptional : [];
            const requiredConsent = Array.isArray(selected.consentRequired) ? selected.consentRequired : [];
            const contactPermission = optionalConsent[0] === true;
            const storyPermission = optionalConsent[1] === true;
            const requiredConfirmed = requiredConsent.length === 2 && requiredConsent.every((value) => value === true);
            return (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-primary" />
                  Reset request review
                </DialogTitle>
                <DialogDescription>
                  Reference {selected.id} · received {new Date(selected.createdAt).toLocaleString()}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Name" value={selected.displayName} />
                <Field label="Location" value={selected.location} />
                <Field label="Contact method" value={selected.contactMethod} />
                <Field
                  label="Contact details"
                  value={
                    contactPermission
                      ? selected.contactDetails
                      : selected.contactDetails
                        ? "Not displayed — contact permission was not granted."
                        : null
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2 rounded-xl border border-border/60 bg-muted/20 p-3">
                <Badge variant={requiredConfirmed ? "secondary" : "destructive"}>
                  Required consent: {requiredConfirmed ? "confirmed" : "invalid"}
                </Badge>
                <Badge variant={contactPermission ? "secondary" : "outline"}>
                  Contact permission: {contactPermission ? "granted" : "not granted"}
                </Badge>
                <Badge variant={storyPermission ? "secondary" : "outline"}>
                  Public-story permission: {storyPermission ? "granted" : "not granted"}
                </Badge>
              </div>
              <div className="grid gap-3">
                <Field label="What is happening" value={selected.situation} />
                <Field label="Most urgent problem" value={selected.urgentProblem} />
                <Field label="Blockers" value={selected.blockers} />
                <Field label="What they believe would help" value={selected.proposedHelp} />
                <Field label="Support they do not want" value={selected.unwantedSupport} />
                <Field label="Deadline" value={selected.deadline} />
                <Field label="What is already working" value={selected.alreadyWorking} />
                <Field label="Current help" value={selected.currentHelp} />
                <Field label="Plan preference" value={selected.planPreference} />
                <Field label="Documents note" value={selected.documentsNote} />
              </div>

              {selected.reviews.length ? (
                <div className="space-y-2 rounded-xl border border-border/60 bg-muted/20 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Recent reviews</p>
                  {selected.reviews.map((review) => (
                    <div key={review.id} className="border-t border-border/50 pt-2 first:border-t-0 first:pt-0">
                      <p className="text-xs font-medium text-foreground">
                        Stage {review.stage} · {review.decision} · {new Date(review.createdAt).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">{review.actor}{review.reasonCode ? ` · ${review.reasonCode}` : ""}</p>
                      {review.notes ? <p className="mt-1 whitespace-pre-wrap text-xs text-foreground/80">{review.notes}</p> : null}
                    </div>
                  ))}
                </div>
              ) : null}

              <div className="space-y-4 rounded-xl border border-border/70 bg-card/50 p-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">New status</label>
                    <Select value={nextStatus} onValueChange={(value) => setNextStatus(value as QrStatus)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STATUSES.map((status) => <SelectItem key={status} value={status}>{labelStatus(status)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Review stage</label>
                    <Select value={String(stage)} onValueChange={(value) => setStage(value === "2" ? 2 : 1)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">Stage 1 — policy review</SelectItem>
                        <SelectItem value="2">Stage 2 — dignity / edge-case review</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label htmlFor="qr-review-decision" className="text-xs font-medium text-foreground">Decision label</label>
                    <Input id="qr-review-decision" value={decision} onChange={(e) => setDecision(e.target.value)} maxLength={100} />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="qr-review-reason" className="text-xs font-medium text-foreground">Reason code (optional)</label>
                    <Input id="qr-review-reason" value={reasonCode} onChange={(e) => setReasonCode(e.target.value)} maxLength={100} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="qr-review-notes" className="text-xs font-medium text-foreground">Review notes (optional)</label>
                  <Textarea id="qr-review-notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={5000} className="min-h-24" />
                </div>
                <div className="flex justify-end">
                  <Button
                    type="button"
                    disabled={mutation.isPending || decision.trim().length === 0}
                    onClick={() => mutation.mutate({
                      id: selected.id,
                      status: nextStatus,
                      stage,
                      decision: decision.trim(),
                      reasonCode: reasonCode.trim(),
                      notes: notes.trim(),
                    })}
                  >
                    {mutation.isPending ? "Saving…" : "Save review"}
                  </Button>
                </div>
              </div>
            </>
            );
          })() : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
