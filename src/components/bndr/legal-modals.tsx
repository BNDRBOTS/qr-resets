"use client";

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield, FileText, Info, AlertTriangle, ClipboardList, Tag } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { TagCloud } from "./tag-cloud";

export type LegalKind = "privacy" | "terms" | "about" | "disclaimer" | "pending";

interface LegalModalsProps {
  kind: LegalKind;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const CONFIG: Record<
  LegalKind,
  { title: string; icon: ReactNode; body: ReactNode }
> = {
  privacy: {
    title: "Privacy Policy",
    icon: <Shield className="size-4" />,
    body: (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          BNDR. is a source-backed resource directory. Published listings are
          drawn from the packaged resource dataset. Where available, the system
          keeps raw source fields separately from normalized values used for
          search, display, and validation.
        </p>
        <p>
          Production directory data is stored server-side in PostgreSQL. The
          public site does not require a visitor account. Saved resources,
          notes, search history, and similar personal workspace state are kept
          in the visitor&apos;s browser storage; admin authentication uses a
          server-validated session. No advertising network is configured.
        </p>
        <p>
          Admin-created or edited resource entries pass through a normalization
          pipeline before storage. It sanitizes whitespace, derives normalized
          phone/URL/email values where applicable, and redacts bounded high-risk
          patterns from configured free-text fields. Resource mutations are
          coupled with audit records so the administrative change history can
          be reviewed.
        </p>
        <p>
          Directory edits are restricted to the authenticated admin workspace.
          Create, update, delete, publish, and cleanup operations record the
          authenticated actor and change evidence in the audit log.
        </p>
        <p>
          Because this site is a directory of public contact information, no
          account is required to view it, and no personal account data is
          collected from visitors.
        </p>
      </div>
    ),
  },
  terms: {
    title: "Terms of Use",
    icon: <FileText className="size-4" />,
    body: (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          BNDR. is an informational directory. The listings, phone numbers,
          email addresses, and website links provided here are not legal
          advice and do not establish any professional relationship between
          you and any listed organization or this site.
        </p>
        <p>
          Telephone numbers and contact details change. Always verify every
          number, address, and website before relying on it for an emergency
          or time-sensitive matter. If you are in immediate danger, call your
          local emergency services number directly.
        </p>
        <p>
          Listings are based on supplied source records and may include
          normalized or minimally restated fields. We do not endorse any
          specific organization and we are not responsible for
          the conduct, availability, or accuracy of services provided by
          third-party organizations. Any reliance you place on the listed
          information is strictly at your own risk.
        </p>
        <p>
          The site is provided &quot;as is&quot; and &quot;as available&quot;,
          without warranties of any kind, either express or implied, including
          but not limited to implied warranties of merchantability, fitness for
          a particular purpose, or non-infringement. We do not warrant that
          the site will be uninterrupted, error-free, or free of harmful
          components.
        </p>
        <p>
          By using this site you agree to use the directory information
          responsibly and lawfully, and not to misuse any contact information
          for unsolicited commercial contact, harassment, or any unlawful
          purpose.
        </p>
      </div>
    ),
  },
  about: {
    title: "About BNDR.",
    icon: <Info className="size-4" />,
    body: (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          BNDR. is a source-backed directory of victim, advocacy, and
          family-court resources. The wordmark stands alone — the brand is the
          directory.
        </p>
        <p>
          The packaged dataset preserves provenance and separates raw source
          values from normalized fields where those fields are available. The
          application does not synthesize contact details. Descriptions and
          categories can be source-derived or minimally normalized, so the UI
          does not claim that every displayed field is a verbatim transcription.
        </p>
        <p>
          Resources are organized into thirteen categories:
        </p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Child &amp; Family Abduction</li>
          <li>Crime-Victim Rights &amp; Compensation</li>
          <li>Domestic &amp; Family Violence</li>
          <li>Family Advocacy &amp; Trauma Recovery</li>
          <li>Protective Parents &amp; Family Court</li>
          <li>Gaslighting, DARVO &amp; Institutional Betrayal</li>
          <li>Parental Alienation &amp; Fathers&apos; Rights</li>
          <li>Legal Aid &amp; Court Access</li>
          <li>Attorneys &amp; Law Firms</li>
          <li>Disability &amp; Medical Advocacy</li>
          <li>Other Victim-Linked Programs</li>
          <li>Lyme Disease &amp; Co-Infections</li>
          <li>Housing, Grants &amp; Financial Aid</li>
        </ul>
        <p>
          Resources explicitly marked priority are surfaced first in search
          results and visually distinguished in the grid. Administrative edits
          pass through the same bounded validation and normalization contracts
          used by the write APIs.
        </p>
        <p>
          The deployed canonical package contains 114 published resource rows.
          The source dataset marks 103 of those rows verified and 11 unverified;
          the application preserves that distinction. Separate pending records
          remain outside the live Resource table until an admin resolves them.
        </p>
        <div className="border-t border-border/40 pt-4">
          <h4 className="mb-2 flex items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-foreground">
            <Tag className="size-3.5 text-primary" aria-hidden />
            Browse by tag
          </h4>
          <TagCloud onTagClick={(tag) => {
            // Fill the search input with the tag and close the modal.
            const input = document.querySelector<HTMLInputElement>('input[type="search"]');
            if (input) {
              const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
              setter?.call(input, tag);
              input.dispatchEvent(new Event("input", { bubbles: true }));
            }
            // Close the modal by clicking the close button or pressing Escape
            const closeBtn = document.querySelector('[role=dialog] button[aria-label]');
            const escEvent = new KeyboardEvent("keydown", { key: "Escape", bubbles: true });
            document.body.dispatchEvent(escEvent);
          }} />
        </div>
      </div>
    ),
  },
  disclaimer: {
    title: "Disclaimer",
    icon: <AlertTriangle className="size-4" />,
    body: (
      <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
        <p>
          BNDR. is not affiliated with, endorsed by, or sponsored by any of the
          organizations listed in this directory. All organization names,
          acronyms, logos, and trademarks remain the property of their
          respective owners and are referenced here solely for identification.
        </p>
        <p>
          Contact fields are drawn from the packaged source-backed dataset and
          may have normalized display/lookup forms alongside raw fields. A
          stored &quot;verified&quot; flag is evidence metadata, not a guarantee that
          a phone number or website remains current. Contact details change —
          verify before relying on them.
        </p>
        <p>
          Inclusion in this directory does not constitute a recommendation.
          The presence of an organization here means it is included in the
          packaged directory dataset; it is not an endorsement of the
          organization&apos;s services, methods, or outcomes.
        </p>
        <p>
          If you are in immediate danger, contact your local emergency services
          number directly. This directory is not a crisis response service and
          should not be your first call in an emergency.
        </p>
      </div>
    ),
  },
  pending: {
    title: "Pending Confirmation Register",
    icon: <ClipboardList className="size-4" />,
    body: <PendingBody />,
  },
};

// ---- Pending Confirmation register (live from API) ----
interface PendingEntry {
  name: string;
  reason: string;
}

function PendingBody() {
  const { data, isLoading } = useQuery<{ entries: PendingEntry[]; total: number; byReason: { reason: string; count: number }[] }>({
    queryKey: ["pending-register"],
    queryFn: async () => {
      const res = await fetch("/api/pending", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load pending register");
      return res.json();
    },
  });
  if (isLoading) {
    return (
      <div className="space-y-3 text-sm text-muted-foreground">
        <p>Loading pending register…</p>
      </div>
    );
  }
  if (!data) return null;
  return (
    <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
      <p>
        These records are kept outside the live Resource table pending admin
        review. The public register exposes only the record name and bounded
        reason; contact details, source notes, and admin notes remain private.
      </p>
      <p className="font-semibold text-foreground">
        Total pending: {data.total}
      </p>
      <div className="space-y-3">
        {data.byReason.map((g) => (
          <div key={g.reason} className="rounded-lg border border-border/60 bg-card/40 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-primary">
              {g.count} — {g.reason}
            </p>
            <ul className="mt-2 space-y-1 text-xs">
              {data.entries
                .filter((e) => e.reason === g.reason)
                .slice(0, 30)
                .map((e, i) => (
                  <li key={i} className="flex flex-wrap gap-x-2">
                    <span className="font-medium text-foreground">{e.name}</span>
                  </li>
                ))}
              {data.entries.filter((e) => e.reason === g.reason).length > 30 && (
                <li className="text-muted-foreground/60 italic">
                  …and {data.entries.filter((e) => e.reason === g.reason).length - 30} more (see full register)
                </li>
              )}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * A controlled or trigger-based legal modal. Pass `trigger` for inline use,
 * or pass `open` + `onOpenChange` for fully controlled use (e.g. from the
 * footer or header).
 */
export function LegalModal({
  kind,
  trigger,
  open,
  onOpenChange,
}: LegalModalsProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const isOpen = open ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const cfg = CONFIG[kind];

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <span className="text-primary">{cfg.icon}</span>
            {cfg.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {cfg.title} for BNDR.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">{cfg.body}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
