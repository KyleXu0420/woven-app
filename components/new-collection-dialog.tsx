"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Folder, Sparkles } from "lucide-react";
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
import { tintVar } from "@/lib/identity";
import { addArtifactsToCollection, createCollection } from "@/lib/api";
import { notify } from "@/lib/notifications";
import type { CollectionKind } from "@/lib/types";
import type { CollectionMeta } from "@/lib/collections";

const TINTS = Array.from({ length: 12 }, (_, i) => `var(--chart-${i + 1})`);

// the one agent quick-start — Woven noticing a cluster. Sets name + Smart so the collection lands
// pre-seeded (a Smart collection generates its first proposals on create).
const SUGGESTION = {
  name: "Onboarding",
  rule: "Anything about onboarding & activation",
  blurb: "Woven noticed an onboarding cluster.",
};

// Create is a light act: name it into existence, then land on the collection to fill it.
// Gathering members is NOT here — that lives on the collection page (the reusable Add picker).
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
  // warm entry (Library selection) — the picked artifacts are filed on Create; no picker needed
  initialMembers?: string[];
  initialName?: string;
  initialKind?: CollectionKind;
}) {
  const router = useRouter();
  const [name, setName] = React.useState(initialName ?? "");
  const [color, setColor] = React.useState<string | null>(null);
  const [kind, setKind] = React.useState<CollectionKind>(initialKind ?? "simple");
  const [rule, setRule] = React.useState("");

  const seedCount = initialMembers?.length ?? 0;
  const effectiveColor = color ?? tintVar(name || "collection");

  function reset() {
    setName(initialName ?? "");
    setColor(null);
    setKind(initialKind ?? "simple");
    setRule("");
  }
  function handleOpenChange(next: boolean) {
    onOpenChange(next);
    if (!next) reset();
  }
  function applySuggestion() {
    setName(SUGGESTION.name);
    setKind("typed");
    setRule(SUGGESTION.rule);
  }
  function create() {
    if (!name.trim()) return;
    const c = createCollection({
      name,
      color: effectiveColor,
      kind,
      intro: kind === "typed" ? rule : undefined,
    });
    if (seedCount) addArtifactsToCollection(c.id, initialMembers!);
    onCreated({ slug: c.slug, name: c.name, color: c.color, count: seedCount });
    notify.success("Collection created", {
      description:
        kind === "typed"
          ? "Smart — the agent proposes matches in your Inbox."
          : seedCount
            ? `${seedCount} artifact${seedCount === 1 ? "" : "s"} filed.`
            : `Open “${c.name}” to add documents.`,
    });
    handleOpenChange(false);
    router.push(`/collection/${c.slug}`);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
          <DialogDescription>
            Name it — you’ll add documents on the next page. A smart collection stays filled by the agent.
          </DialogDescription>
        </DialogHeader>

        {/* name — the hero */}
        <div className="flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 focus-within:ring-2 focus-within:ring-ring/40">
          <span className="size-5 shrink-0 rounded-md" style={{ background: effectiveColor }} />
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this collection"
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) create();
            }}
          />
        </div>

        {/* agent quick-start — only when starting cold */}
        {!name.trim() && !seedCount ? (
          <button
            type="button"
            onClick={applySuggestion}
            className="flex items-center gap-2.5 rounded-xl border border-primary/15 bg-primary/[0.04] px-3 py-2 text-left transition-colors hover:bg-primary/[0.07]"
          >
            <AgentAvatar size="sm" />
            <span className="min-w-0 text-[13px] leading-snug text-foreground/85">
              {SUGGESTION.blurb}{" "}
              <span className="font-mono text-[11px] text-primary">Start a smart “{SUGGESTION.name}” →</span>
            </span>
          </button>
        ) : null}

        {/* type */}
        <div className="grid grid-cols-2 gap-1 rounded-lg border bg-card p-0.5">
          <KindTab active={kind === "simple"} onClick={() => setKind("simple")} icon={Folder} label="Simple" />
          <KindTab active={kind === "typed"} onClick={() => setKind("typed")} icon={Sparkles} label="Smart" />
        </div>
        {kind === "typed" ? (
          <input
            value={rule}
            onChange={(e) => setRule(e.target.value)}
            placeholder="What belongs? e.g. onboarding & activation"
            className="-mt-1 w-full rounded-lg border bg-card px-2.5 py-1.5 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        ) : null}

        {/* color — a quiet row of dots */}
        <div className="flex flex-wrap items-center gap-1.5">
          {TINTS.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setColor(t)}
              aria-label={`Color ${t}`}
              className={cn(
                "size-5 rounded-md transition-transform hover:scale-110",
                effectiveColor === t && "ring-2 ring-foreground/50 ring-offset-2 ring-offset-background",
              )}
              style={{ background: t }}
            />
          ))}
        </div>

        <DialogFooter className="items-center sm:justify-between">
          {seedCount ? (
            <span className="text-[12px] text-muted-foreground sm:mr-auto">
              {seedCount} artifact{seedCount === 1 ? "" : "s"} will be added
            </span>
          ) : null}
          <div className="flex gap-2">
            <DialogClose render={<Button variant="ghost">Cancel</Button>} />
            <Button onClick={create} disabled={!name.trim()}>
              Create collection
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
