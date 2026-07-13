"use client";

import * as React from "react";
import { Search, Check, X, ChevronDown } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { addArtifactsToCollection, listArtifacts, listCollections } from "@/lib/api";
import { bumpGraph } from "@/lib/store";
import { notify } from "@/lib/notifications";

// The Fill picker — one focused surface for gathering artifacts into a collection. Intention: pick.
// Hero = search + the list; selection shows as removable chips (not a side panel); "Add N" commits.
// Reused wherever a collection gets filled (the collection page's "Add documents").
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
  // pool = everything not already filed here; recomputed each open so freshly-filed artifacts drop off
  const pool = React.useMemo(
    () => listArtifacts().filter((a) => !a.collection_ids.includes(collectionId)),
    [collectionId, open],
  );
  const cols = React.useMemo(() => listCollections(), [open]);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [q, setQ] = React.useState("");
  const [source, setSource] = React.useState<string>("all"); // all | unfiled | collectionId
  const lastIndex = React.useRef<number | null>(null);

  const ql = q.trim().toLowerCase();
  const shown = pool.filter((a) => {
    const inSource =
      source === "all"
        ? true
        : source === "unfiled"
          ? a.collection_ids.length === 0
          : a.collection_ids.includes(source);
    if (!inSource) return false;
    if (ql && !`${a.title} ${a.gist ?? ""}`.toLowerCase().includes(ql)) return false;
    return true;
  });
  const picked = pool.filter((a) => selected.has(a.id));
  const sourceName =
    source === "all" ? "All artifacts" : source === "unfiled" ? "Unfiled" : cols.find((c) => c.id === source)?.name ?? "All artifacts";

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function onRowClick(i: number, id: string, e: React.MouseEvent) {
    if (e.shiftKey && lastIndex.current !== null) {
      const [lo, hi] = [lastIndex.current, i].sort((a, b) => a - b);
      const ids = shown.slice(lo, hi + 1).map((a) => a.id);
      const target = !selected.has(id);
      setSelected((s) => {
        const n = new Set(s);
        ids.forEach((x) => (target ? n.add(x) : n.delete(x)));
        return n;
      });
    } else {
      toggle(id);
    }
    lastIndex.current = i;
  }
  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) {
      setSelected(new Set());
      setQ("");
      setSource("all");
      lastIndex.current = null;
    }
  }
  function add() {
    if (!selected.size) return;
    addArtifactsToCollection(collectionId, [...selected]);
    bumpGraph(); // addArtifactsToCollection only persists — bump so the sidebar count refreshes live
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
          <DialogTitle>Add to {collectionName}</DialogTitle>
          <DialogDescription>Search your artifacts and pick what belongs here.</DialogDescription>
        </DialogHeader>

        {/* search (hero) + a quiet source scope */}
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-ring/40">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search artifacts…"
              className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-muted-foreground" />
              }
            >
              <span className="max-w-28 truncate">{sourceName}</span>
              <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-72 w-52 overflow-y-auto">
              <SourceItem active={source === "all"} onClick={() => setSource("all")} label="All artifacts" />
              <SourceItem active={source === "unfiled"} onClick={() => setSource("unfiled")} label="Unfiled" />
              <DropdownMenuSeparator />
              {cols.map((c) => (
                <SourceItem
                  key={c.id}
                  active={source === c.id}
                  onClick={() => setSource(c.id)}
                  label={c.name}
                  color={c.color}
                />
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* selection as removable chips */}
        {picked.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {picked.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a.id)}
                className="flex items-center gap-1.5 rounded-full border bg-card py-1 pl-2.5 pr-1.5 text-[13px] transition-colors hover:bg-foreground/[0.04]"
              >
                <span className="max-w-40 truncate">{a.title}</span>
                <X className="size-3 text-muted-foreground" />
              </button>
            ))}
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="ml-0.5 text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear
            </button>
          </div>
        ) : null}

        {/* the list */}
        <div className="scrollbar-subtle -mx-1 flex max-h-[46vh] min-h-40 flex-col gap-1 overflow-y-auto px-1">
          {shown.length === 0 ? (
            <p className="px-1 py-14 text-center text-[14px] text-muted-foreground">
              {pool.length === 0 ? "Everything’s already in here." : ql ? "No matches." : `Nothing in ${sourceName}.`}
            </p>
          ) : (
            shown.map((a, i) => {
              const on = selected.has(a.id);
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={(e) => onRowClick(i, a.id, e)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                    on
                      ? "border-foreground/20 bg-foreground/[0.04]"
                      : "border-transparent hover:border-border hover:bg-foreground/[0.03]",
                  )}
                >
                  <span
                    className={cn(
                      "flex size-[18px] shrink-0 items-center justify-center rounded-[5px] border transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25",
                    )}
                  >
                    {on ? <Check className="size-3" /> : null}
                  </span>
                  <TypeBadge type={a.type} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{a.title}</span>
                    {a.gist ? (
                      <span className="block truncate text-[13px] text-muted-foreground">{a.gist}</span>
                    ) : null}
                  </span>
                </button>
              );
            })
          )}
        </div>

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

function SourceItem({
  active,
  onClick,
  label,
  color,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  color?: string;
}) {
  return (
    <DropdownMenuItem onClick={onClick} className="gap-2">
      {color ? (
        <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: color }} />
      ) : (
        <span className="size-2.5 shrink-0" />
      )}
      <span className="flex-1 truncate">{label}</span>
      {active ? <Check className="size-3.5 text-primary" /> : null}
    </DropdownMenuItem>
  );
}
