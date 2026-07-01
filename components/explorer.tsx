"use client";

import * as React from "react";
import { Shapes, CircleDot, X } from "lucide-react";
import { LocalGraph } from "./local-graph";
import { TimelineView } from "./timeline-view";
import { useSearch } from "./search";
import { EntityProfile } from "./entity-profile";
import { SegToggle } from "./controls";
import { FacetFilter, type FacetDef } from "./facet-filter";
import { NodeMark } from "./entity-profile";
import { getNeighborhood, nodeRelations } from "@/lib/api";
import type { EdgeType, GraphNode, Neighborhood } from "@/lib/types";

const LEGEND = [
  { c: "var(--primary)", l: "Focused" },
  { c: "var(--chart-1)", l: "Artifact · collection" },
  { c: "var(--chart-7)", l: "Person · topic · identity" },
];

// ── the cross-view filter (L2) ───────────────────────────────────────────────
type Facets = { kind: string; state: string };
const EMPTY_FACETS: Facets = { kind: "All", state: "All" };
const KINDS = ["All", "Artifact", "Person", "Topic", "Collection", "Decision"];
const STATES = ["All", "Confirmed", "Proposed"];
const FACET_DEFS: FacetDef[] = [
  { key: "kind", label: "Type", icon: Shapes, options: KINDS, defaultValue: "All" },
  { key: "state", label: "State", icon: CircleDot, options: STATES, defaultValue: "All" },
];

// apply the filter to a neighbourhood: keep focus + neighbours matching the kind facet, narrow edges
// by state (confirmed = solid links, proposed = agent-suggested), then drop neighbours the state
// filter leaves unconnected. The focus is always kept.
function filterNeighborhood(nb: Neighborhood, f: Facets): Neighborhood {
  const kindKeep = new Set<string>();
  for (const n of nb.nodes) {
    if (n.depth === 0 || f.kind === "All" || n.kind === f.kind.toLowerCase()) kindKeep.add(n.id);
  }
  let edges = nb.edges.filter((e) => kindKeep.has(e.from) && kindKeep.has(e.to));
  if (f.state === "Confirmed") edges = edges.filter((e) => e.prov !== "ai_generated");
  else if (f.state === "Proposed") edges = edges.filter((e) => e.prov === "ai_generated");
  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.from);
    connected.add(e.to);
  }
  const nodes = nb.nodes.filter(
    (n) => kindKeep.has(n.id) && (f.state === "All" || n.depth === 0 || connected.has(n.id)),
  );
  return { centerId: nb.centerId, nodes, edges };
}

// an applied facet — neutral, removable; sits above the view so filter ↔ view stay one piece
function AppliedPill({
  label,
  value,
  onRemove,
}: {
  label: string;
  value: string;
  onRemove: () => void;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary py-1 pr-1 pl-2.5 text-xs font-medium">
      <span className="text-muted-foreground">{label}</span>
      <span>{value}</span>
      <button
        onClick={onRemove}
        aria-label={`Remove ${label} filter`}
        className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/10 hover:text-foreground"
      >
        <X className="size-3" />
      </button>
    </span>
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
function ListView({
  centerId,
  facets,
  onSelect,
}: {
  centerId: string;
  facets: Facets;
  onSelect: (id: string) => void;
}) {
  const rels = nodeRelations(centerId).filter((r) => {
    if (facets.kind !== "All" && r.kind !== facets.kind.toLowerCase()) return false;
    if (facets.state === "Confirmed" && r.prov === "ai_generated") return false;
    if (facets.state === "Proposed" && r.prov !== "ai_generated") return false;
    return true;
  });
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
          No relations match these filters.
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
        {/* legend — quiet, in the canvas corner */}
        <div className="pointer-events-none absolute top-3 left-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground sm:left-6">
          {LEGEND.map((x) => (
            <span key={x.l} className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-full" style={{ background: x.c }} />
              {x.l}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0 w-4 border-t border-dashed border-primary" /> proposed
          </span>
        </div>
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
  const [facets, setFacets] = React.useState<Facets>(EMPTY_FACETS);

  // register this explorer's re-center fn so the global search's "Find → Focus on this" lands here
  const { registerFocus } = useSearch();
  React.useEffect(() => {
    registerFocus(setCenterId);
    return () => registerFocus(null);
  }, [registerFocus]);

  const nb = getNeighborhood(centerId, Number(depth));
  const center = nb.nodes.find((n) => n.depth === 0);
  const filtered = filterNeighborhood(nb, facets);

  const applied: { k: "kind" | "state"; label: string; value: string }[] = [];
  if (facets.kind !== "All") applied.push({ k: "kind", label: "Type", value: facets.kind });
  if (facets.state !== "All") applied.push({ k: "state", label: "State", value: facets.state });

  // depth + filter travel with the graph — floated into its top-right corner (see GraphView).
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
  const filterEl = (
    <FacetFilter
      defs={FACET_DEFS}
      values={facets}
      onChange={(k, v) => setFacets((f) => ({ ...f, [k as keyof Facets]: v }))}
      onClear={() => setFacets(EMPTY_FACETS)}
    />
  );

  return (
    <div>
      {/* control row — view (which way to look) on the left, filter (what to show) on the right.
          Focus/search lives in the global ⌘K · / search; its Find mode re-centers this explorer. */}
      <div className="mt-6 flex items-center justify-between gap-3">
        <SegToggle
          options={[
            { id: "list", label: "List" },
            { id: "graph", label: "Graph" },
            { id: "timeline", label: "Timeline" },
          ]}
          value={view}
          onChange={setView}
        />
        {/* only the depth toggle moved into the graph canvas corner; the Filter stays here */}
        {view !== "timeline" ? filterEl : null}
      </div>

      {/* applied facets — glued above the view (the filter ↔ view link) */}
      {view !== "timeline" && applied.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {applied.map((f) => (
            <AppliedPill
              key={f.k}
              label={f.label}
              value={f.value}
              onRemove={() => setFacets((s) => ({ ...s, [f.k]: "All" }))}
            />
          ))}
          <button
            onClick={() => setFacets(EMPTY_FACETS)}
            className="text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear
          </button>
        </div>
      ) : null}

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
          <ListView centerId={centerId} facets={facets} onSelect={setCenterId} />
        ) : (
          <GraphView
            nb={filtered}
            center={center}
            onSelect={setCenterId}
            controls={depthEl}
          />
        )}
      </div>
    </div>
  );
}
