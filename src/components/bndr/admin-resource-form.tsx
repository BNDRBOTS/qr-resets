"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Wand2, Save, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, type ResourceInput, type Resource } from "@/lib/types";
import { createResource, parseText, updateResource } from "@/lib/api";
import { ResourceCard } from "./resource-card";

interface AdminResourceFormProps {
  editing?: Resource | null;
  onDone?: () => void;
}

const EMPTY: ResourceInput = {
  name: "",
  acronym: null,
  description: null,
  category: "victim-rights-compensation",
  subcategory: null,
  phoneRaw: null,
  email: null,
  address: null,
  website: null,
  tags: "",
  priority: 0,
  verified: false,
  published: false,
  sourceNote: null,
};

export function AdminResourceForm({ editing, onDone }: AdminResourceFormProps) {
  const [form, setForm] = useState<ResourceInput>(
    editing
      ? {
          name: editing.name,
          acronym: editing.acronym,
          description: editing.description,
          category: editing.category,
          subcategory: editing.subcategory,
          phoneRaw: editing.phoneRaw,
          email: editing.email,
          address: editing.address,
          website: editing.website,
          tags: editing.tags,
          priority: editing.priority,
          verified: editing.verified,
          published: editing.published,
          sourceNote: editing.sourceNote,
        }
      : EMPTY,
  );
  const [pasteText, setPasteText] = useState("");
  const [parsing, setParsing] = useState(false);

  const set = <K extends keyof ResourceInput>(
    key: K,
    value: ResourceInput[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const parseMut = useMutation({
    mutationFn: (text: string) => parseText(text),
    onSuccess: (data) => {
      setForm((f) => ({ ...f, ...data.parsed }));
      toast.success("Parsed", {
        description: "Review the fields before saving.",
      });
    },
    onError: (e: Error) =>
      toast.error("Parse failed", { description: e.message }),
  });

  const saveMut = useMutation({
    mutationFn: async (input: ResourceInput) => {
      if (editing) return updateResource(editing.id, input);
      return createResource(input);
    },
    onSuccess: (r) => {
      toast.success(editing ? "Resource updated" : "Resource created", {
        description: r.name,
      });
      if (editing) {
        onDone?.();
      } else {
        setForm(EMPTY);
        setPasteText("");
      }
    },
    onError: (e: Error) =>
      toast.error("Save failed", { description: e.message }),
  });

  const handleParse = async () => {
    if (!pasteText.trim()) {
      toast.error("Paste some text first");
      return;
    }
    setParsing(true);
    try {
      await parseMut.mutateAsync(pasteText);
    } finally {
      setParsing(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    saveMut.mutate(form);
  };

  const handleReset = () => {
    setForm(EMPTY);
    setPasteText("");
  };

  // Live preview as a Resource-like object.
  const preview: Resource = {
    id: editing?.id ?? "preview",
    name: form.name || "Resource name",
    acronym: form.acronym || null,
    description: form.description || null,
    category: form.category,
    subcategory: form.subcategory || null,
    phoneRaw: form.phoneRaw || null,
    phoneNormalized: form.phoneRaw || null,
    email: form.email || null,
    address: form.address || null,
    website: form.website || null,
    tags: form.tags || "",
    priority: form.priority ?? 0,
    verified: form.verified ?? false,
    published: form.published ?? false,
    sourceNote: form.sourceNote || null,
    piipassAt: null,
    piipassNotes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Smart paste */}
        <div className="space-y-2 rounded-xl border border-primary/20 bg-primary/5 p-4">
          <Label
            htmlFor="smart-paste"
            className="flex items-center gap-2 text-primary"
          >
            <Wand2 className="size-4" aria-hidden /> Smart Paste
          </Label>
          <p className="text-xs text-muted-foreground">
            Paste unstructured text — a name, phone, email, address. We
            extract fields heuristically (no LLM, no invented data). Review
            before saving.
          </p>
          <Textarea
            id="smart-paste"
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            placeholder={"e.g.\nOrganization name\n(555) 010-0200\ncontact@example.org\nStreet address, City, State ZIP\nhttps://example.org"}
            className="min-h-24 bg-background/60 font-mono text-sm"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleParse}
            disabled={parsing}
            className="border-primary/40 text-primary hover:bg-primary/10"
          >
            <Wand2 className="size-4" aria-hidden />
            {parsing ? "Parsing…" : "Parse into form"}
          </Button>
        </div>

        {/* Standard fields */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
              placeholder="Full resource name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acronym">Acronym</Label>
            <Input
              id="acronym"
              value={form.acronym ?? ""}
              onChange={(e) => set("acronym", e.target.value || null)}
              placeholder="Optional abbreviation"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category">Category *</Label>
            <Select
              value={form.category}
              onValueChange={(v) =>
                set("category", v as ResourceInput["category"])
              }
            >
              <SelectTrigger id="category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c.slug} value={c.slug}>
                    {c.shortName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="subcategory">Subcategory</Label>
            <Input
              id="subcategory"
              value={form.subcategory ?? ""}
              onChange={(e) => set("subcategory", e.target.value || null)}
              placeholder="Optional"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={form.description ?? ""}
              onChange={(e) => set("description", e.target.value || null)}
              placeholder="Source-backed description"
              className="min-h-24"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phoneRaw">Phone (raw)</Label>
            <Input
              id="phoneRaw"
              value={form.phoneRaw ?? ""}
              onChange={(e) => set("phoneRaw", e.target.value || null)}
              placeholder="Phone number exactly as sourced"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => set("email", e.target.value || null)}
              placeholder="info@example.org"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="address">Address</Label>
            <Input
              id="address"
              value={form.address ?? ""}
              onChange={(e) => set("address", e.target.value || null)}
              placeholder="Street address, city, state, ZIP"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="website">Website</Label>
            <Input
              id="website"
              value={form.website ?? ""}
              onChange={(e) => set("website", e.target.value || null)}
              placeholder="example.org"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="tags">Tags (comma-separated)</Label>
            <Input
              id="tags"
              value={form.tags ?? ""}
              onChange={(e) => set("tags", e.target.value)}
              placeholder="hotline, advocacy, legal"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="sourceNote">Source note</Label>
            <Textarea
              id="sourceNote"
              value={form.sourceNote ?? ""}
              onChange={(e) => set("sourceNote", e.target.value || null)}
              placeholder="Provenance / 'previously described as' note"
              className="min-h-16"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap items-center gap-6 rounded-xl border border-border/80 bg-muted/30 p-4">
          <div className="flex items-center gap-2">
            <Switch
              id="priority"
              checked={(form.priority ?? 0) >= 1}
              onCheckedChange={(v) => set("priority", v ? 1 : 0)}
            />
            <Label htmlFor="priority" className="cursor-pointer">
              Priority
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="verified"
              checked={form.verified ?? false}
              onCheckedChange={(v) => set("verified", v)}
            />
            <Label htmlFor="verified" className="cursor-pointer">
              Verified against source
            </Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch
              id="published"
              checked={form.published ?? false}
              onCheckedChange={(v) => set("published", v)}
            />
            <Label htmlFor="published" className="cursor-pointer">
              Publicly visible
            </Label>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            type="submit"
            disabled={saveMut.isPending}
            className="bg-primary shadow-[var(--shadow-accent-strong)] hover:bg-primary/90"
          >
            <Save className="size-4" aria-hidden />
            {saveMut.isPending
              ? "Saving…"
              : editing
                ? "Save changes"
                : "Create resource"}
          </Button>
          {!editing ? (
            <Button
              type="button"
              variant="ghost"
              onClick={handleReset}
              disabled={saveMut.isPending}
            >
              <RotateCcw className="size-4" aria-hidden /> Reset
            </Button>
          ) : null}
        </div>
      </form>

      {/* Live preview */}
      <div className="space-y-3">
        <h3 className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Live preview
        </h3>
        <div className="bndr-card-priority bndr-card rounded-2xl">
          <ResourceCard
            resource={preview}
            onOpen={() => {
              /* no-op in preview */
            }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Preview shows how the card will appear in the directory. Saving runs
          the PII normalization pipeline and records an audit-log entry.
        </p>
      </div>
    </div>
  );
}
