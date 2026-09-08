"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Phone, Mail, Globe, MapPin, X, ArrowLeftRight, FileText } from "lucide-react";
import { CATEGORIES, type Resource, type CategorySlug } from "@/lib/types";
import { formatPhoneDisplay } from "@/lib/pii";

const CATEGORY_NAME: Record<CategorySlug, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.shortName]),
) as Record<CategorySlug, string>;

interface CompareModalProps {
  items: Resource[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: (r: Resource) => void;
  onClear: () => void;
  onOpenResource: (r: Resource) => void;
}

function phones(normalized: string | null): string[] {
  if (!normalized) return [];
  return normalized.split("|").map((s) => s.trim()).filter(Boolean);
}

export function CompareModal({ items, open, onOpenChange, onRemove, onClear, onOpenResource }: CompareModalProps) {
  const count = items.length;
  const canCompare = count >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border/60 bg-card/40 px-4 pb-4 pt-5 sm:px-6 sm:pb-5 sm:pt-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border border-primary/40 bg-primary/15 text-primary">
              <ArrowLeftRight className="size-3" aria-hidden /> Compare
            </Badge>
            <span className="text-xs text-muted-foreground">{count} of 3 selected</span>
          </div>
          <DialogTitle className="mt-2 text-xl font-bold leading-tight text-foreground sm:text-2xl">Resource Comparison</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {canCompare
              ? "Swipe horizontally on mobile to reach every selected resource. Select a name to open full details."
              : "Select at least 2 resources to compare. You can compare up to 3 at once."}
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto py-4 sm:py-5">
          {!canCompare ? (
            <div className="flex flex-col items-center justify-center gap-3 px-5 py-16 text-center">
              <div className="flex size-14 items-center justify-center rounded-full bg-muted/40">
                <ArrowLeftRight className="size-6 text-muted-foreground/60" aria-hidden />
              </div>
              <p className="text-sm font-medium text-foreground">
                {count === 0 ? "No resources selected for comparison" : "Select at least one more resource"}
              </p>
            </div>
          ) : (
            <div
              className="bndr-compare-scroll w-full overflow-x-auto overscroll-x-contain px-3 pb-2 sm:px-6"
              style={{ WebkitOverflowScrolling: "touch", touchAction: "pan-x pan-y" }}
              tabIndex={0}
              aria-label="Scrollable resource comparison"
            >
              <table className="w-max min-w-full border-collapse">
                <tbody>
                  <tr>
                    <td className="sticky left-0 z-20 w-28 min-w-28 bg-background pr-3 align-bottom sm:w-32 sm:min-w-32">
                      <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Resource</span>
                    </td>
                    {items.map((r) => (
                      <td key={r.id} className="w-[220px] min-w-[220px] border-l border-border/40 p-3 align-top sm:w-[260px] sm:min-w-[260px]">
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={() => {
                                onOpenChange(false);
                                onOpenResource(r);
                              }}
                              className="block text-left text-sm font-semibold leading-snug text-foreground hover:text-primary focus-visible:underline"
                            >
                              {r.name}
                            </button>
                            {r.acronym ? (
                              <Badge variant="secondary" className="mt-1 bg-secondary/50 font-mono text-[9px] uppercase text-foreground/85">{r.acronym}</Badge>
                            ) : null}
                          </div>
                          <button
                            type="button"
                            onClick={() => onRemove(r)}
                            aria-label={`Remove ${r.name} from comparison`}
                            className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-destructive/40"
                          >
                            <X className="size-3.5" aria-hidden />
                          </button>
                        </div>
                      </td>
                    ))}
                  </tr>

                  <CompareRow label="Category" icon={<FileText className="size-3.5" />}>
                    {items.map((r) => (
                      <CompareCell key={r.id}>
                        <span className="text-xs font-medium text-foreground">{CATEGORY_NAME[r.category] ?? r.category}</span>
                      </CompareCell>
                    ))}
                  </CompareRow>

                  <CompareRow label="Description" icon={<FileText className="size-3.5" />}>
                    {items.map((r) => (
                      <CompareCell key={r.id}>
                        <p className="text-xs leading-relaxed text-foreground/85">{r.description ?? "—"}</p>
                      </CompareCell>
                    ))}
                  </CompareRow>

                  <CompareRow label="Phone" icon={<Phone className="size-3.5" />}>
                    {items.map((r) => {
                      const all = phones(r.phoneNormalized);
                      return (
                        <CompareCell key={r.id}>
                          {all.length ? (
                            <div className="flex flex-col gap-1">
                              {all.map((p, i) => (
                                <a key={i} href={`tel:${p}`} className="inline-flex items-center gap-1.5 text-xs text-foreground hover:text-primary">
                                  <Phone className="size-3 text-primary" aria-hidden />
                                  <span className="font-mono tabular-nums">{formatPhoneDisplay(p)}</span>
                                </a>
                              ))}
                            </div>
                          ) : <span className="text-xs text-muted-foreground">—</span>}
                        </CompareCell>
                      );
                    })}
                  </CompareRow>

                  <CompareRow label="Email" icon={<Mail className="size-3.5" />}>
                    {items.map((r) => (
                      <CompareCell key={r.id}>
                        {r.email ? <a href={`mailto:${r.email}`} className="block break-words text-xs text-foreground hover:text-primary">{r.email}</a> : <span className="text-xs text-muted-foreground">—</span>}
                      </CompareCell>
                    ))}
                  </CompareRow>

                  <CompareRow label="Website" icon={<Globe className="size-3.5" />}>
                    {items.map((r) => (
                      <CompareCell key={r.id}>
                        {r.website ? (
                          <a href={r.website} target="_blank" rel="noopener noreferrer" className="block break-words text-xs text-foreground hover:text-primary">
                            {r.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                          </a>
                        ) : <span className="text-xs text-muted-foreground">—</span>}
                      </CompareCell>
                    ))}
                  </CompareRow>

                  <CompareRow label="Address" icon={<MapPin className="size-3.5" />} last>
                    {items.map((r) => (
                      <CompareCell key={r.id}>
                        <span className="text-xs leading-relaxed text-foreground/85">{r.address ?? "—"}</span>
                      </CompareCell>
                    ))}
                  </CompareRow>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {count > 0 ? (
          <div className="flex items-center justify-between gap-2 border-t border-border/40 px-4 py-3 sm:px-6">
            <Button variant="ghost" size="sm" onClick={onClear} className="text-muted-foreground hover:text-destructive">
              <X className="size-3.5" aria-hidden /> Clear all
            </Button>
            <p className="hidden text-[11px] text-muted-foreground sm:block">Comparison selection stays in this browser.</p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CompareRow({ label, icon, children, last }: { label: string; icon: React.ReactNode; children: React.ReactNode; last?: boolean }) {
  return (
    <tr className={last ? "" : "border-b border-border/30"}>
      <td className="sticky left-0 z-20 w-28 min-w-28 bg-background pr-3 py-3 align-top sm:w-32 sm:min-w-32">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{icon}{label}</span>
      </td>
      {children}
    </tr>
  );
}

function CompareCell({ children }: { children: React.ReactNode }) {
  return <td className="w-[220px] min-w-[220px] border-l border-border/40 p-3 align-top sm:w-[260px] sm:min-w-[260px]">{children}</td>;
}
