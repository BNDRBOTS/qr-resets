"use client";

import { useQuery } from "@tanstack/react-query";
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
import { Phone, Mail, Globe, ArrowRight, Loader2 } from "lucide-react";
import { CATEGORIES, type CategorySlug, type Resource } from "@/lib/types";
import { formatPhoneDisplay } from "@/lib/pii";
import { Highlight } from "./highlight";

interface CategoryModalProps {
  category: CategorySlug | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenResource: (r: Resource) => void;
  onSelectCategory: (c: CategorySlug) => void;
}

const CATEGORY_NAME: Record<CategorySlug, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.name]),
) as Record<CategorySlug, string>;

const CATEGORY_DESC: Record<CategorySlug, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.description]),
) as Record<CategorySlug, string>;

/**
 * Category overview modal. Shows the category's full name + description +
 * every resource in it. Clicking a resource opens the detail dialog;
 * clicking "Browse these in the grid" closes this modal and filters the grid.
 */
export function CategoryModal({
  category,
  open,
  onOpenChange,
  onOpenResource,
  onSelectCategory,
}: CategoryModalProps) {
  const { data, isLoading } = useQuery<{ resources: Resource[]; total: number }>({
    queryKey: ["category-resources", category],
    queryFn: async () => {
      if (!category) return { resources: [], total: 0 };
      const res = await fetch(
        `/api/resources?category=${category}&limit=500&offset=0`,
        { cache: "no-store" },
      );
      if (!res.ok) throw new Error("Failed to load category resources");
      return res.json();
    },
    enabled: open && category !== null,
  });

  const resources = data?.resources ?? [];
  const info = category ? CATEGORIES.find((c) => c.slug === category) : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="border-b border-border/60 bg-card/40 px-6 pt-6 pb-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className="border-primary/40 bg-primary/10 text-primary"
            >
              Category overview
            </Badge>
            {info ? (
              <span className="text-xs text-muted-foreground">
                {resources.length} {resources.length === 1 ? "resource" : "resources"}
              </span>
            ) : null}
          </div>
          <DialogTitle className="mt-2 text-2xl font-bold leading-tight text-foreground">
            {info?.name ?? "Category"}
          </DialogTitle>
          {info ? (
            <DialogDescription className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {info.description}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-2 px-6 py-5">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading resources…
              </div>
            ) : resources.length === 0 ? (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No resources in this category.
              </p>
            ) : (
              <AnimatePresence initial={false}>
                {resources.map((r, i) => {
                  const phone = r.phoneNormalized
                    ? r.phoneNormalized.split("|")[0].trim()
                    : null;
                  const phoneDisplay = formatPhoneDisplay(phone);
                  return (
                    <motion.button
                      key={r.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.3) }}
                      type="button"
                      onClick={() => {
                        onOpenChange(false);
                        onOpenResource(r);
                      }}
                      className="group flex w-full items-start gap-3 rounded-xl border border-border/40 bg-card/30 p-3 text-left transition-all hover:border-primary/30 hover:bg-card/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.priority >= 1 ? (
                            <Badge className="border border-primary/30 bg-primary/15 px-1.5 py-0 text-[9px] text-primary">
                              Priority
                            </Badge>
                          ) : null}
                          {r.acronym ? (
                            <Badge
                              variant="secondary"
                              className="bg-secondary/70 font-mono text-[9px] uppercase"
                            >
                              {r.acronym}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm font-medium text-foreground group-hover:text-primary">
                          {r.name}
                        </p>
                        {r.description ? (
                          <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                            {r.description}
                          </p>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                          {phoneDisplay ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone className="size-3" aria-hidden />
                              <span className="font-mono tabular-nums">
                                {phoneDisplay}
                              </span>
                            </span>
                          ) : null}
                          {r.email ? (
                            <span className="inline-flex items-center gap-1 truncate">
                              <Mail className="size-3" aria-hidden />
                              <span className="truncate">{r.email}</span>
                            </span>
                          ) : null}
                          {r.website ? (
                            <span className="inline-flex items-center gap-1 truncate">
                              <Globe className="size-3" aria-hidden />
                              <span className="truncate">
                                {r.website
                                  .replace(/^https?:\/\//, "")
                                  .replace(/\/$/, "")}
                              </span>
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
                    </motion.button>
                  );
                })}
              </AnimatePresence>
            )}
          </div>
        </ScrollArea>

        {info && resources.length > 0 ? (
          <div className="border-t border-border/40 px-6 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                onOpenChange(false);
                onSelectCategory(info.slug);
              }}
              className="gap-1.5 hover:border-primary/40 hover:text-primary"
            >
              Browse these in the grid
              <ArrowRight className="size-3.5" aria-hidden />
            </Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
