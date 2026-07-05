"use client";

import * as React from "react";
import { Waypoints, X } from "lucide-react";
import { LocalGraph, GraphLegend } from "./local-graph";
import { EntityProfile } from "./entity-profile";
import { getNeighborhood } from "@/lib/api";

// The full-canvas graph — the artifact's place in the knowledge web, given the room a node-link graph
// actually needs. The Connections drawer stays a scannable list; THIS is where the spatial view lives
// (the principle: a graph needs a canvas, never a reading gutter). Depth-2 neighbourhood so direct links
// are labelled and the second ring sits as faint context. Click any node to read its profile; the
// profile's related chips re-focus the selection, and Open jumps into it.
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
  const nb = React.useMemo(() => getNeighborhood(artifactId, 2), [artifactId]);
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

      <div className="relative flex-1 overflow-hidden">
        <GraphLegend className="pointer-events-none absolute top-4 left-6 z-10" />
        {/* the web, given a canvas — centred and wide */}
        <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-5xl">
            <LocalGraph data={nb} onSelect={setSelected} />
          </div>
        </div>

        {/* the selected node's profile, docked at the stage base (the artifact itself by default) */}
        {node ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center p-4 sm:p-6">
            <div className="pointer-events-auto w-full max-w-md">
              <EntityProfile node={node} placement="docked" onSelect={setSelected} />
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
