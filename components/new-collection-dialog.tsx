"use client";

import * as React from "react";
import { Folder, Sparkles, Check, Plus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentAvatar } from "./identity";
import { DocumentPicker } from "./add-documents";
import { tintVar } from "@/lib/identity";
import { addArtifactsToCollection, createCollection, listArtifacts } from "@/lib/api";
import { notify } from "@/lib/notifications";
import type { CollectionKind } from "@/lib/types";
import type { CollectionMeta } from "@/lib/collections";

const TINTS = Array.from({ length: 12 }, (_, i) => `var(--chart-${i + 1})`);

// a single agent-first quick-start — Woven noticing a cluster (the agent-proposes pattern, applied to
// collection creation). Pre-fills name + rule + smart, so the common case is one click + Create.
const SUGGESTION = {
  name: "Onboarding",
  rule: "Anything about onboarding & activation",
  blurb: "Woven noticed 4 artifacts about onboarding cluster together.",
};

function Label({ children }: { children: React.ReactNode }) {
  return <p className="mb-1.5 text-[12px] font-medium text-foreground/70">{children}</p>;
}

function KindCard({
  active,
  onClick,
  icon: Icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Folder;
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

export function NewCollectionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (meta: CollectionMeta) => void;
}) {
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<CollectionKind>("simple");
  const [rule, setRule] = React.useState("");
  const [docs, setDocs] = React.useState<Set<string>>(new Set());
  const [showDocs, setShowDocs] = React.useState(false);

  const effectiveColor = color ?? tintVar(name || "collection");

  function reset() {
    setName("");
    setColor(null);
    setKind("simple");
    setRule("");
    setDocs(new Set());
    setShowDocs(false);
  }
  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }
  function applySuggestion() {
    setName(SUGGESTION.name);
    setRule(SUGGESTION.rule);
    setKind("typed");
  }
  function toggleDoc(id: string) {
    setDocs((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
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
          ? "Smart — the agent will propose what belongs, you confirm in the Inbox."
          : `“${c.name}” is ready to fill.`,
    });
    handleOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>
            Group related artifacts. A smart collection lets the agent keep it filled.
          </DialogDescription>
        </DialogHeader>

        {/* agent quick-start — the one-click common case */}
        <button
          type="button"
          onClick={applySuggestion}
          className="flex items-start gap-2.5 rounded-xl border border-primary/15 bg-primary/[0.04] p-3 text-left transition-colors hover:bg-primary/[0.07]"
        >
          <AgentAvatar size="sm" className="mt-0.5" />
          <span className="min-w-0">
            <span className="block text-[13px] leading-snug text-foreground/85">{SUGGESTION.blurb}</span>
            <span className="mt-0.5 block font-mono text-[11px] text-primary">
              Start a smart “{SUGGESTION.name}” collection →
            </span>
          </span>
        </button>

        {/* name + live color swatch */}
        <div>
          <Label>Name</Label>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5 focus-within:ring-2 focus-within:ring-ring/40">
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

        {/* color */}
        <div>
          <Label>Color</Label>
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

        {/* type */}
        <div>
          <Label>Type</Label>
          <div className="grid grid-cols-2 gap-2">
            <KindCard
              active={kind === "simple"}
              onClick={() => setKind("simple")}
              icon={Folder}
              title="Simple"
              sub="A folder you fill yourself."
            />
            <KindCard
              active={kind === "typed"}
              onClick={() => setKind("typed")}
              icon={Sparkles}
              title="Smart"
              sub="The agent proposes what belongs."
            />
          </div>
        </div>

        {/* rule — smart only */}
        {kind === "typed" ? (
          <div>
            <Label>What belongs here?</Label>
            <input
              value={rule}
              onChange={(e) => setRule(e.target.value)}
              placeholder="Anything about onboarding & activation"
              className="w-full rounded-lg border bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              The agent watches new artifacts and proposes matches to your Inbox.
            </p>
          </div>
        ) : null}

        {/* optional: seed the collection with existing documents */}
        <div>
          <button
            type="button"
            onClick={() => setShowDocs((s) => !s)}
            className="flex w-full items-center gap-1.5 text-[12px] font-medium text-foreground/70 transition-colors hover:text-foreground"
          >
            <Plus className="size-3.5" /> Add documents
            {docs.size ? (
              <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground">{docs.size}</span>
            ) : (
              <span className="text-muted-foreground">· optional</span>
            )}
            <ChevronDown className={cn("ml-auto size-3.5 transition-transform", showDocs && "rotate-180")} />
          </button>
          {showDocs ? (
            <div className="mt-2">
              <DocumentPicker pool={listArtifacts()} selected={docs} onToggle={toggleDoc} />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="ghost">Cancel</Button>} />
          <Button onClick={create} disabled={!name.trim()}>
            Create collection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
