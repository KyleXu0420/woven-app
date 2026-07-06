"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Folder,
  Sparkles,
  Search,
  Check,
  X,
  Layers,
  CircleDashed,
  ArrowLeft,
  ArrowRight,
  Lock,
  Globe,
  Inbox,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { AgentAvatar } from "./identity";
import { TypeBadge } from "./artifact-ui";
import { tintVar } from "@/lib/identity";
import {
  addArtifactsToCollection,
  collectionCandidateCount,
  createCollection,
  listArtifacts,
  listCollections,
  publishCollection,
  type Visibility,
} from "@/lib/api";
import { bumpGraph } from "@/lib/store";
import { notify } from "@/lib/notifications";
import type { Collection, CollectionKind } from "@/lib/types";
import type { CollectionMeta } from "@/lib/collections";

const TINTS = Array.from({ length: 12 }, (_, i) => `var(--chart-${i + 1})`);
const TYPES = ["All", "HTML", "MD", "DOC"] as const;
type TypeFilter = (typeof TYPES)[number];

type Step = "name" | "gather" | "review" | "done";
const ORDER: Step[] = ["name", "gather", "review"];
const STEP_LABEL: Record<Exclude<Step, "done">, string> = {
  name: "Name",
  gather: "Gather",
  review: "Review",
};

// the agent-first quick-start — Woven noticing a cluster. Applying it names the collection, makes it Smart,
// and seeds the real onboarding artifacts, so the common case is: accept → step through → create.
const SUGGESTION = {
  name: "Onboarding",
  rule: "Anything about onboarding & activation",
  blurb: "Woven noticed 4 artifacts about onboarding cluster together.",
};

// full-bleed override of the centered dialog — this is a workspace, not a popover. flex-col spine layout.
const FULLSCREEN =
  "inset-0 top-0 left-0 h-svh max-h-svh w-screen max-w-none translate-x-0 translate-y-0 " +
  "flex flex-col gap-0 overflow-hidden rounded-none border-0 p-0";

