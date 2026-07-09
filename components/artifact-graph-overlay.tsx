"use client";

import * as React from "react";
import { Waypoints, X } from "lucide-react";
import { LocalGraph, GraphLegend } from "./local-graph";
import { EntityProfile } from "./entity-profile";
import { WeaveBackdrop } from "./weave-backdrop";
import { GraphAsk } from "./graph-ask";
import { getNeighborhood } from "@/lib/api";

// layout lenses — each answers a different question of the same web
type LayoutMode = "force" | "radial" | "arc";
const LAYOUTS: { key: LayoutMode; label: string }[] = [
  { key: "force", label: "Web" },
  { key: "radial", label: "Radial" },
  { key: "arc", label: "Timeline" },
];

// The full-canvas graph — the artifact's place in the knowledge web, given the whole screen. The graph IS
// the entity view, so nothing re-lists it: detail is on demand (click a node → its profile peeks in place).
// The web is also where you ACT on it: Ask highlights an answer path, layout lenses re-read it, and the
// agent's proposed (dashed) links are confirmed/discarded right on the canvas. Esc exits.
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
  const nb = React.useMemo(() => getNeighborhood(artifactId, 1), [artifactId]);
  const [layout, setLayout] = React.useState<LayoutMode>("force");
  const [highlight, setHighlight] = React.useState<string[]>([]);

  // each visit starts fresh
  React.useEffect(() => {
    if (open) {
      setLayout("force");
      setHighlight([]);
    }
  }, [open, artifactId]);
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

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

      <div className="relative flex-1 overflow-hidden">
        <WeaveBackdrop />

        {/* Ask the web — the one action, centred up top; its answer drops below */}
        <div className="pointer-events-none absolute top-4 left-1/2 z-20 w-full max-w-md -translate-x-1/2 px-4">
          <div className="pointer-events-auto">
            <GraphAsk centerId={artifactId} onAnswer={(res) => setHighlight(res?.path ?? [])} />
          </div>
        </div>

        {/* the web, given the whole canvas — click any node to peek its profile in place */}
        <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-5xl">
            <LocalGraph
              data={nb}
              flow
              dense
              layout={layout}
              highlight={highlight}
              onSelect={() => {}}
              renderPopover={(id, api) => {
                const n = nb.nodes.find((x) => x.id === id);
                return n ? <EntityProfile node={n} placement="popover" onSelect={api.select} /> : null;
              }}
            />
          </div>
        </div>

        {/* bottom rail — three zones, each sized to its content and aligned on one line:
            the key (left) · the lens (centre) · the size (right) */}
        <div className="pointer-events-none absolute bottom-4 left-6 z-20 flex h-[30px] items-center">
          <GraphLegend compact />
        </div>
        <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 gap-0.5 rounded-lg border bg-card/90 p-0.5 shadow-sm backdrop-blur-sm">
          {LAYOUTS.map((l) => (
            <button
              key={l.key}
              onClick={() => setLayout(l.key)}
              className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                layout === l.key ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
        <div className="pointer-events-none absolute bottom-4 right-6 z-20 flex h-[30px] items-center text-[11px] text-muted-foreground">
          <span className="font-medium tabular-nums text-foreground/70">{nb.nodes.length}</span>
          <span className="ml-1">entities</span>
          <span className="mx-1.5 opacity-50">·</span>
          <span className="font-medium tabular-nums text-foreground/70">{nb.edges.length}</span>
          <span className="ml-1">relationships</span>
          <span className="mx-1.5 opacity-50">·</span>
          <kbd className="rounded border px-1 font-sans">Esc</kbd>
        </div>
      </div>
    </div>
  );
}
