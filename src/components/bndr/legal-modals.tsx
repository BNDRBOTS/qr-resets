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
import { Shield, FileText, Info, AlertTriangle } from "lucide-react";
import { useSiteCopy } from "@/lib/use-site-copy";

export type LegalKind = "privacy" | "terms" | "about" | "disclaimer";

interface LegalModalsProps {
  kind: LegalKind;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function PrivacyBody() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground/80">
      <p>
        ResourceCite is operated by BNDR LLC. Visitors can browse public resource listings without creating an account.
      </p>
      <p>
        Saved resources, personal notes, search history, ratings, and similar visitor workspace preferences are kept in the visitor&apos;s browser. Administrative access is restricted to the authenticated admin area.
      </p>
      <p>
        Resource records may include public organization contact information and internal provenance, verification, and audit information. Internal administrative metadata is not presented as ordinary public listing content.
      </p>
      <p>
        Administrative changes are recorded so the resource directory can be reviewed and restored when necessary.
      </p>
    </div>
  );
}

function TermsBody() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground/80">
      <p>
        ResourceCite is an informational resource directory. Listings and contact information do not constitute legal, medical, financial, or other professional advice and do not create a professional relationship with BNDR LLC or a listed organization.
      </p>
      <p>
        Organization details and availability can change. Confirm important contact information directly with the organization before relying on it for a time-sensitive need.
      </p>
      <p>
        Inclusion in ResourceCite is not an endorsement or guarantee of availability, eligibility, quality, or outcome. Use the directory lawfully and responsibly.
      </p>
    </div>
  );
}

function AboutBody() {
  const copy = useSiteCopy();
  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground/80">
      <p>{copy.aboutText}</p>
    </div>
  );
}

function DisclaimerBody() {
  return (
    <div className="space-y-4 text-sm leading-relaxed text-foreground/80">
      <p>
        ResourceCite is not affiliated with, endorsed by, or sponsored by every organization listed. Organization names and trademarks remain the property of their respective owners.
      </p>
      <p>
        Resource information is maintained from source material and verification evidence, but contact details and program availability can change. Verify current information directly with the organization before relying on it.
      </p>
      <p>
        ResourceCite is not an emergency-dispatch service. For an immediate emergency, use the appropriate local emergency service. The Crisis Navigator provides quick access to crisis-related resources but does not replace emergency response.
      </p>
    </div>
  );
}

const CONFIG: Record<LegalKind, { title: string; icon: ReactNode; body: ReactNode }> = {
  privacy: { title: "Privacy Policy", icon: <Shield className="size-4" />, body: <PrivacyBody /> },
  terms: { title: "Terms of Use", icon: <FileText className="size-4" />, body: <TermsBody /> },
  about: { title: "About ResourceCite", icon: <Info className="size-4" />, body: <AboutBody /> },
  disclaimer: { title: "Disclaimer", icon: <AlertTriangle className="size-4" />, body: <DisclaimerBody /> },
};

export function LegalModal({ kind, trigger, open, onOpenChange }: LegalModalsProps) {
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
          <DialogDescription className="sr-only">{cfg.title} for ResourceCite by BNDR LLC.</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-4">
          <div className="space-y-4">{cfg.body}</div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
