"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Eye, FilePenLine, History, RotateCcw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SITE_COPY_DEFAULTS, normalizeSiteCopy, type SiteCopyContent } from "@/lib/site-copy";

interface Revision {
  id: string;
  actor: string;
  status: string;
  contentJson: SiteCopyContent;
  createdAt: string;
  publishedAt: string | null;
}

interface SiteCopyState {
  published: { id: string | null; contentJson: SiteCopyContent; publishedAt: string | null };
  draft: Revision | null;
  history: Revision[];
}

async function request<T>(method: "GET" | "POST", body?: unknown): Promise<T> {
  const res = await fetch("/api/admin/site-copy", {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    const payload = await res.json().catch(() => ({}));
    throw new Error(payload?.error?.message ?? payload?.error ?? `Request failed (${res.status})`);
  }
  return res.json();
}

const FIELDS: Array<{ key: keyof SiteCopyContent; label: string; hint: string }> = [
  { key: "heroIntro", label: "Hero introduction", hint: "Short explanation beneath the ResourceCite product name." },
  { key: "categoryIntro", label: "Category introduction", hint: "Short guidance above Browse by Category." },
  { key: "footerIntro", label: "Footer introduction", hint: "Plain description of ResourceCite in the footer." },
  { key: "provenanceNote", label: "Listing accuracy note", hint: "One concise public note about source records and changing contact information." },
  { key: "aboutText", label: "About text", hint: "Minimal factual identification only; do not add marketing claims." },
];

export function AdminSiteCopy() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery<SiteCopyState>({
    queryKey: ["admin-site-copy"],
    queryFn: () => request("GET"),
  });
  const [form, setForm] = useState<SiteCopyContent>({ ...SITE_COPY_DEFAULTS });
  const [initializedFrom, setInitializedFrom] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    const sourceId = data.draft?.id ?? data.published.id ?? "defaults";
    if (initializedFrom === sourceId) return;
    setForm(normalizeSiteCopy(data.draft?.contentJson ?? data.published.contentJson));
    setInitializedFrom(sourceId);
  }, [data, initializedFrom]);

  const mutate = useMutation({
    mutationFn: (body: unknown) => request<{ ok: true; revision: Revision }>("POST", body),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["admin-site-copy"] }),
        qc.invalidateQueries({ queryKey: ["site-copy"] }),
        qc.invalidateQueries({ queryKey: ["audit"] }),
      ]);
    },
    onError: (error: Error) => toast.error("Site copy update failed", { description: error.message }),
  });

  const saveDraft = async () => {
    try {
      await mutate.mutateAsync({ action: "save-draft", content: form });
      setInitializedFrom(null);
      toast.success("Draft saved", { description: "Public ResourceCite copy has not changed." });
    } catch {
      // handled by mutation
    }
  };

  const publishDraft = async () => {
    const id = data?.draft?.id;
    if (!id) return;
    if (!confirm("Publish this ResourceCite copy now? Visitors will immediately see these text changes. The prior published revision remains available in history and can be restored.")) return;
    try {
      await mutate.mutateAsync({ action: "publish", revisionId: id });
      setInitializedFrom(null);
      toast.success("ResourceCite copy published");
    } catch {
      // handled by mutation
    }
  };

  const restore = async (revision: Revision) => {
    if (!confirm(`Restore the ResourceCite copy from ${new Date(revision.createdAt).toLocaleString()}? This creates a new published revision; current and prior revisions remain in history.`)) return;
    try {
      await mutate.mutateAsync({ action: "restore", revisionId: revision.id });
      setInitializedFrom(null);
      toast.success("Prior copy restored as a new published revision");
    } catch {
      // handled by mutation
    }
  };

  if (isLoading) {
    return <div className="h-48 animate-pulse rounded-xl bg-muted/40" />;
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <Card className="border-border/70 bg-card/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <FilePenLine className="size-5 text-primary" aria-hidden />
              ResourceCite site copy
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Only the approved ResourceCite text blocks below are editable. QR Resets copy, layout, data, and application behavior are outside this editor.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            {FIELDS.map((field) => (
              <div key={field.key} className="space-y-2">
                <Label htmlFor={`site-copy-${field.key}`}>{field.label}</Label>
                <Textarea
                  id={`site-copy-${field.key}`}
                  value={form[field.key]}
                  onChange={(event) => setForm((current) => ({ ...current, [field.key]: event.target.value }))}
                  rows={field.key === "provenanceNote" ? 4 : 3}
                  maxLength={field.key === "provenanceNote" ? 1000 : 500}
                  className="resize-y bg-background/60"
                />
                <p className="text-xs text-muted-foreground">{field.hint}</p>
              </div>
            ))}
            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
              <Button variant="outline" onClick={saveDraft} disabled={mutate.isPending}>
                <FilePenLine className="size-4" aria-hidden /> Save draft
              </Button>
              <Button onClick={publishDraft} disabled={mutate.isPending || !data?.draft}>
                <Send className="size-4" aria-hidden /> Publish saved draft
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Eye className="size-5 text-primary" aria-hidden /> Preview
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">ResourceCite</p>
              <p className="mt-2 text-sm leading-relaxed text-foreground">{form.heroIntro}</p>
            </div>
            <div className="border-t border-border/60 pt-4">
              <p className="font-semibold text-foreground">Browse by Category</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{form.categoryIntro}</p>
            </div>
            <div className="border-t border-border/60 pt-4">
              <p className="text-sm leading-relaxed text-foreground">{form.footerIntro}</p>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{form.provenanceNote}</p>
            </div>
            <div className="border-t border-border/60 pt-4">
              <p className="font-semibold text-foreground">About</p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{form.aboutText}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/70 bg-card/40">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="size-4 text-primary" aria-hidden /> Revision history
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data?.history.length ? (
            <div className="divide-y divide-border/50 rounded-lg border border-border/60">
              {data.history.map((revision) => (
                <div key={revision.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground">
                      {revision.status === "published" ? "Published" : revision.status === "draft" ? "Draft" : "Prior revision"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(revision.createdAt).toLocaleString()} · {revision.actor}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => restore(revision)} disabled={mutate.isPending}>
                    <RotateCcw className="size-3.5" aria-hidden /> Restore as published
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No saved revisions yet. The built-in ResourceCite copy is currently active.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
