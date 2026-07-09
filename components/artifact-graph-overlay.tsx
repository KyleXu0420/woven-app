"use client";

import * as React from "react";
import { Waypoints, X } from "lucide-react";
import { LocalGraph, GraphLegend } from "./local-graph";
import { EntityProfile } from "./entity-profile";
import { WeaveBackdrop } from "./weave-backdrop";
import { getNeighborhood } from "@/lib/api";

// The full-canvas graph — the artifact's place in the knowledge web, given the whole screen. The graph IS
// the entity view (every entity is a node, every relationship an edge), so nothing re-lists it — that would
// just duplicate the canvas. Detail is on demand: click a node to peek its profile, anchored right at the
// node (the same peek as the collection map). Depth-1 keeps the web a legible ego-graph. Esc exits.
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
        <GraphLegend className="pointer-events-none absolute top-4 left-6 z-10" />
        {/* the web, given the whole canvas — click any node to peek its profile in place */}
        <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-5xl">
            <LocalGraph
              data={nb}
              onSelect={() => {}}
              renderPopover={(id, api) => {
                const n = nb.nodes.find((x) => x.id === id);
                return n ? <EntityProfile node={n} placement="popover" onSelect={api.select} /> : null;
              }}
            />
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
    </div>
  );
}
