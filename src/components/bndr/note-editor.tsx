"use client";

import { useState, useRef } from "react";
import { StickyNote, Check, X } from "lucide-react";
import { toast } from "sonner";

interface NoteEditorProps {
  resourceId: string;
  resourceName: string;
  note: string;
  maxLength: number;
  onSave: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  variant?: "inline" | "compact";
}

/**
 * Inline note editor for saved resources. Two variants:
 *  - "inline" (default): full textarea with save/cancel, used in the saved
 *    resources panel.
 *  - "compact": a single-line summary that expands into the textarea, used
 *    in the detail dialog.
 *
 * Notes are private (localStorage only) and never sent to any server.
 */
export function NoteEditor({
  resourceId,
  resourceName,
  note,
  maxLength,
  onSave,
  onDelete,
  variant = "inline",
}: NoteEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // Derive the displayed draft: when not editing, always reflect the stored
  // note (so external changes propagate); when editing, use the local draft.
  const displayedDraft = editing ? draft : note;

  const handleStartEdit = () => {
    setDraft(note);
    setEditing(true);
    setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, 50);
  };

  const handleSave = () => {
    onSave(resourceId, draft);
    setEditing(false);
    if (draft.trim() && draft.trim() !== note.trim()) {
      toast.success("Note saved", { duration: 1800 });
    } else if (!draft.trim() && note) {
      onDelete(resourceId);
      toast.success("Note cleared", { duration: 1800 });
    }
  };

  const handleCancel = () => {
    setDraft(note);
    setEditing(false);
  };

  const hasNote = note.trim().length > 0;
  const remaining = maxLength - draft.length;

  if (editing) {
    return (
      <div className="mt-2 space-y-2">
        <textarea
          ref={textareaRef}
          value={displayedDraft}
          onChange={(e) => setDraft(e.target.value.slice(0, maxLength))}
          placeholder={`Add a private note for ${resourceName}…\ne.g. "Called 3x, left message" or "Good for housing assistance"`}
          rows={3}
          className="w-full resize-none rounded-lg border border-border/60 bg-background/60 px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <div className="flex items-center justify-between">
          <span className={"text-[10px] " + (remaining < 50 ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground/50")}>
            {remaining} characters left
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handleCancel}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            >
              <X className="size-3" aria-hidden />
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-2 py-1 text-[11px] font-medium text-primary transition-colors hover:bg-primary/25"
            >
              <Check className="size-3" aria-hidden />
              Save note
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not editing — show the note or an "add note" affordance
  if (hasNote) {
    return (
      <button
        type="button"
        onClick={handleStartEdit}
        className="mt-2 flex w-full items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-left transition-colors hover:border-primary/40 hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <StickyNote className="mt-0.5 size-3.5 shrink-0 text-primary/70" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-medium uppercase tracking-wide text-primary/70">
            Your note
          </p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-foreground/90">
            {note}
          </p>
        </div>
      </button>
    );
  }

  // No note yet
  return (
    <button
      type="button"
      onClick={handleStartEdit}
      className={
        "mt-2 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border/50 px-2.5 py-1.5 text-[11px] text-muted-foreground/70 transition-colors hover:border-primary/30 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 " +
        (variant === "compact" ? "w-full justify-center" : "")
      }
    >
      <StickyNote className="size-3" aria-hidden />
      Add a private note
    </button>
  );
}
