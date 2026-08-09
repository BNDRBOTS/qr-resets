"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Phone, Mail, Globe, MapPin, X, Sparkles, ArrowLeftRight, FileText, Tag } from "lucide-react";
import {
  CATEGORIES,
  type Resource,
  type CategorySlug,
} from "@/lib/types";
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

/**
 * Side-by-side resource comparison modal. Shows 2-3 resources in columns with
 * aligned rows for each field (category, description, phone, email, website,
 * address, tags, source note). Best on desktop; on mobile the table scrolls
 * horizontally.
 */
export function CompareModal({
  items,
  open,
  onOpenChange,
  onRemove,
  onClear,
  onOpenResource,
}: CompareModalProps) {
  const count = items.length;
  const canCompare = count >= 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="border-b border-border/60 bg-card/40 px-6 pt-6 pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border border-primary/40 bg-primary/15 text-primary">
              <ArrowLeftRight className="size-3" aria-hidden /> Compare
            </Badge>
            <span className="text-xs text-muted-foreground">
              {count} of 3 selected
            </span>
          </div>
          <DialogTitle className="mt-2 text-2xl font-bold leading-tight text-foreground">
            Resource Comparison
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            {canCompare
              ? "Side-by-side comparison of selected resources. Click any name to open its full details."
              : "Select at least 2 resources to compare. Use the compare icon on any resource card."}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[70vh]">
          <div className="px-6 py-5">
            {!canCompare ? (
              <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
                <div className="flex size-14 items-center justify-center rounded-full bg-muted/40">
                  <ArrowLeftRight className="size-6 text-muted-foreground/60" aria-hidden />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {count === 0
                      ? "No resources selected for comparison"
                      : "Select at least one more resource"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Click the compare icon (two arrows) on any resource card or
                    detail view to add it here. You can compare up to 3 at once.
                  </p>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <tbody>
                    {/* Header row: names + remove buttons */}
                    <tr>
                      <td className="sticky left-0 z-10 w-32 bg-background/95 pr-3 align-bottom">
                        <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/60">
                          Resource
                        </span>
                      </td>
                      {items.map((r) => (
                        <td
                          key={r.id}
                          className="min-w-[220px] border-l border-border/40 p-3 align-top"
                        >
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => {
                                  onOpenChange(false);
                                  onOpenResource(r);
                                }}
                                className="block text-left text-sm font-semibold leading-snug text-foreground transition-colors hover:text-primary focus-visible:outline-none focus-visible:underline"
                              >
                                {r.name}
                              </button>
                              {r.acronym ? (
                                <Badge
                                  variant="secondary"
                                  className="mt-1 bg-secondary/70 font-mono text-[9px] uppercase"
                                >
                                  {r.acronym}
                                </Badge>
                              ) : null}
                            </div>
                            <button
                              type="button"
                              onClick={() => onRemove(r)}
                              aria-label={`Remove ${r.name} from comparison`}
                              className="shrink-0 rounded-full p-1 text-muted-foreground/60 transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
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
                          <Badge
                            variant="outline"
                            className="border-border/60 text-[10px] text-muted-foreground"
                          >
                            {CATEGORY_NAME[r.category] ?? r.category}
                          </Badge>
                          {r.priority >= 1 ? (
                            <Badge className="ml-1 border border-primary/30 bg-primary/15 px-1 py-0 text-[9px] text-primary">
                              <Sparkles className="size-2.5" aria-hidden /> Priority
                            </Badge>
                          ) : null}
                        </CompareCell>
                      ))}
                    </CompareRow>

                    <CompareRow label="Description" icon={<FileText className="size-3.5" />}>
                      {items.map((r) => (
                        <CompareCell key={r.id}>
                          <p className="text-xs leading-relaxed text-muted-foreground">
                            {r.description ?? "—"}
                          </p>
                        </CompareCell>
                      ))}
                    </CompareRow>

                    <CompareRow label="Phone" icon={<Phone className="size-3.5" />}>
                      {items.map((r) => {
                        const all = phones(r.phoneNormalized);
                        return (
                          <CompareCell key={r.id}>
                            {all.length > 0 ? (
                              <div className="flex flex-col gap-1">
                                {all.map((p, i) => (
                                  <a
                                    key={i}
                                    href={`tel:${p}`}
                                    className="inline-flex items-center gap-1.5 text-xs text-foreground transition-colors hover:text-primary"
                                  >
                                    <Phone className="size-3 text-primary" aria-hidden />
                                    <span className="font-mono tabular-nums">
                                      {formatPhoneDisplay(p)}
                                    </span>
                                  </a>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            )}
                          </CompareCell>
                        );
                      })}
                    </CompareRow>

                    <CompareRow label="Email" icon={<Mail className="size-3.5" />}>
                      {items.map((r) => (
                        <CompareCell key={r.id}>
                          {r.email ? (
                            <a
                              href={`mailto:${r.email}`}
                              className="block truncate text-xs text-foreground transition-colors hover:text-primary"
                            >
                              {r.email}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </CompareCell>
                      ))}
                    </CompareRow>

                    <CompareRow label="Website" icon={<Globe className="size-3.5" />}>
                      {items.map((r) => (
                        <CompareCell key={r.id}>
                          {r.website ? (
                            <a
                              href={r.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block truncate text-xs text-foreground transition-colors hover:text-primary"
                            >
                              {r.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </CompareCell>
                      ))}
                    </CompareRow>

                    <CompareRow label="Address" icon={<MapPin className="size-3.5" />}>
                      {items.map((r) => (
                        <CompareCell key={r.id}>
                          {r.address ? (
                            <span className="text-xs text-muted-foreground">
                              {r.address}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </CompareCell>
                      ))}
                    </CompareRow>

                    <CompareRow label="Tags" icon={<Tag className="size-3.5" />}>
                      {items.map((r) => {
                        const tags = r.tags
                          ? r.tags.split(",").map((t) => t.trim()).filter(Boolean)
                          : [];
                        return (
                          <CompareCell key={r.id}>
                            {tags.length > 0 ? (
                              <div className="flex flex-wrap gap-1">
                                {tags.slice(0, 6).map((t) => (
                                  <span
                                    key={t}
                                    className="rounded-md bg-muted/60 px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                  >
                                    {t}
                                  </span>
                                ))}
                                {tags.length > 6 ? (
                                  <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary/80">
                                    +{tags.length - 6}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground/50">—</span>
                            )}
                          </CompareCell>
                        );
                      })}
                    </CompareRow>

                    <CompareRow label="Source" icon={<FileText className="size-3.5" />} last>
                      {items.map((r) => (
                        <CompareCell key={r.id}>
                          {r.sourceNote ? (
                            <p className="line-clamp-3 text-[11px] leading-relaxed text-muted-foreground/70">
                              {r.sourceNote}
                            </p>
                          ) : (
                            <span className="text-xs text-muted-foreground/50">—</span>
                          )}
                        </CompareCell>
                      ))}
                    </CompareRow>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </ScrollArea>

        {count > 0 ? (
          <div className="flex items-center justify-between gap-2 border-t border-border/40 px-6 py-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-muted-foreground hover:text-destructive"
            >
              <X className="size-3.5" aria-hidden />
              Clear all
            </Button>
            <p className="text-[11px] text-muted-foreground/70">
              Comparison data is stored locally in your browser.
            </p>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function CompareRow({
  label,
  icon,
  children,
  last,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  last?: boolean;
}) {
  return (
    <tr className={last ? "" : "border-b border-border/30"}>
      <td className="sticky left-0 z-10 w-32 bg-background/95 pr-3 align-top py-3">
        <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
          {icon}
          {label}
        </span>
      </td>
      {children}
    </tr>
  );
}

function CompareCell({ children }: { children: React.ReactNode }) {
  return (
    <td className="min-w-[220px] border-l border-border/40 p-3 align-top">
      {children}
    </td>
  );
}
