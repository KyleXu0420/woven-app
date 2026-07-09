"use client";

import * as React from "react";
import { Waypoints, X, Network, Terminal } from "lucide-react";
import { LocalGraph, GraphLegend } from "./local-graph";
import { EntityProfile } from "./entity-profile";
import { WeaveBackdrop } from "./weave-backdrop";
import { GraphAsk } from "./graph-ask";
import { getNeighborhood } from "@/lib/api";

// two ways to work the same web, merged into one toggle:
//   Web      — browse it visually (click a node → its profile peeks in place)
//   Terminal — query it (the Ask folds in here; an answer highlights its path across the graph)
type Mode = "web" | "terminal";
const MODES: { key: Mode; label: string; icon: typeof Network }[] = [
  { key: "web", label: "Web", icon: Network },
  { key: "terminal", label: "Terminal", icon: Terminal },
];

// The full-canvas graph — the artifact's place in the knowledge web, given the whole screen. The graph IS
// the entity view, so nothing re-lists it: detail is on demand (click a node → its profile peeks in place).
// A Web/Terminal toggle switches between browsing the web and querying it; the agent's proposed (dashed)
// links carry their trust state right on the canvas. Esc exits.
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
  const [mode, setMode] = React.useState<Mode>("web");
  const [highlight, setHighlight] = React.useState<string[]>([]);

  // each visit starts fresh — back to browsing, nothing highlighted
  React.useEffect(() => {
    if (open) {
      setMode("web");
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

        {/* the mode toggle, with the Ask folded in — Web browses the web, Terminal queries it (input appears
            only here; its answer drops below and highlights the graph). One control, centred up top. */}
        <div className="absolute top-4 left-1/2 z-20 flex w-full max-w-md -translate-x-1/2 flex-col items-center gap-2 px-4">
          <div className="pointer-events-auto flex gap-0.5 rounded-lg border bg-card/90 p-0.5 shadow-sm backdrop-blur-sm">
            {MODES.map((m) => {
              const on = mode === m.key;
              const Icon = m.icon;
              return (
                <button
                  key={m.key}
                  onClick={() => {
                    setMode(m.key);
                    if (m.key === "web") setHighlight([]);
                  }}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors ${
                    on ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="size-3.5" /> {m.label}
                </button>
              );
            })}
          </div>
          {mode === "terminal" ? (
            <div className="pointer-events-auto w-full">
              <GraphAsk centerId={artifactId} onAnswer={(res) => setHighlight(res?.path ?? [])} />
            </div>
          ) : null}
        </div>

        {/* the web, given the whole canvas — click any node to peek its profile in place */}
        <div className="absolute inset-0 flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-5xl">
            <LocalGraph
              data={nb}
              flow
              dense
              highlight={highlight}
              onSelect={() => {}}
              renderPopover={(id, api) => {
                const n = nb.nodes.find((x) => x.id === id);
                return n ? <EntityProfile node={n} placement="popover" onSelect={api.select} /> : null;
              }}
            />
          </div>
        </div>

        {/* bottom rail — the key (left) · the size (right) */}
        <div className="pointer-events-none absolute bottom-4 left-6 z-20 flex h-[30px] items-center">
          <GraphLegend compact />
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
