"use client";

import * as React from "react";
import { Search, ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocalGraph, GraphLegend } from "./local-graph";
import { TimelineView } from "./timeline-view";
import { useSearch } from "./search";
import { EntityProfile } from "./entity-profile";
import { SegToggle } from "./controls";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { NodeMark } from "./entity-profile";
import { getNeighborhood, nodeRelations, relationCount } from "@/lib/api";
import type { EdgeType, GraphNode, Neighborhood } from "@/lib/types";

// FocusPicker — browse + pick who/what the explorer is centred on. The graph stays the "show me"; this
// is how you move the lens across the FULL set (search, then click to re-focus) instead of only clicking
// nodes or reaching for ⌘K. Sorted by connection count so the busiest entities lead.
function FocusPicker({
  entities,
  currentId,
  onSelect,
}: {
  entities: { id: string; name: string }[];
  currentId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const current = entities.find((e) => e.id === currentId);
  const ql = q.trim().toLowerCase();
  const shown = entities
    .filter((e) => e.name.toLowerCase().includes(ql))
    .sort((a, b) => relationCount(b.id) - relationCount(a.id));

  function pick(id: string) {
    onSelect(id);
    setOpen(false);
    setQ("");
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger className="inline-flex h-8 min-w-0 max-w-[15rem] shrink items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium outline-none transition-colors hover:bg-muted data-[popup-open]:bg-secondary data-[popup-open]:text-foreground">
        <span className="truncate">{current?.name ?? "Pick one"}</span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1.5">
        <div className="mb-1.5 flex items-center gap-2 rounded-lg border bg-card px-2.5 py-1.5">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search…"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="scrollbar-subtle flex max-h-72 flex-col overflow-y-auto">
          {shown.length ? (
            shown.map((e) => {
              const sel = e.id === currentId;
              return (
                <button
                  key={e.id}
                  onClick={() => pick(e.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-foreground/[0.04]",
                    sel && "bg-foreground/[0.04]",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    {relationCount(e.id)}
                  </span>
                  {sel ? <Check className="size-3.5 shrink-0 text-primary" /> : null}
                </button>
              );
            })
          ) : (
            <p className="px-2 py-6 text-center text-[13px] text-muted-foreground">No matches.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// [out-verb, in-verb] per edge type — read from the focused node's POV
const VERB: Record<EdgeType, [string, string]> = {
  links_to: ["links to", "linked from"],
  sourced_from: ["sourced from", "source for"],
  mentions: ["mentions", "mentioned by"],
  in_collection: ["in", "contains"],
  authored_by: ["by", "authored"],
  decided: ["decided", "decided in"],
  supersedes: ["supersedes", "superseded by"],
};

// ListView — the focus's neighbourhood AS A LIST (relations from the focus's POV). Same focus + filter
// as the graph; each row is a neighbour, click to re-focus. "The list is the truth; the graph is the
// show me" — same data, listed instead of drawn.
function ListView({ centerId, onSelect }: { centerId: string; onSelect: (id: string) => void }) {
  const rels = nodeRelations(centerId);
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      {rels.length ? (
        rels.map((r) => (
          <button
            key={r.edge_id}
            onClick={() => onSelect(r.target_id)}
            className="flex w-full items-center gap-3 border-t px-4 py-3 text-left transition-colors first:border-t-0 hover:bg-foreground/[0.025]"
          >
            <NodeMark node={{ id: r.target_id, kind: r.kind }} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{r.label}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {VERB[r.edgeType][r.dir === "out" ? 0 : 1]}
                {r.prov === "ai_generated" ? " · proposed" : ""}
              </div>
            </div>
            <span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground/70">
              {r.kind}
            </span>
          </button>
        ))
      ) : (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">
          No relations yet.
        </p>
      )}
    </div>
  );
}

// GraphView — the relationship view: a pure graph canvas (just the field + a corner legend, no
// controls, no overlay) with the focused entity's profile BELOW it, outside the canvas. depth lives
// up in the explorer control row now; the profile sits in the open rather than floating over nodes.
function GraphView({
  nb,
  center,
  onSelect,
  controls,
}: {
  nb: Neighborhood;
  center?: GraphNode;
  onSelect: (id: string) => void;
  controls?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      {/* the graph canvas — a pure field */}
      <div className="relative overflow-hidden rounded-2xl border bg-card">
        <div className="px-4 pt-8 pb-8 sm:px-6">
          <LocalGraph data={nb} onSelect={onSelect} />
        </div>
        {/* the one honest key — forest = focused, solid/dashed = confirmed/proposed, shape = type */}
        <GraphLegend className="pointer-events-none absolute top-3 left-4 sm:left-6" />
        {/* controls — depth + filter, floated in the top-right corner (balances the legend) */}
        {controls ? (
          <div className="absolute top-3 right-4 flex items-center gap-2 sm:right-6">{controls}</div>
        ) : null}
      </div>

      {/* the focused entity's profile — below the graph, outside the canvas */}
      {center ? <EntityProfile node={center} placement="inline" onSelect={onSelect} /> : null}
    </div>
  );
}

// Explorer — the shell: one focus (the unified search, Find mode) + one filter (FilterBar) → a view switcher → the
// active view, all sharing focus + filter. List arrives when Library folds in.
// (See woven/product/explorer-framework.md.)
export function Explorer({ entities }: { entities: { id: string; name: string }[] }) {
  const [centerId, setCenterId] = React.useState(entities[0]?.id ?? "");
  const [view, setView] = React.useState("graph");
  const [depth, setDepth] = React.useState("1");

  // register this explorer's re-center fn so the global search's "Find → Focus on this" lands here
  const { registerFocus } = useSearch();
  React.useEffect(() => {
    registerFocus(setCenterId);
    return () => registerFocus(null);
  }, [registerFocus]);

  const nb = getNeighborhood(centerId, Number(depth));
  const center = nb.nodes.find((n) => n.depth === 0);

  // the depth toggle rides in the graph's own top-right corner (see GraphView)
  const depthEl = (
    <div className="flex items-center gap-1">
      {[
        { id: "1", label: "Direct" },
        { id: "2", label: "Extended" },
      ].map((o) => (
        <button
          key={o.id}
          onClick={() => setDepth(o.id)}
          aria-pressed={depth === o.id}
          className={`rounded-full px-3 py-1.5 text-[11px] font-medium transition-colors ${
            depth === o.id ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
  return (
    <div>
      {/* control row — the focus picker (who/what you're exploring; browse to switch) on the left, the
          view switcher on the right. The graph is the default; depth rides in its corner. */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <FocusPicker entities={entities} currentId={centerId} onSelect={setCenterId} />
        <SegToggle
          options={[
            { id: "list", label: "List" },
            { id: "graph", label: "Graph" },
            { id: "timeline", label: "Timeline" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      <div className="mt-4">
        {view === "timeline" ? (
          center ? (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <TimelineView center={center} />
            </div>
          ) : (
            <div className="flex h-80 items-center justify-center rounded-2xl border bg-card text-sm text-muted-foreground">
              Select an entity to explore.
            </div>
          )
        ) : view === "list" ? (
          <ListView centerId={centerId} onSelect={setCenterId} />
        ) : (
          <GraphView nb={nb} center={center} onSelect={setCenterId} controls={depthEl} />
        )}
      </div>
    </div>
  );
}