export function NewCollectionDialog({
  open,
  onOpenChange,
  onCreated,
  initialMembers,
  initialName,
  initialKind,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (meta: CollectionMeta) => void;
  // entry-aware seed — a warm entry (Library selection, agent cluster) pre-fills and the flow skips ahead
  initialMembers?: string[];
  initialName?: string;
  initialKind?: CollectionKind;
}) {
  const router = useRouter();

  // identity
  const [name, setName] = React.useState(initialName ?? "");
  const [color, setColor] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<CollectionKind>(initialKind ?? "simple");
  const [rule, setRule] = React.useState("");
  // the staged member set
  const [docs, setDocs] = React.useState<Set<string>>(new Set(initialMembers ?? []));
  // where in the flow
  const [step, setStep] = React.useState<Step>("name");
  const [visibility, setVisibility] = React.useState<Visibility>("workspace");
  const [created, setCreated] = React.useState<Collection | null>(null);
  const [newCandidates, setNewCandidates] = React.useState(0);
  // browser (gather step)
  const [q, setQ] = React.useState("");
  const [type, setType] = React.useState<TypeFilter>("All");
  const [source, setSource] = React.useState<string>("all");
  const lastIndex = React.useRef<number | null>(null);

  const effectiveColor = color ?? tintVar(name || "collection");

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

  const idx = ORDER.indexOf(step as Exclude<Step, "done">);
  const canAdvance = name.trim().length > 0;

  function reset() {
    setName(initialName ?? "");
    setColor(null);
    setKind(initialKind ?? "simple");
    setRule("");
    setDocs(new Set(initialMembers ?? []));
    setStep("name");
    setVisibility("workspace");
    setCreated(null);
    setNewCandidates(0);
    setQ("");
    setType("All");
    setSource("all");
    lastIndex.current = null;
  }
  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }
  function go(s: Step) {
    if (s !== "name" && !canAdvance) return;
    setStep(s);
  }
  function back() {
    if (idx > 0) setStep(ORDER[idx - 1]);
  }
  function toggleDoc(id: string) {
    setDocs((s) => {
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
    const before = collectionCandidateCount();
    const c = createCollection({
      name,
      color: effectiveColor,
      kind,
      intro: kind === "typed" ? rule : undefined,
    });
    if (docs.size) addArtifactsToCollection(c.id, [...docs]);
    if (visibility !== "workspace") publishCollection(c.slug, [...docs], visibility);
    bumpGraph();
    onCreated({ slug: c.slug, name: c.name, color: c.color, count: docs.size });
    notify.success("Collection created", {
      description:
        kind === "typed"
          ? "Smart — the agent keeps proposing matches to your Inbox."
          : `“${c.name}” is ready.`,
    });
    setNewCandidates(Math.max(0, collectionCandidateCount() - before));
    setCreated(c);
    setStep("done");
  }
  function openCollection() {
    if (created) router.push(`/collection/${created.slug}`);
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent showCloseButton={false} className={FULLSCREEN}>
        <DialogTitle className="sr-only">New collection</DialogTitle>

        {step === "done" && created ? (
          <CreatedLanding
            collection={created}
            count={docs.size}
            kind={kind}
            color={effectiveColor}
            visibility={visibility}
            newCandidates={newCandidates}
            onOpen={openCollection}
            onClose={() => handleOpenChange(false)}
          />
        ) : (
          <>
            {/* ── top bar ── */}
            <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="size-6 shrink-0 rounded-[7px]" style={{ background: effectiveColor }} />
                <h1 className="truncate text-sm font-medium">{name.trim() || "New collection"}</h1>
              </div>
              <Button variant="ghost" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
            </header>

            {/* ── step spine ── */}
            <Spine step={step as Exclude<Step, "done">} canAdvance={canAdvance} onJump={go} />

            {/* ── body: the active step ── */}
            {step === "name" ? (
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-xl space-y-7 px-6 py-10">
                  <div>
                    <h2 className="text-lg font-medium">Name this collection</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A collection groups related artifacts. Name it and pick a type — you’ll gather documents
                      next.
                    </p>
                  </div>

                  <div className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 focus-within:ring-2 focus-within:ring-ring/40">
                    <span className="size-5 shrink-0 rounded-md" style={{ background: effectiveColor }} />
                    {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
                    <input
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Q1 Planning"
                      className="min-w-0 flex-1 bg-transparent text-base outline-none"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && name.trim()) go("gather");
                      }}
                    />
                  </div>

                  {!name.trim() && onboardingIds.length ? (
                    <button
                      type="button"
                      onClick={applySuggestion}
                      className="flex w-full items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/[0.04] p-3 text-left transition-colors hover:bg-primary/[0.07]"
                    >
                      <AgentAvatar size="sm" className="mt-0.5" />
                      <span className="min-w-0">
                        <span className="block text-[13px] leading-snug text-foreground/85">{SUGGESTION.blurb}</span>
                        <span className="mt-0.5 block font-mono text-[11px] text-primary">
                          Start a smart “{SUGGESTION.name}” collection, pre-filled →
                        </span>
                      </span>
                    </button>
                  ) : null}

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
                    <div className="grid max-w-sm grid-cols-2 gap-1 rounded-lg border bg-card p-0.5">
                      <KindTab active={kind === "simple"} onClick={() => setKind("simple")} icon={Folder} label="Simple" />
                      <KindTab active={kind === "typed"} onClick={() => setKind("typed")} icon={Sparkles} label="Smart" />
                    </div>
                    {kind === "typed" ? (
                      <div className="mt-2.5 max-w-sm">
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
                      <p className="mt-1.5 text-[11px] text-muted-foreground">A folder you fill yourself.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : step === "gather" ? (
              <div className="flex min-h-0 flex-1 overflow-hidden">
                {/* LEFT — the artifact browser */}
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

                {/* RIGHT — what's gathered so far */}
                <aside className="flex w-[340px] shrink-0 flex-col border-l bg-muted/20">
                  <div className="flex items-center justify-between px-5 pb-1.5 pt-4">
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
                              Seed the “{SUGGESTION.name}” cluster →
                            </span>
                          </span>
                        </button>
                        <p className="px-1 text-[12px] leading-relaxed text-muted-foreground">
                          Check artifacts on the left to gather them. Shift-click for a range, or “Select all” to
                          pull in a whole source.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {picked.map((a) => (
                          <div key={a.id} className="flex items-center gap-2.5 rounded-lg border bg-card px-2.5 py-2">
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
            ) : (
              /* ── review ── */
              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="mx-auto w-full max-w-2xl space-y-6 px-6 py-8">
                  <div>
                    <h2 className="text-lg font-medium">Review &amp; create</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Confirm what’s inside and who can see it.</p>
                  </div>

                  <div className="flex items-center gap-3 rounded-xl border bg-card px-4 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg" style={{ background: effectiveColor }}>
                      {kind === "typed" ? (
                        <Sparkles className="size-4 text-white/90" />
                      ) : (
                        <Folder className="size-4 text-white/90" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{name.trim() || "Untitled collection"}</div>
                      <div className="text-[12px] text-muted-foreground">
                        {kind === "typed" ? "Smart collection" : "Collection"} · {docs.size} artifact
                        {docs.size === 1 ? "" : "s"}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => go("name")}
                      className="shrink-0 text-[12px] font-medium text-primary transition-opacity hover:opacity-80"
                    >
                      Edit
                    </button>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <FieldLabel>{docs.size ? `Artifacts · ${docs.size}` : "Artifacts"}</FieldLabel>
                      <button
                        type="button"
                        onClick={() => go("gather")}
                        className="text-[12px] font-medium text-primary transition-opacity hover:opacity-80"
                      >
                        Add or remove
                      </button>
                    </div>
                    {docs.size ? (
                      <div className="space-y-1.5">
                        {picked.map((a) => (
                          <div key={a.id} className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2">
                            <TypeBadge type={a.type} />
                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{a.title}</span>
                            <IconButton label="Remove" size="icon-xs" onClick={() => toggleDoc(a.id)}>
                              <X />
                            </IconButton>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-6 text-center">
                        <p className="text-[13px] text-muted-foreground">
                          {kind === "typed"
                            ? "Empty for now — the agent will propose members once it’s created."
                            : "Empty for now — you can create it and fill it later."}
                        </p>
                      </div>
                    )}
                  </div>

                  <div>
                    <FieldLabel>Who can see it</FieldLabel>
                    <div className="grid grid-cols-2 gap-2">
                      <VisCard
                        active={visibility === "workspace"}
                        onClick={() => setVisibility("workspace")}
                        icon={Lock}
                        title="Workspace only"
                        sub="Just your team space."
                      />
                      <VisCard
                        active={visibility === "public"}
                        onClick={() => setVisibility("public")}
                        icon={Globe}
                        title="Public page"
                        sub="A shareable /c/ microsite."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ── footer: summary + Back / Next / Create ── */}
            <footer className="flex shrink-0 items-center justify-between gap-4 border-t px-5 py-3">
              <p className="min-w-0 truncate text-[12px] text-muted-foreground">
                {name.trim() ? (
                  <>
                    <span className="font-medium text-foreground">{name}</span>
                    {docs.size ? ` · ${docs.size} artifact${docs.size === 1 ? "" : "s"}` : ""}
                  </>
                ) : (
                  "Name your collection to continue"
                )}
              </p>
              <div className="flex shrink-0 items-center gap-2">
                {idx > 0 ? (
                  <Button variant="ghost" onClick={back}>
                    <ArrowLeft className="size-4" /> Back
                  </Button>
                ) : null}
                {step === "review" ? (
                  <Button onClick={create} disabled={!name.trim()}>
                    {visibility !== "workspace" ? "Create & publish" : "Create collection"}
                  </Button>
                ) : (
                  <Button onClick={() => go(ORDER[idx + 1])} disabled={!canAdvance}>
                    {step === "gather" && docs.size ? `Next · ${docs.size}` : "Next"}
                    <ArrowRight className="size-4" />
                  </Button>
                )}
              </div>
            </footer>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Spine({
  step,
  canAdvance,
  onJump,
}: {
  step: Exclude<Step, "done">;
  canAdvance: boolean;
  onJump: (s: Step) => void;
}) {
  const active = ORDER.indexOf(step);
  return (
    <div className="flex shrink-0 items-center gap-2 border-b px-5 py-2.5">
      {ORDER.map((s, i) => {
        const state = i < active ? "done" : i === active ? "active" : "upcoming";
        const reachable = i <= active || canAdvance;
        return (
          <React.Fragment key={s}>
            <button
              type="button"
              onClick={() => reachable && onJump(s)}
              disabled={!reachable}
              className={cn(
                "flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors",
                reachable ? "hover:bg-foreground/[0.04]" : "cursor-default",
              )}
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium transition-colors",
                  state === "done" && "bg-primary text-primary-foreground",
                  state === "active" && "bg-foreground text-background",
                  state === "upcoming" && "border border-foreground/25 text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="size-3" /> : i + 1}
              </span>
              <span
                className={cn(
                  "text-[13px] transition-colors",
                  state === "active" ? "font-medium text-foreground" : "text-muted-foreground",
                )}
              >
                {STEP_LABEL[s as Exclude<Step, "done">]}
              </span>
            </button>
            {i < ORDER.length - 1 ? <span className="h-px w-6 bg-border" /> : null}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CreatedLanding({
  collection,
  count,
  kind,
  color,
  visibility,
  newCandidates,
  onOpen,
  onClose,
}: {
  collection: Collection;
  count: number;
  kind: CollectionKind;
  color: string;
  visibility: Visibility;
  newCandidates: number;
  onOpen: () => void;
  onClose: () => void;
}) {
  return (
    <div className="relative flex min-h-0 flex-1 flex-col items-center justify-center p-8">
      <div className="absolute right-3 top-3">
        <IconButton label="Close" size="icon-sm" onClick={onClose}>
          <X />
        </IconButton>
      </div>
      <div className="w-full max-w-md space-y-5 text-center">
        <span
          className="mx-auto flex size-14 items-center justify-center rounded-2xl"
          style={{ background: `color-mix(in srgb, ${color} 20%, var(--card))` }}
        >
          <Check className="size-7" style={{ color }} />
        </span>
        <div>
          <h2 className="text-xl font-medium">{collection.name} is ready</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {count} artifact{count === 1 ? "" : "s"} · {kind === "typed" ? "Smart" : "Simple"}
            {visibility !== "workspace" ? " · Public" : ""}
          </p>
        </div>

        {kind === "typed" && newCandidates > 0 ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/[0.04] p-3 text-left">
            <AgentAvatar size="sm" className="mt-0.5" />
            <span className="text-[13px] leading-snug text-foreground/85">
              Woven already lined up{" "}
              <span className="font-medium">
                {newCandidates} match{newCandidates === 1 ? "" : "es"}
              </span>{" "}
              — review them in your{" "}
              <span className="inline-flex items-center gap-1 font-medium text-primary">
                <Inbox className="size-3.5" />
                Inbox
              </span>
              .
            </span>
          </div>
        ) : null}

        {visibility !== "workspace" ? (
          <a
            href={`/c/${collection.slug}`}
            className="flex items-center justify-center gap-1.5 text-[13px] font-medium text-primary transition-opacity hover:opacity-80"
          >
            <Globe className="size-3.5" /> View public page
            <ArrowUpRight className="size-3.5" />
          </a>
        ) : null}

        <div className="flex flex-col gap-2 pt-1">
          <Button onClick={onOpen}>Open collection</Button>
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{children}</p>
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

function VisCard({
  active,
  onClick,
  icon: Icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Lock;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-colors",
        active ? "border-foreground/25 bg-foreground/[0.04]" : "hover:bg-foreground/[0.03]",
      )}
    >
      <span className="flex items-center gap-2">
        <Icon className={cn("size-4", active ? "text-primary" : "text-muted-foreground")} />
        <span className="text-sm font-medium">{title}</span>
        {active ? <Check className="ml-auto size-4 text-primary" /> : null}
      </span>
      <span className="text-[12px] leading-snug text-muted-foreground">{sub}</span>
    </button>
  );
}
