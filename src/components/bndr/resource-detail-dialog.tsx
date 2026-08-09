"use client";

import { useState } from "react";
import {
  Phone,
  Mail,
  Globe,
  MapPin,
  Sparkles,
  ExternalLink,
  Navigation,
  Info,
  Printer,
  Share2,
  Check,
  Bookmark,
  BookmarkCheck,
  ArrowLeftRight,
  User,
  Voicemail,
  MessageCircle,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { buildPrintDocument } from "@/lib/export-safety";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CATEGORIES,
  type Resource,
  type CategorySlug,
} from "@/lib/types";
import { formatPhoneDisplay } from "@/lib/pii";
import { parseTags } from "@/lib/tags";
import { NoteEditor } from "./note-editor";
import { StarRating } from "./star-rating";
import { ContactDateEditor } from "./contact-date-editor";
import { ContactLogTimeline } from "./contact-log-timeline";
import { LinkStatusDot } from "./link-status-dot";
import type { ContactLogEntry, ContactMethod } from "./use-contact-log";

const CATEGORY_NAME: Record<CategorySlug, string> = Object.fromEntries(
  CATEGORIES.map((c) => [c.slug, c.name]),
) as Record<CategorySlug, string>;

/** Icon + label for the default-contact-method badge in the header. */
const DEFAULT_METHOD_ICONS: Record<ContactMethod, typeof Phone> = {
  phone: Phone,
  email: Mail,
  "in-person": User,
  voicemail: Voicemail,
  text: MessageCircle,
  other: HelpCircle,
};
const DEFAULT_METHOD_LABELS: Record<ContactMethod, string> = {
  phone: "Phone",
  email: "Email",
  "in-person": "In person",
  voicemail: "Voicemail",
  text: "Text",
  other: "Other",
};

interface ResourceDetailDialogProps {
  resource: Resource | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isSaved?: boolean;
  onToggleSave?: (r: Resource) => void;
  isComparing?: boolean;
  onToggleCompare?: (r: Resource) => void;
  note?: string;
  onSetNote?: (id: string, text: string) => void;
  onDeleteNote?: (id: string) => void;
  noteMaxLength?: number;
  rating?: number;
  onSetRating?: (id: string, rating: number) => void;
  ratingMax?: number;
  contactedDate?: string;
  onSetContacted?: (id: string, dateStr: string) => void;
  onClearContacted?: (id: string) => void;
  // Contact-log timeline (multiple dates)
  contactLogEntries?: ContactLogEntry[];
  onAddContactLog?: (resourceId: string, date: string, note?: string, method?: ContactMethod) => void;
  onRemoveContactLog?: (resourceId: string, entryId: string) => void;
  /** Saved default contact method for this resource (auto-selects in the form). */
  defaultContactMethod?: ContactMethod;
  /** Persist/clear the default contact method for a resource. */
  onSetDefaultContactMethod?: (resourceId: string, method: ContactMethod | null) => void;
}

function phones(normalized: string | null): string[] {
  if (!normalized) return [];
  return normalized
    .split("|")
    .map((s) => s.trim())
    .filter(Boolean);
}

