"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Folder, Sparkles, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { AgentAvatar } from "./identity";
import { TypeBadge } from "./artifact-ui";
import { tintVar } from "@/lib/identity";
import { addArtifactsToCollection, createCollection, listArtifacts } from "@/lib/api";
import { notify } from "@/lib/notifications";
import type { Artifact } from "@/lib/types";
import type { CollectionMeta } from "@/lib/collections";

// live keyword gather — the input doubles as the rule; matches surface as you type
function gather(q: string): Artifact[] {
  const kws = q.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
  if (!kws.length) return [];
  return listArtifacts()
    .map((a) => ({ a, hits: kws.filter((k) => `${a.title} ${a.gist ?? ""}`.toLowerCase().includes(k)).length }))
    .filter((x) => x.hits > 0)
    .sort((x, y) => y.hits - x.hits)
    .slice(0, 6)
    .map((x) => x.a);
}

// Prompt-first create: one input. Name it → a plain folder (Simple). Describe it → Woven gathers matching
// artifacts live (Smart). A Popover, not a Dialog — no dimming, no modal focus trap. Filling still happens
// on the collection page; Smart just seeds + keeps itself filled.
export function NewCollectionPopover({
  trigger,
  onCreated,
}: {
  trigger: React.ReactElement;
  onCreated: (meta: CollectionMeta) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const [smart, setSmart] = React.useState(false);
  const [deselected, setDeselected] = React.useState<Set<string>>(new Set());

  const matches = React.useMemo(() => (smart ? gather(q) : []), [smart, q]);
  const chosen = matches.filter((a) => !deselected.has(a.id));
  const tint = tintVar(q || "collection");

  function reset() {
    setQ("");
    setSmart(false);
    setDeselected(new Set());
  }
  function change(next: boolean) {
    setOpen(next);
    if (!next) reset();
  }
  function toggle(id: string) {
    setDeselected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function create() {
    if (!q.trim()) return;
    const c = createCollection({
      name: q.trim(),
      color: tint,
      kind: smart ? "typed" : "simple",
      intro: smart ? q.trim() : undefined,
    });
    if (smart && chosen.length) addArtifactsToCollection(c.id, chosen.map((a) => a.id));
    onCreated({ slug: c.slug, name: c.name, color: c.color, count: smart ? chosen.length : 0 });
    notify.success("Collection created", {
      description: smart
        ? chosen.length
          ? `${chosen.length} artifact${chosen.length > 1 ? "s" : ""} gathered — Woven keeps it filled.`
          : "Smart — Woven will gather matches as artifacts arrive."
        : `Open “${c.name}” to add documents.`,
    });
    change(false);
    router.push(`/collection/${c.slug}`);
  }

  return (
    <Popover open={open} onOpenChange={change}>
      <PopoverTrigger render={trigger} />
      <PopoverContent align="start" side="right" sideOffset={10} className="w-[340px] p-0">
        {/* the one input — name it, or describe it */}
        <div className="flex items-center gap-2.5 px-3 pb-2 pt-3">
          <span className="size-5 shrink-0 rounded-md" style={{ background: tint }} />
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={smart ? "Describe what belongs…" : "Name this collection"}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
            onKeyDown={(e) => {
              if (e.key === "Enter" && q.trim()) create();
            }}
          />
        </div>

        {/* Simple vs Smart */}
        <div className="flex items-stretch gap-1 p-2">
          <ModeTab active={!smart} onClick={() => setSmart(false)} icon={Folder} label="Simple" hint="A folder you fill" />
          <ModeTab active={smart} onClick={() => setSmart(true)} icon={Sparkles} label="Smart" hint="Woven keeps it filled" />
        </div>

        {/* Smart shows what it gathered, live */}
        {smart ? (
          <div className="px-3 pb-2 pt-0.5">
            {q.trim() && matches.length ? (
              <>
                <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-primary">
                  <AgentAvatar size="sm" /> Woven gathered {chosen.length}
                </div>
                <div className="scrollbar-subtle flex max-h-44 flex-col gap-0.5 overflow-y-auto">
                  {matches.map((a) => {
                    const on = !deselected.has(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggle(a.id)}
                        className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition-colors hover:bg-foreground/[0.04]"
                      >
                        <span
                          className={cn(
                            "flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors",
                            on ? "border-primary bg-primary text-primary-foreground" : "border-foreground/25",
                          )}
                        >
                          {on ? <Check className="size-3" /> : null}
                        </span>
                        <TypeBadge type={a.type} />
                        <span className="min-w-0 flex-1 truncate text-[13px]">{a.title}</span>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="px-1 py-1 text-[12px] leading-snug text-muted-foreground">
                {q.trim()
                  ? "No matches yet — Woven will keep watching as new artifacts arrive."
                  : "Type what belongs — e.g. “onboarding & activation” — and Woven gathers matches."}
              </p>
            )}
          </div>
        ) : null}

        {/* commit */}
        <div className="mx-3 border-t" />
        <div className="flex items-center justify-end gap-2 p-2">
          <Button variant="ghost" size="sm" onClick={() => change(false)}>
            Cancel
          </Button>
          <Button size="sm" onClick={create} disabled={!q.trim()}>
            {smart && chosen.length ? `Create · ${chosen.length}` : "Create"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ModeTab({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Folder;
  label: string;
  hint: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col gap-0.5 rounded-lg border px-2.5 py-1.5 text-left transition-colors",
        active ? "border-foreground/25 bg-foreground/[0.04]" : "border-transparent hover:bg-foreground/[0.03]",
      )}
    >
      <span className="flex items-center gap-1.5 text-[13px] font-medium">
        <Icon className={cn("size-3.5", active ? "text-primary" : "text-muted-foreground")} /> {label}
      </span>
      <span className="text-[11px] text-muted-foreground">{hint}</span>
    </button>
  );
}
