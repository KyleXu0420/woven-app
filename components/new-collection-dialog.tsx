"use client";

import * as React from "react";
import { Folder, Sparkles, Search, Check, X, Layers, CircleDashed } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AgentAvatar } from "./identity";
import { TypeBadge } from "./artifact-ui";
import { tintVar } from "@/lib/identity";
import { addArtifactsToCollection, createCollection, listArtifacts, listCollections } from "@/lib/api";
import { notify } from "@/lib/notifications";
import type { CollectionKind } from "@/lib/types";
import type { CollectionMeta } from "@/lib/collections";

const TINTS = Array.from({ length: 12 }, (_, i) => `var(--chart-${i + 1})`);
const TYPES = ["All", "HTML", "MD", "DOC"] as const;
type TypeFilter = (typeof TYPES)[number];

// the agent-first quick-start — Woven noticing a cluster. Applying it seeds the collection with the real
// onboarding artifacts (not an abstract promise), names it, and makes it Smart in one click.
const SUGGESTION = {
  name: "Onboarding",
  rule: "Anything about onboarding & activation",
  blurb: "Woven noticed 4 artifacts about onboarding cluster together.",
};

// full-bleed override of the centered dialog — this is a workspace, not a popover.
const FULLSCREEN =
  "inset-0 top-0 left-0 h-svh max-h-svh w-screen max-w-none translate-x-0 translate-y-0 " +
  "grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-none border-0 p-0";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
      {children}
    </p>
  );
}

