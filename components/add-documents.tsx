"use client";

import * as React from "react";
import { Search, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TypeBadge } from "@/components/artifact-ui";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { addArtifactsToCollection, listArtifacts } from "@/lib/api";
import { notify } from "@/lib/notifications";
import type { Artifact } from "@/lib/types";

// A reusable multi-select list of artifacts — search + checkbox rows. Shared by the collection page's
// "Add documents" dialog and the create-collection flow's optional seed step.
export function DocumentPicker({
  pool,
  selected,
  onToggle,
}: {
  pool: Artifact[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  const [q, setQ] = React.useState("");
  const ql = q.trim().toLowerCase();
  const shown = ql
    ? pool.filter((a) => `${a.title} ${a.gist ?? ""}`.toLowerCase().includes(ql))
    : pool;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-ring/40">
        <Search className="size-3.5 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search documents…"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        />
      </div>
      <div className="scrollbar-subtle flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-0.5">
        {shown.length === 0 ? (
          <p className="px-1 py-6 text-center text-[13px] text-muted-foreground">
            {pool.length === 0 ? "Everything's already in here." : "No matches."}
          </p>
        ) : (
          shown.map((a) => {
            const on = selected.has(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onToggle(a.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                  on ? "border-foreground/25 bg-foreground/[0.04]" : "hover:bg-foreground/[0.03]",
                )}
              >
                <span
                  className={cn(
                    "flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25",
                  )}
                >
                  {on ? <Check className="size-3" /> : null}
                </span>
                <TypeBadge type={a.type} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{a.title}</span>
                  {a.gist ? (
                    <span className="block truncate text-[12px] text-muted-foreground">{a.gist}</span>
                  ) : null}
                </span>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// The collection page's "Add documents" dialog — files the picked artifacts into the collection.
export function AddDocumentsDialog({
  collectionId,
  collectionName,
  open,
  onOpenChange,
  onAdded,
}: {
  collectionId: string;
  collectionName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
}) {
  // recompute the pool whenever the dialog opens, so freshly-filed artifacts drop off the list
  const pool = React.useMemo(
    () => listArtifacts().filter((a) => !a.collection_ids.includes(collectionId)),
    [collectionId, open],
  );
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) setSelected(new Set());
  }
  function add() {
    if (!selected.size) return;
    addArtifactsToCollection(collectionId, [...selected]);
    notify.success(`Added to ${collectionName}`, {
      description: `${selected.size} document${selected.size > 1 ? "s" : ""} filed.`,
    });
    onAdded();
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add documents</DialogTitle>
          <DialogDescription>Pick artifacts to file into {collectionName}.</DialogDescription>
        </DialogHeader>
        <DocumentPicker pool={pool} selected={selected} onToggle={toggle} />
        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button onClick={add} disabled={!selected.size}>
            {selected.size ? `Add ${selected.size}` : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
