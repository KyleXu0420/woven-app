"use client";

import * as React from "react";
import { ChevronRight, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { AgentAvatar, PersonAvatar } from "./identity";
import { artifactVersions, versionBlocks } from "@/lib/api";
import { diffBlocks, diffSummary, type BlockChange, type WordOp } from "@/lib/diff";
import { notify } from "@/lib/notifications";
import type { Block } from "@/lib/types";

const TAG: Record<"added" | "removed" | "modified", { label: string; cls: string }> = {
  added: { label: "Added", cls: "bg-primary/10 text-primary" },
  removed: { label: "Removed", cls: "bg-destructive/10 text-destructive" },
  modified: { label: "Edited", cls: "bg-muted text-muted-foreground" },
};

// a run of words, colored by op — insertions inked green, deletions struck red (the word diff carries the
// edit; the neutral "Edited" tag just labels the block).
function Word({ op, text }: WordOp) {
  if (op === "keep") return <>{text}</>;
  if (op === "ins")
    return <span className="box-decoration-clone rounded-sm bg-primary/15 px-0.5 text-primary">{text}</span>;
  return (
    <span className="box-decoration-clone rounded-sm bg-destructive/10 px-0.5 text-destructive/80 line-through">
      {text}
    </span>
  );
}

function DiffBlock({ change, mode }: { change: BlockChange; mode: "changes" | "final" }) {
  const { status, block, words } = change;

  // FINAL — the selected version's clean content, no diff decorations
  if (mode === "final") {
    if (status === "removed") return null; // wasn't part of this version
    return (
      <section>
        <h3 className="text-[15px] font-semibold leading-snug">{block.heading}</h3>
        <p className="mt-1.5 text-[14px] leading-relaxed text-foreground/85">{block.text}</p>
      </section>
    );
  }

  // CHANGES — unchanged blocks are grouped into a collapsible run upstream, so they don't reach here
  if (status === "unchanged") return null;

  const tag = TAG[status];
  const tone = status === "added" ? "bg-primary/[0.05]" : status === "removed" ? "bg-destructive/[0.04]" : "";
  return (
    <section className={cn("rounded-lg", tone, status !== "modified" && "px-3 py-2.5")}>
      <div className="flex items-center gap-2">
        <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide", tag.cls)}>
          {tag.label}
        </span>
        <h3
          className={cn(
            "text-[15px] font-semibold leading-snug",
            status === "removed" && "text-muted-foreground line-through",
          )}
        >
          {block.heading}
        </h3>
      </div>
      <p
        className={cn(
          "mt-1.5 text-[14px] leading-relaxed",
          status === "removed" ? "text-muted-foreground line-through" : "text-foreground/85",
        )}
      >
        {status === "modified" && words ? words.map((w, i) => <Word key={i} op={w.op} text={w.text} />) : block.text}
      </p>
    </section>
  );
}

// a run of consecutive unchanged sections, folded away so the edits carry the eye. The fold line is
// horizontal (a collapsed-gap marker), never a left accent bar; expand to read the untouched content dimmed.
function UnchangedRun({ blocks }: { blocks: Block[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronRight className={cn("size-3.5 shrink-0 transition-transform", open && "rotate-90")} />
        <span className="shrink-0">
          {blocks.length} unchanged section{blocks.length > 1 ? "s" : ""}
        </span>
        <span className="h-px flex-1 bg-border" />
      </button>
      {open ? (
        <div className="mt-3 flex flex-col gap-4 opacity-55">
          {blocks.map((b) => (
            <section key={b.id}>
              <h3 className="text-[15px] font-semibold leading-snug">{b.heading}</h3>
              <p className="mt-1.5 text-[14px] leading-relaxed text-foreground/85">{b.text}</p>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Version history as a diff view. Left: the versions, newest-first. Right: the selected version rendered
// against its predecessor — added / removed blocks tinted, edited blocks shown with a word-level redline,
// unchanged sections dimmed. Toggle to "Final" for the clean content of that version. Format-agnostic:
// it diffs Woven's normalized blocks, so HTML / Markdown / PDF / DOC all read the same way.
export function VersionHistory({
  artifactId,
  open,
  onOpenChange,
}: {
  artifactId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const versions = artifactVersions(artifactId);
  const [selected, setSelected] = React.useState(versions[0]?.label ?? "v3");
  const [mode, setMode] = React.useState<"changes" | "final">("changes");

  React.useEffect(() => {
    if (open) {
      setSelected(versions[0]?.label ?? "v3");
      setMode("changes");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, artifactId]);

  const idx = versions.findIndex((v) => v.label === selected);
  const cur = versions[idx];
  const prev = versions[idx + 1]; // newest-first, so the predecessor is the next entry down

  const changes = React.useMemo<BlockChange[]>(() => {
    if (!cur) return [];
    const after = versionBlocks(artifactId, cur.label);
    if (!prev) return after.map((block) => ({ status: "unchanged" as const, block }));
    return diffBlocks(versionBlocks(artifactId, prev.label), after);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artifactId, cur?.label, prev?.label]);

  const effectiveMode = prev ? mode : "final";

  // group consecutive unchanged blocks into collapsible runs (changes mode only) so the edits stand out
  type Segment = { kind: "change"; change: BlockChange } | { kind: "run"; blocks: Block[] };
  const segments = React.useMemo<Segment[]>(() => {
    if (effectiveMode === "final") return changes.map((c) => ({ kind: "change", change: c }));
    const segs: Segment[] = [];
    for (const c of changes) {
      if (c.status === "unchanged") {
        const last = segs[segs.length - 1];
        if (last && last.kind === "run") last.blocks.push(c.block);
        else segs.push({ kind: "run", blocks: [c.block] });
      } else {
        segs.push({ kind: "change", change: c });
      }
    }
    return segs;
  }, [changes, effectiveMode]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[82vh] max-w-4xl flex-col gap-0 overflow-hidden p-0">
        <div className="flex shrink-0 items-center border-b px-5 py-3">
          <DialogTitle className="text-[15px] font-semibold">Version history</DialogTitle>
          <DialogDescription className="sr-only">
            Browse the document&rsquo;s versions and see what changed between them.
          </DialogDescription>
        </div>

        <div className="flex min-h-0 flex-1">
          {/* timeline */}
          <aside className="scrollbar-subtle w-60 shrink-0 overflow-y-auto border-r p-2.5">
            <ol className="flex flex-col gap-1">
              {versions.map((v) => {
                const on = v.label === selected;
                return (
                  <li key={v.id}>
                    <button
                      onClick={() => setSelected(v.label)}
                      className={cn(
                        "flex w-full items-start gap-2.5 rounded-lg p-2.5 text-left transition-colors",
                        on ? "bg-foreground/[0.05]" : "hover:bg-foreground/[0.03]",
                      )}
                    >
                      {v.by === "agent" ? (
                        <AgentAvatar size="xs" className="mt-0.5" />
                      ) : (
                        <PersonAvatar seed={v.by} name={v.byName} size="xs" className="mt-0.5" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-[11px] font-medium text-primary">{v.label}</span>
                          {v.current ? (
                            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                              Current
                            </span>
                          ) : null}
                          <span className="ml-auto shrink-0 font-mono text-[10px] text-muted-foreground">{v.at}</span>
                        </div>
                        <p className="mt-0.5 truncate text-[12px] text-foreground/80">{v.summary}</p>
                        <p className="truncate text-[11px] text-muted-foreground">{v.byName}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ol>
          </aside>

          {/* diff pane */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="flex shrink-0 items-center gap-3 border-b px-5 py-2.5">
              <span className="text-[13px] font-medium">
                {cur?.label}
                {prev ? <span className="text-muted-foreground"> vs {prev.label}</span> : null}
              </span>
              <span className="text-[12px] text-muted-foreground">{prev ? diffSummary(changes) : "First version"}</span>
              <div className="ml-auto flex items-center gap-2">
                {prev ? (
                  <div className="inline-flex items-center rounded-lg border bg-card p-0.5 text-[12px]">
                    {(["changes", "final"] as const).map((m) => (
                      <button
                        key={m}
                        onClick={() => setMode(m)}
                        className={cn(
                          "rounded-md px-2.5 py-1 font-medium transition-colors",
                          mode === m ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {m === "changes" ? "Changes" : "Final"}
                      </button>
                    ))}
                  </div>
                ) : null}
                {cur && !cur.current ? (
                  <button
                    onClick={() => {
                      notify.success(`Restored ${cur.label}`, {
                        description: "The document rolled back to this version.",
                      });
                      onOpenChange(false);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
                  >
                    <RotateCcw className="size-3.5" /> Restore
                  </button>
                ) : null}
              </div>
            </div>

            <div className="scrollbar-subtle flex-1 overflow-y-auto px-6 py-5">
              <div className="mx-auto flex max-w-2xl flex-col gap-5">
                {segments.map((seg, i) =>
                  seg.kind === "run" ? (
                    <UnchangedRun key={`run-${i}`} blocks={seg.blocks} />
                  ) : (
                    <DiffBlock key={seg.change.block.id + i} change={seg.change} mode={effectiveMode} />
                  ),
                )}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