export function NewCollectionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (meta: CollectionMeta) => void;
}) {
  // identity of the collection being built
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<CollectionKind>("simple");
  const [rule, setRule] = React.useState("");
  // the staged member set — a collection is fundamentally the artifacts you gather into it
  const [docs, setDocs] = React.useState<Set<string>>(new Set());
  // left browser state
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<TypeFilter>("All");
  const [source, setSource] = React.useState<string>("all"); // "all" | "unfiled" | collectionId
  const lastIndex = React.useRef<number | null>(null);

  const effectiveColor = color ?? tintVar(name || "collection");

  // snapshot the library when the workspace opens — membership only commits on Create, so this stays stable
  const all = React.useMemo(() => listArtifacts(), [open]);
  const cols = React.useMemo(() => listCollections(), [open]);
  const onboardingIds = React.useMemo(
    () => all.filter((a) => /onboard/i.test(`${a.title} ${a.gist ?? ""}`)).slice(0, 4).map((a) => a.id),
    [all],
  );

  const ql = q.trim().toLowerCase();
  const shown = all.filter((a) => {
    const inSource =
      source === "all" ? true : source === "unfiled" ? a.collection_ids.length === 0 : a.collection_ids.includes(source);
    if (!inSource) return false;
    if (type !== "All" && a.type !== type) return false;
    if (ql && !`${a.title} ${a.gist ?? ""}`.toLowerCase().includes(ql)) return false;
    return true;
  });
  const picked = all.filter((a) => docs.has(a.id));
  const allShownIn = shown.length > 0 && shown.every((a) => docs.has(a.id));
  const sourceLabel =
    source === "all" ? "All artifacts" : source === "unfiled" ? "Unfiled" : cols.find((c) => c.id === source)?.name ?? "";

  function reset() {
    setName("");
    setColor(null);
    setKind("simple");
    setRule("");
    setDocs(new Set());
    setQ("");
    setType("All");
    setSource("all");
    lastIndex.current = null;
  }
  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }
  function toggleDoc(id: string) {
    setDocs((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  // shift-click extends a range to the clicked row's resulting state — the bulk gesture
  function onRowClick(i: number, id: string, e: React.MouseEvent) {
    if (e.shiftKey && lastIndex.current !== null) {
      const [lo, hi] = [lastIndex.current, i].sort((a, b) => a - b);
      const ids = shown.slice(lo, hi + 1).map((a) => a.id);
      const target = !docs.has(id);
      setDocs((s) => {
        const n = new Set(s);
        ids.forEach((x) => (target ? n.add(x) : n.delete(x)));
        return n;
      });
    } else {
      toggleDoc(id);
    }
    lastIndex.current = i;
  }
  function toggleAllShown() {
    setDocs((s) => {
      const n = new Set(s);
      shown.forEach((a) => (allShownIn ? n.delete(a.id) : n.add(a.id)));
      return n;
    });
  }
  function applySuggestion() {
    setName(SUGGESTION.name);
    setKind("typed");
    setRule(SUGGESTION.rule);
    if (onboardingIds.length) setDocs(new Set(onboardingIds));
  }
  function create() {
    if (!name.trim()) return;
    const c = createCollection({
      name,
      color: effectiveColor,
      kind,
      intro: kind === "typed" ? rule : undefined,
    });
    if (docs.size) addArtifactsToCollection(c.id, [...docs]);
    onCreated({ slug: c.slug, name: c.name, color: c.color, count: docs.size });
    notify.success("Collection created", {
      description:
        kind === "typed"
          ? "Smart — the agent keeps proposing matches to your Inbox."
          : docs.size
            ? `“${c.name}” · ${docs.size} artifact${docs.size > 1 ? "s" : ""} filed.`
            : `“${c.name}” is ready to fill.`,
    });
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className={FULLSCREEN}>
        <DialogTitle className="sr-only">New collection</DialogTitle>

        {/* ── top bar: live identity on the left, the commit on the right ── */}
        <header className="flex h-14 items-center justify-between gap-4 border-b px-4">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="size-6 shrink-0 rounded-[7px]" style={{ background: effectiveColor }} />
            <div className="min-w-0">
              <h1 className="truncate text-sm font-medium leading-tight">
                {name.trim() || "New collection"}
              </h1>
              <p className="truncate text-[11px] leading-tight text-muted-foreground">
                {kind === "typed" ? "Smart collection" : "Collection"}
                {docs.size ? ` · ${docs.size} artifact${docs.size > 1 ? "s" : ""}` : ""}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="ghost" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={create} disabled={!name.trim()}>
              {docs.size ? `Create · ${docs.size}` : "Create collection"}
            </Button>
          </div>
        </header>

        {/* ── body: source browser (left) · the collection (right) ── */}
        <div className="flex min-h-0 overflow-hidden">
          {/* LEFT — the artifact browser: this is where bulk gathering happens */}
          <section className="flex min-w-0 flex-1 flex-col">
            <div className="space-y-2.5 border-b px-5 py-3">
              <div className="flex items-center gap-2">
                <div className="flex flex-1 items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-ring/40">
                  <Search className="size-3.5 shrink-0 text-muted-foreground" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search artifacts…"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                  />
                </div>
                <div className="flex shrink-0 items-center gap-0.5 rounded-lg border bg-card p-0.5">
                  {TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[12px] transition-colors",
                        type === t
                          ? "bg-foreground/[0.06] font-medium text-foreground"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {/* source rail — pull from any existing collection / category */}
              <div className="scrollbar-subtle -mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5">
                <SourceChip active={source === "all"} onClick={() => setSource("all")} count={all.length}>
                  <Layers className="size-3 opacity-70" /> All
                </SourceChip>
                <SourceChip
                  active={source === "unfiled"}
                  onClick={() => setSource("unfiled")}
                  count={all.filter((a) => a.collection_ids.length === 0).length}
                >
                  <CircleDashed className="size-3 opacity-70" /> Unfiled
                </SourceChip>
                <span className="mx-0.5 h-4 w-px shrink-0 bg-border" />
                {cols.map((c) => (
                  <SourceChip
                    key={c.id}
                    active={source === c.id}
                    onClick={() => setSource(c.id)}
                    count={all.filter((a) => a.collection_ids.includes(c.id)).length}
                  >
                    <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} />
                    {c.name}
                  </SourceChip>
                ))}
              </div>
            </div>

            {/* the list */}
            <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto">
              <div className="sticky top-0 z-10 flex items-center justify-between border-b bg-popover/95 px-5 py-2 backdrop-blur-sm">
                <span className="text-[12px] text-muted-foreground">
                  <span className="font-medium text-foreground">{shown.length}</span> in {sourceLabel}
                </span>
                {shown.length > 0 ? (
                  <button
                    type="button"
                    onClick={toggleAllShown}
                    className="text-[12px] font-medium text-primary transition-opacity hover:opacity-80"
                  >
                    {allShownIn ? "Clear shown" : "Select all"}
                  </button>
                ) : null}
              </div>
              <div className="space-y-1 px-4 pb-8 pt-2">
                {shown.length === 0 ? (
                  <p className="px-1 py-16 text-center text-[13px] text-muted-foreground">
                    Nothing here{ql ? " matches your search" : ""}.
                  </p>
                ) : (
                  shown.map((a, i) => {
                    const on = docs.has(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={(e) => onRowClick(i, a.id, e)}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
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
                          <span className="block truncate text-sm font-medium">{a.title}</span>
                          {a.gist ? (
                            <span className="block truncate text-[12px] text-muted-foreground">{a.gist}</span>
                          ) : null}
                        </span>
                        <span className="shrink-0 font-mono text-[11px] text-muted-foreground/70">{a.updated}</span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </section>

          {/* RIGHT — the collection: its identity above its live contents */}
          <aside className="flex w-[380px] shrink-0 flex-col border-l bg-muted/20">
            <div className="space-y-4 border-b px-5 py-4">
              <div>
                <FieldLabel>Name</FieldLabel>
                <div className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 focus-within:ring-2 focus-within:ring-ring/40">
                  <span className="size-4 shrink-0 rounded-[5px]" style={{ background: effectiveColor }} />
                  {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Q1 Planning"
                    className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") create();
                    }}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Color</FieldLabel>
                <div className="flex flex-wrap gap-1.5">
                  {TINTS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setColor(t)}
                      aria-label={`Color ${t}`}
                      className={cn(
                        "size-6 rounded-md transition-transform hover:scale-110",
                        effectiveColor === t && "ring-2 ring-foreground/50 ring-offset-2 ring-offset-background",
                      )}
                      style={{ background: t }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <FieldLabel>Type</FieldLabel>
                <div className="grid grid-cols-2 gap-1 rounded-lg border bg-card p-0.5">
                  <KindTab active={kind === "simple"} onClick={() => setKind("simple")} icon={Folder} label="Simple" />
                  <KindTab active={kind === "typed"} onClick={() => setKind("typed")} icon={Sparkles} label="Smart" />
                </div>
                {kind === "typed" ? (
                  <div className="mt-2">
                    <input
                      value={rule}
                      onChange={(e) => setRule(e.target.value)}
                      placeholder="What belongs? e.g. onboarding & activation"
                      className="w-full rounded-lg border bg-card px-2.5 py-1.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                    />
                    <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                      The agent watches new artifacts and proposes matches to your Inbox.
                    </p>
                  </div>
                ) : (
                  <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">
                    A folder you fill yourself.
                  </p>
                )}
              </div>
            </div>

            {/* live contents */}
            <div className="flex items-center justify-between px-5 pb-1.5 pt-3.5">
              <FieldLabel>{docs.size ? `In this collection · ${docs.size}` : "In this collection"}</FieldLabel>
              {docs.size ? (
                <button
                  type="button"
                  onClick={() => setDocs(new Set())}
                  className="mb-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
                >
                  Clear
                </button>
              ) : null}
            </div>
            <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              {docs.size === 0 ? (
                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={applySuggestion}
                    className="flex w-full items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/[0.04] p-3 text-left transition-colors hover:bg-primary/[0.07]"
                  >
                    <AgentAvatar size="sm" className="mt-0.5" />
                    <span className="min-w-0">
                      <span className="block text-[13px] leading-snug text-foreground/85">{SUGGESTION.blurb}</span>
                      <span className="mt-0.5 block font-mono text-[11px] text-primary">
                        Seed a smart “{SUGGESTION.name}” collection →
                      </span>
                    </span>
                  </button>
                  <p className="px-1 text-[12px] leading-relaxed text-muted-foreground">
                    Or check artifacts on the left to gather them here. Shift-click for a range, or “Select all”
                    to pull in a whole source.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {picked.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2"
                    >
                      <TypeBadge type={a.type} />
                      <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{a.title}</span>
                      <IconButton label="Remove" size="icon-xs" onClick={() => toggleDoc(a.id)}>
                        <X />
                      </IconButton>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SourceChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] whitespace-nowrap transition-colors",
        active
          ? "border-foreground/20 bg-foreground/[0.05] text-foreground"
          : "border-transparent text-muted-foreground hover:bg-foreground/[0.04]",
      )}
    >
      {children}
      <span className={cn("tabular-nums", active ? "text-muted-foreground" : "text-muted-foreground/70")}>
        {count}
      </span>
    </button>
  );
}

function KindTab({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Folder;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-md py-1.5 text-[13px] transition-colors",
        active ? "bg-foreground/[0.06] font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className={cn("size-3.5", active ? "text-primary" : "")} /> {label}
    </button>
  );
}