function mapsHref(r: Resource): string | null {
  const addr = r.address?.trim();
  if (!addr) return null;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr)}`;
}

export function ResourceDetailDialog({
  resource,
  open,
  onOpenChange,
  isSaved = false,
  onToggleSave,
  isComparing = false,
  onToggleCompare,
  note,
  onSetNote,
  onDeleteNote,
  noteMaxLength = 500,
  rating = 0,
  onSetRating,
  ratingMax = 5,
  contactedDate = "",
  onSetContacted,
  onClearContacted,
  contactLogEntries = [],
  onAddContactLog,
  onRemoveContactLog,
  defaultContactMethod,
  onSetDefaultContactMethod,
}: ResourceDetailDialogProps) {
  const [copied, setCopied] = useState(false);
  if (!resource) return null;
  const r = resource;
  const allPhones = phones(r.phoneNormalized);
  const phoneDisplay = allPhones.map(formatPhoneDisplay);
  const tags = parseTags(r.tags);
  const maps = mapsHref(r);

  const handlePrint = () => {
    // Turn 1 Scope C.2 — Use the shared safe print-document builder.
    // No resource field, source note, user note, or contact log can become
    // HTML markup (all fields are HTML-escaped by buildPrintDocument).
    const printWin = window.open("", "_blank", "width=720,height=900");
    if (!printWin) {
      toast.error("Pop-up blocked — allow pop-ups to print");
      return;
    }
    const html = buildPrintDocument(`${r.name} — BNDR. Resource Directory`, [
      {
        name: r.name,
        acronym: r.acronym,
        category: CATEGORY_NAME[r.category] ?? r.category,
        description: r.description,
        phoneRaw: phoneDisplay.join(", "),
        email: r.email,
        address: r.address,
        website: r.website,
        tags: tags.join(", "),
        sourceNote: r.sourceNote,
      },
    ]);
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    // The builder already injects window.print() on load.
  };

  const handleShare = async () => {
    const text = `${r.name}\n${r.description ?? ""}\n${phoneDisplay[0] ? "Phone: " + phoneDisplay[0] : ""}\n${r.email ? "Email: " + r.email : ""}\n${r.website ? "Web: " + r.website : ""}\n\nVia BNDR. Resource Directory`;
    try {
      if (navigator.share) {
        await navigator.share({ title: r.name, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Resource details copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not share or copy");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88vh] gap-0 overflow-hidden p-0 sm:max-w-2xl">
        {/* Header strip */}
        <div className="relative border-b border-border/60 bg-card/40 px-6 pt-6 pb-5">
          {/* Badge row — category / priority / acronym only (no action icons). */}
          <div className="flex flex-wrap items-center gap-2">
            {r.priority >= 1 ? (
              <Badge className="bg-primary/20 text-primary border border-primary/40">
                <Sparkles className="size-3" aria-hidden /> Priority
              </Badge>
            ) : null}
            {r.acronym ? (
              <Badge
                variant="secondary"
                className="bg-secondary/70 font-mono uppercase tracking-wide"
              >
                {r.acronym}
              </Badge>
            ) : null}
            <Badge variant="outline" className="text-muted-foreground">
              {CATEGORY_NAME[r.category] ?? r.category}
            </Badge>
            {r.subcategory ? (
              <span className="text-xs text-muted-foreground">
                · {r.subcategory}
              </span>
            ) : null}
            {defaultContactMethod ? (
              <Badge className="border border-primary/40 bg-primary/10 text-primary">
                {(() => {
                  const Icon = DEFAULT_METHOD_ICONS[defaultContactMethod] ?? HelpCircle;
                  return <Icon className="size-3" aria-hidden />;
                })()}
                {DEFAULT_METHOD_LABELS[defaultContactMethod] ?? defaultContactMethod}
              </Badge>
            ) : null}
          </div>
          <DialogHeader className="mt-3 space-y-1">
            <DialogTitle className="text-balance text-2xl font-bold leading-tight text-foreground">
              {r.name}
            </DialogTitle>
            <DialogDescription className="sr-only">
              Full details for {r.name}
            </DialogDescription>
          </DialogHeader>
          {/* Action row — dedicated, full-width row of icon+label buttons.
              Moved here from the badge row so the title gets its own clean
              line and the buttons have comfortable touch targets. */}
          <div className="mt-4 flex flex-wrap items-center gap-2 print:hidden">
            {onToggleSave ? (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onToggleSave(r)}
                      aria-label={isSaved ? "Remove from saved" : "Save resource"}
                      aria-pressed={isSaved}
                      className={
                        "gap-1.5 " +
                        (isSaved
                          ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                          : "bg-background/50 hover:border-primary/40 hover:text-primary")
                      }
                    >
                      {isSaved ? (
                        <BookmarkCheck className="size-4" aria-hidden />
                      ) : (
                        <Bookmark className="size-4" aria-hidden />
                      )}
                      {isSaved ? "Saved" : "Save"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {isSaved ? "Remove from saved" : "Save to my list"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            {onToggleCompare ? (
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onToggleCompare(r)}
                      aria-label={isComparing ? "Remove from comparison" : "Add to compare"}
                      aria-pressed={isComparing}
                      className={
                        "gap-1.5 " +
                        (isComparing
                          ? "border-primary/50 bg-primary/10 text-primary hover:bg-primary/20"
                          : "bg-background/50 hover:border-primary/40 hover:text-primary")
                      }
                    >
                      {isComparing ? (
                        <Check className="size-4" aria-hidden />
                      ) : (
                        <ArrowLeftRight className="size-4" aria-hidden />
                      )}
                      {isComparing ? "Comparing" : "Compare"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    {isComparing ? "Remove from comparison" : "Add to compare"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleShare}
                    aria-label="Share resource"
                    className="gap-1.5 bg-background/50 text-muted-foreground hover:border-primary/40 hover:text-primary"
                  >
                    {copied ? <Check className="size-4 text-primary" aria-hidden /> : <Share2 className="size-4" aria-hidden />}
                    {copied ? "Copied" : "Share"}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Share / copy details</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <TooltipProvider delayDuration={150}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePrint}
                    aria-label="Print resource"
                    className="gap-1.5 bg-background/50 text-muted-foreground hover:border-primary/40 hover:text-primary"
                  >
                    <Printer className="size-4" aria-hidden />
                    Print
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Print this resource</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-6 px-6 py-5">
            {/* Description */}
            {r.description ? (
              <p className="text-sm leading-relaxed text-foreground/90">
                {r.description}
              </p>
            ) : null}

            {/* Contact actions */}
            <div className="space-y-2">
              <h4 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Contact
              </h4>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {phoneDisplay.length > 0
                  ? phoneDisplay.map((p, i) => (
                      <Button
                        key={i}
                        asChild
                        variant="outline"
                        className="justify-start gap-2 hover:border-primary/40 hover:text-primary"
                      >
                        <a href={`tel:${allPhones[i]}`}>
                          <Phone className="size-4" aria-hidden /> Call · {p}
                        </a>
                      </Button>
                    ))
                  : null}
                {r.email ? (
                  <Button
                    asChild
                    variant="outline"
                    className="justify-start gap-2 hover:border-primary/40 hover:text-primary"
                  >
                    <a href={`mailto:${r.email}`}>
                      <Mail className="size-4" aria-hidden /> Email
                    </a>
                  </Button>
                ) : null}
                {r.website ? (
                  <Button
                    asChild
                    variant="outline"
                    className="justify-start gap-2 hover:border-primary/40 hover:text-primary"
                  >
                    <a
                      href={r.website}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Globe className="size-4" aria-hidden /> Visit site
                      <ExternalLink className="size-3 opacity-60" aria-hidden />
                      <LinkStatusDot resourceId={r.id} size="md" />
                    </a>
                  </Button>
                ) : null}
                {maps ? (
                  <Button
                    asChild
                    variant="outline"
                    className="justify-start gap-2 hover:border-primary/40 hover:text-primary"
                  >
                    <a
                      href={maps}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Navigation className="size-4" aria-hidden /> Directions
                    </a>
                  </Button>
                ) : null}
              </div>
            </div>

            {/* Address */}
            {r.address ? (
              <div className="space-y-1">
                <h4 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Address
                </h4>
                <p className="inline-flex items-start gap-2 text-sm text-foreground/90">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-primary/80" aria-hidden />
                  {r.address}
                </p>
              </div>
            ) : null}

            {/* Tags */}
            {tags.length > 0 ? (
              <div className="space-y-2">
                <h4 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Tags
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span
                      key={t}
                      className="rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 text-xs text-muted-foreground"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Source note */}
            {r.sourceNote ? (
              <div className="space-y-2">
                <Separator />
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <div className="flex items-start gap-2">
                    <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary/80">
                        Source note
                      </p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {r.sourceNote}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Private rating + contact date + note (only if hooks are wired) */}
            {onSetRating || onSetContacted || (onSetNote && onDeleteNote) ? (
              <div className="space-y-2">
                <Separator />
                {onSetRating ? (
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                      Your rating
                    </span>
                    <StarRating
                      resourceId={r.id}
                      resourceName={r.name}
                      rating={rating}
                      max={ratingMax}
                      onSet={onSetRating}
                      size="md"
                    />
                  </div>
                ) : null}
                {onSetContacted && onClearContacted ? (
                  <ContactDateEditor
                    resourceId={r.id}
                    resourceName={r.name}
                    date={contactedDate}
                    onSet={onSetContacted}
                    onClear={onClearContacted}
                  />
                ) : null}
                {/* Contact-log timeline (multiple dates + notes) */}
                {onAddContactLog && onRemoveContactLog ? (
                  <ContactLogTimeline
                    resourceId={r.id}
                    resourceName={r.name}
                    entries={contactLogEntries}
                    onAdd={onAddContactLog}
                    onRemove={onRemoveContactLog}
                    lastContactedDate={contactedDate}
                    defaultMethod={defaultContactMethod}
                    onSetDefaultMethod={onSetDefaultContactMethod}
                  />
                ) : null}
                {onSetNote && onDeleteNote ? (
                  <NoteEditor
                    resourceId={r.id}
                    resourceName={r.name}
                    note={note ?? ""}
                    maxLength={noteMaxLength}
                    onSave={onSetNote}
                    onDelete={onDeleteNote}
                    variant="compact"
                  />
                ) : null}
              </div>
            ) : null}

            {/* Verification footer */}
            <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
              <TooltipProvider delayDuration={150}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex items-center gap-1 cursor-help">
                      <span
                        className={
                          "size-1.5 rounded-full " +
                          (r.verified ? "bg-primary" : "bg-muted-foreground/50")
                        }
                      />
                      {r.verified ? "Verified" : "Unverified"}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    {r.verified
                      ? "Reviewed against source list"
                      : "Not yet reviewed"}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              {r.piipassAt ? (
                <span>
                  PII pass: {new Date(r.piipassAt).toLocaleDateString()}
                </span>
              ) : null}
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
