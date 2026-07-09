"use client";

import * as React from "react";
import { Waypoints, X } from "lucide-react";
import { LocalGraph, GraphLegend } from "./local-graph";
import { EntityProfile, NodeMark } from "./entity-profile";
import { WeaveBackdrop } from "./weave-backdrop";
import { getNeighborhood } from "@/lib/api";
import type { RefKind } from "@/lib/types";

// the entity index is grouped by kind — kinds read as plural section labels, docs first
const KIND_ORDER: RefKind[] = ["artifact", "collection", "person", "source", "decision", "topic"];
const GROUP_LABEL: Partial<Record<RefKind, string>> = {
  artifact: "Docs",
  collection: "Collections",
  person: "People",
  source: "Sources",
  decision: "Decisions",
  topic: "Topics",
};

// The full-canvas graph — the artifact's place in the knowledge web, given the room a node-link graph
// actually needs. The Connections drawer stays a scannable list; THIS is the immersive spatial view:
// the web on a canvas, paired with a rail that profiles the selected entity and indexes every entity so
// you can navigate by clicking either the graph or the list. Depth-2 neighbourhood; click a node (or a
// row) to read its profile; the profile's related chips re-focus the selection. Esc exits.
export function ArtifactGraphOverlay({
  artifactId,
  title,
  open,
  onClose,
}: {
  artifactId: string;
  title: string;
  open: boolean;
  onClose: () => void;
}) {
  // depth-1: what this doc DIRECTLY touches. The full-screen graph is a deliberate "understand this doc's
  // place" stop, not an entity browser — so the web stays legible and the rail stays scannable.
  const nb = React.useMemo(() => getNeighborhood(artifactId, 1), [artifactId]);
  const [selected, setSelected] = React.useState<string | null>(null);

  // start each visit on the artifact itself; close on Escape
  React.useEffect(() => {
    if (open) setSelected(null);
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // the entity index beside the canvas — grouped by kind (docs first), each entity a row you can focus
  const groups = React.useMemo(
    () =>
      KIND_ORDER.map((k) => ({
        kind: k,
        label: GROUP_LABEL[k] ?? k,
        nodes: nb.nodes
          .filter((n) => n.kind === k)
          .sort((a, b) => a.depth - b.depth || a.label.localeCompare(b.label)),
      })).filter((g) => g.nodes.length),
    [nb],
  );
  const node = nb.nodes.find((n) => n.id === selected) ?? nb.nodes.find((n) => n.depth === 0);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-background animate-in fade-in-0 duration-200">
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4 sm:px-6">
        <span className="inline-flex min-w-0 items-center gap-2 text-sm font-medium">
          <Waypoints className="size-4 shrink-0 text-primary" />
          Connections
          <span className="truncate text-muted-foreground">· {title}</span>
        </span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.04] hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* the web, given a canvas */}
        <div className="relative min-w-0 flex-1">
          <WeaveBackdrop />
          <GraphLegend className="pointer-events-none absolute top-4 left-6 z-10" />
          <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-10">
            <div className="w-full max-w-4xl">
              <LocalGraph data={nb} onSelect={setSelected} />
            </div>
          </div>
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 text-[11px] text-muted-foreground">
            <span className="font-medium tabular-nums text-foreground/70">{nb.nodes.length}</span> entities
            <span className="mx-1.5 opacity-50">·</span>
            <span className="font-medium tabular-nums text-foreground/70">{nb.edges.length}</span> relationships
            <span className="mx-1.5 opacity-50">·</span>
            <kbd className="rounded border px-1 font-sans">Esc</kbd> to exit
          </div>
        </div>

        {/* the rail — the selected entity's profile, then the entity index */}
        <aside className="flex w-80 shrink-0 flex-col overflow-y-auto border-l bg-muted/30">
          {node ? (
            <div className="p-3">
              <EntityProfile node={node} placement="inline" onSelect={setSelected} />
            </div>
          ) : null}
          <div className="px-3 pb-4">
            {groups.map((g) => (
              <div key={g.kind} className="mb-3">
                <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                  {g.label} <span className="ml-0.5 tabular-nums opacity-60">{g.nodes.length}</span>
                </p>
                <div className="flex flex-col">
                  {g.nodes.map((n) => {
                    const on = node?.id === n.id;
                    return (
                      <button
                        key={n.id}
                        onClick={() => setSelected(n.id)}
                        className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors ${
                          on ? "bg-card shadow-sm ring-1 ring-border" : "hover:bg-foreground/[0.04]"
                        }`}
                      >
                        <NodeMark node={n} className="size-3.5" />
                        <span className="min-w-0 flex-1 truncate text-[13px]">{n.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
