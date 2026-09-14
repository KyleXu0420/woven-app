"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Search, ChevronDown, ChevronRight, Check, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocalGraph } from "./local-graph";
import { TimelineView } from "./timeline-view";
import { useSearch } from "./search";
import { EntityProfile } from "./entity-profile";
import { ViewTabs, SegToggle, DIVIDED_FLUSH } from "./controls";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { NodeMark } from "./entity-profile";
import { confidenceLevel } from "./confidence";
import { getNeighborhood, relationCount, verifyEdge, restoreEdge, listPending } from "@/lib/api";
import { bumpGraph } from "@/lib/store";
import { toasts } from "@/lib/notifications";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { EdgeType, GraphEdge, GraphNode, Neighborhood } from "@/lib/types";

// SubjectSwitcher — WHICH topic (or person) the explorer is centred on. It is the subject's own name, at
// the heading rung, with a chevron: the grammar the rail's workspace switcher uses (name + chevron, no
// box at rest, a wash on hover). It was a grey pill in the control row, the same material as the view
// switch beside it, so the page's subject read as a filter — three choices of three kinds in one grey.
// A name under the h1 with nothing around it answers "what am I looking at" before any control is read.
// Opens the searchable list, sorted by connection count so the busiest subjects lead.
function SubjectSwitcher({
  entities,
  currentId,
  onSelect,
  noun,
  nounPlural,
}: {
  entities: { id: string; name: string }[];
  currentId: string;
  onSelect: (id: string) => void;
  noun: string;
  nounPlural: string;
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
      {/* -ml-1.5 / px-1.5: the name's first glyph stays on the column edge; the hover wash hugs the
          text. Open = tint-2, one rung up from the hover, the rail's own rest→hover→open ladder. */}
      <PopoverTrigger
        data-subject-switcher=""
        aria-label={`Change ${noun}`}
        className="-ml-1.5 inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left text-xl font-medium text-foreground outline-none transition-colors hover:bg-tint-1 focus-visible:ring-3 focus-visible:ring-focus data-[popup-open]:bg-tint-2"
      >
        <span className="truncate">{current?.name ?? `Pick a ${noun}`}</span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      {/* anchored to the name it changes; the search is a bare line under a hairline, not a bordered
          field inside a bordered popover (a box in a box) */}
      <PopoverContent align="start" sideOffset={4} className="w-72 p-0">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Search className="size-3.5 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={`Search ${nounPlural}`}
            aria-label={`Search ${nounPlural}`}
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>
        <div className="scrollbar-subtle flex max-h-72 flex-col overflow-y-auto p-1">
          {shown.length ? (
            shown.map((e) => {
              const sel = e.id === currentId;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => pick(e.id)}
                  aria-current={sel ? "true" : undefined}
                  // the current row is said by a leading tick and the name's weight, never by a wash:
                  // a washed row plus a trailing tick crowded the count, and a wash is what hover does.
                  // The count is inventory — how many links — muted and tabular, on the row's edge.
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-tint-1"
                >
                  <span className="flex w-3.5 shrink-0 items-center justify-center">
                    {sel ? <Check className="size-3.5" /> : null}
                  </span>
                  <span className={cn("min-w-0 flex-1 truncate", sel && "font-medium")}>{e.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {relationCount(e.id)}
                  </span>
                </button>
              );
            })
          ) : (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matches.</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// [out-verb, in-verb] per edge type — read from the ROW's point of view: the row is the subject of the
// sentence, the other end its object. "Notification strategy v3 — mentions Activation."
const VERB: Record<EdgeType, [string, string]> = {
  links_to: ["links to", "linked from"],
  sourced_from: ["sourced from", "source for"],
  mentions: ["mentions", "mentioned by"],
  in_collection: ["in", "contains"],
  authored_by: ["by", "authored"],
  decided: ["decided", "decided in"],
  supersedes: ["supersedes", "superseded by"],
};

// the relation as a complete sentence from the row's side. It was the verb alone under the title —
// "mentioned by", and then nothing — a sentence with no object, because the object was the subject
// the reader had just picked and the row assumed they would supply it.
function relationOf(rowId: string, e: GraphEdge, labelOf: (id: string) => string): string {
  return e.from === rowId ? `${VERB[e.type][0]} ${labelOf(e.to)}` : `${VERB[e.type][1]} ${labelOf(e.from)}`;
}

// one neighbour, one line: the kind-mark, the name, the sentence, and the provenance only when it is
// not the settled kind. A row is the same width as the tabs above it (flush), hover on the ground.
function RelationRow({
  node,
  edge,
  labelOf,
  onSelect,
}: {
  node: GraphNode;
  edge: GraphEdge;
  labelOf: (id: string) => string;
  onSelect: (id: string) => void;
}) {
  const proposed = edge.prov === "ai_generated";
  const level = proposed && edge.confidence != null ? confidenceLevel(edge.confidence) : "high";
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-tint-1 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus outline-none"
    >
      {/* the graph's mark at the row rung — shape says kind, hue says identity; a 28px square said neither,
          it read as a colour chip with no key */}
      <NodeMark node={{ id: node.id, kind: node.kind }} className="size-3.5" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-base font-medium">{node.label}</div>
        <div className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground">
          <span className="truncate">{relationOf(node.id, edge, labelOf)}</span>
          {proposed ? (
            <>
              <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
              <span className="shrink-0">proposed</span>
            </>
          ) : null}
          {/* the confidence word only where it earns ink (settled 2026-09-12): high is silent, Likely
              muted, Unsure in full ink — a demand on the reader's attention */}
          {level === "likely" ? <span className="shrink-0">Likely</span> : null}
          {level === "unsure" ? <span className="shrink-0 font-medium text-foreground">Unsure</span> : null}
        </div>
      </div>
    </button>
  );
}

// ListView — the focus's neighbourhood AS A LIST. The direct ties first; the wider reach folds under an
// "Extended +N" row at the foot, the list's reading of the same depth setting the graph's switch sets —
// depth used to be a graph-only idea, though a list folds just as well. "The list is the truth; the graph
// is the show me" — same data, listed instead of drawn. Click a row to re-focus there.
function ListView({
  nb,
  wide,
  open,
  onToggle,
  onSelect,
}: {
  nb: Neighborhood; // the direct neighbourhood
  wide: Neighborhood; // the two-hop one, for the fold
  open: boolean; // the fold's state IS the depth setting
  onToggle: () => void;
  onSelect: (id: string) => void;
}) {
  const byId = new Map(wide.nodes.map((n) => [n.id, n]));
  const labelOf = (id: string) => byId.get(id)?.label ?? id;
  // one row per direct tie (a neighbour tied twice is listed twice — each tie is its own fact)
  const direct = nb.edges
    .filter((e) => e.from === nb.centerId || e.to === nb.centerId)
    .map((e) => ({ edge: e, node: byId.get(e.from === nb.centerId ? e.to : e.from) }))
    .filter((r): r is { edge: GraphEdge; node: GraphNode } => !!r.node);
  // the second hop: each node a step further, with the tie that reaches it from the first ring
  const extended = wide.nodes
    .filter((n) => n.depth === 2)
    .map((n) => ({
      node: n,
      edge: wide.edges.find(
        (e) => (e.from === n.id || e.to === n.id) && byId.get(e.from === n.id ? e.to : e.from)?.depth === 1,
      ),
    }))
    .filter((r): r is { edge: GraphEdge; node: GraphNode } => !!r.edge);

  if (!direct.length) {
    return <p className="py-12 text-center text-sm text-muted-foreground">No relations yet.</p>;
  }
  return (
    <div className={`${DIVIDED_FLUSH} border-b border-border`}>
      {direct.map((r) => (
        <RelationRow key={r.edge.id} node={r.node} edge={r.edge} labelOf={labelOf} onSelect={onSelect} />
      ))}
      {extended.length ? (
        <>
          {/* the fold: "+N" standing in for rows not drawn, in the fold's own material (tint-1, muted, no
              ring). Open, the rows follow beneath it and the chevron turns; the count stays, it is how many. */}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-center gap-3 py-2.5 text-left text-sm text-muted-foreground transition-colors hover:bg-tint-1 hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus outline-none"
          >
            <span className="flex size-3.5 shrink-0 items-center justify-center">
              <ChevronRight className={cn("size-3.5 transition-transform", open && "rotate-90")} />
            </span>
            <span>Extended</span>
            <span className="rounded-sm bg-tint-1 px-1.5 text-xs font-medium tabular-nums text-muted-foreground">
              +{extended.length}
            </span>
          </button>
          {open
            ? extended.map((r) => (
                <RelationRow key={r.node.id} node={r.node} edge={r.edge} labelOf={labelOf} onSelect={onSelect} />
              ))
            : null}
        </>
      ) : null}
    </div>
  );
}

// GraphView — the relationship view: the field straight on the page ground (no card, no border, no
// legend), the depth switch hugging its top-right corner. It was a bordered, rounded card with an orphan
// ⓘ in one corner: a container drawn around a drawing that already has an edge of its own — where the
// nodes stop — and a key for a vocabulary the marks carry themselves (hex = topic, square = artifact,
// dashed = proposed; the name of anything is a hover away).
function GraphView({
  nb,
  centerId,
  previewIds,
  onSelect,
  onVerifyEdge,
  controls,
}: {
  nb: Neighborhood;
  centerId: string;
  previewIds?: string[];
  onSelect: (id: string) => void;
  onVerifyEdge?: (edgeId: string, action: "confirm" | "discard") => void;
  controls?: React.ReactNode;
}) {
  return (
    // the names' knockout paints in the ground colour; this field is the page, not a card
    <div className="relative" style={{ "--graph-ground": "var(--background)" } as React.CSSProperties}>
      {/* controls — depth, in the field's own top-right corner: a setting of THIS view, so it lives inside it */}
      {controls ? <div className="absolute top-0 right-0 z-10 flex items-center gap-2">{controls}</div> : null}
      <div className="pt-2 pb-2">
        {/* click a node → peek it in a popover anchored AT the node (no card docked below the canvas, which
            would just re-list the graph); re-centering the explorer is the peek's deliberate "Focus here"
            action, and a proposed (dashed) edge is confirmable in place via onVerifyEdge.
            radial: the rings hold still when the reach widens, so the hover preview adds nodes without
            moving the ones already there. fullLabels + outerRing="full": a subject with a handful of
            neighbours writes every name out, and a ring the reader asked for is drawn in full ink. */}
        <LocalGraph
          data={nb}
          layout="radial"
          fullLabels
          outerRing="full"
          previewIds={previewIds}
          className="max-w-[560px]"
          onSelect={() => {}}
          onVerifyEdge={onVerifyEdge}
          renderPopover={(id, api) => {
            const n = nb.nodes.find((x) => x.id === id);
            if (!n) return null;
            return (
              <EntityProfile
                node={n}
                placement="popover"
                onSelect={(relId) => {
                  onSelect(relId);
                  api.close();
                }}
                primaryAction={
                  id === centerId
                    ? undefined
                    : { label: "Focus here", onClick: () => { onSelect(id); api.close(); }, icon: Crosshair }
                }
              />
            );
          }}
        />
      </div>
    </div>
  );
}

// Explorer — the shell. Three choices of three kinds, each in its own material so the reader can tell
// at a glance which changes WHAT they look at, which changes HOW it is shown, and which is a setting:
//   the subject  — its name under the h1, a switcher (name + chevron; the rail's workspace grammar)
//   the view     — ViewTabs, the page-level control (underline, forest)
//   the depth    — a SegToggle inside the graph it governs; a fold at the foot of the list
// (See woven/product/explorer-framework.md.)
export function Explorer({
  entities,
  entityNoun = "entity",
  entityNounPlural = "entities",
}: {
  entities: { id: string; name: string }[];
  entityNoun?: string;
  entityNounPlural?: string;
}) {
  useGraphVersion(); // re-render after an in-graph verify/undo so the field reflects it
  // a ?focus=<id> deep-link (from ⌘K opening a person/topic while NOT already on this page) seeds the center;
  // without this the Explorer hard-centered on entities[0], landing on the wrong entity. Re-centers if it changes.
  const params = useSearchParams();
  const focusParam = params.get("focus");
  const [centerId, setCenterId] = React.useState(() =>
    focusParam && entities.some((e) => e.id === focusParam) ? focusParam : entities[0]?.id ?? "",
  );
  const [view, setView] = React.useState("graph");
  const [depth, setDepth] = React.useState("1");
  // the depth option the pointer rests on — "2" while hovering Extended ghosts the outer ring in
  const [peek, setPeek] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (focusParam && entities.some((e) => e.id === focusParam)) setCenterId(focusParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParam]);

  // register this explorer's re-center fn so the global search's "Find → Focus on this" lands here
  const { registerFocus } = useSearch();
  React.useEffect(() => {
    registerFocus(setCenterId);
    return () => registerFocus(null);
  }, [registerFocus]);

  // calm one-line empty state — no broken chrome (garbage center node) when a space has no topics/people yet
  if (!entities.length) {
    return (
      <div className="mt-6 rounded-lg bg-card py-16 text-center text-sm text-muted-foreground">
        No {entityNounPlural} yet — they emerge as Woven weaves your artifacts.
      </div>
    );
  }

  // both reaches, always: the counts on the depth switch say what each shows before it is chosen
  const nbDirect = getNeighborhood(centerId, 1);
  const nbWide = getNeighborhood(centerId, 2);
  const directCount = nbDirect.nodes.length - 1;
  const wideCount = nbWide.nodes.length - 1;
  const previewing = depth === "1" && peek === "2" && wideCount > directCount;
  const nb = depth === "2" || previewing ? nbWide : nbDirect;
  // the ghost is everything the wider reach ADDS: its ring, and any tie the direct view does not draw
  // (a tie between two direct neighbours is only picked up on the second hop)
  const previewIds = previewing
    ? [
        ...nbWide.nodes.filter((n) => n.depth === 2).map((n) => n.id),
        ...nbWide.edges.filter((e) => !nbDirect.edges.some((d) => d.id === e.id)).map((e) => e.id),
      ]
    : undefined;
  const center = nb.nodes.find((n) => n.depth === 0);

  // a proposed (dashed) edge is confirmable IN the graph — verifyEdge + a toast with Undo, then re-render
  function resolve(edgeId: string, action: "confirm" | "discard") {
    const p = listPending().find((x) => x.edge_id === edgeId);
    const label = p ? `${p.fromLabel} → ${p.toLabel}` : "link";
    const prev = verifyEdge(edgeId, action);
    bumpGraph();
    const undo = prev ? { label: "Undo", onClick: () => { restoreEdge(prev); bumpGraph(); } } : undefined;
    if (action === "confirm") toasts.linkConfirmed(label, undo);
    else toasts.proposalDismissed(label, undo);
  }

  // the depth switch rides in the graph's own top-right corner. Each option carries its count — how far
  // the reach goes, in the reader's own numbers ("Extended" alone said nothing about what it cost) — in
  // the segment's ink, the tab-strip grammar. Extended says what it ADDS ("+24"), the same figure the
  // list's fold wears, not a second total to subtract. Hovering an option previews it (see GraphView).
  const depthEl = (
    <SegToggle
      ariaLabel="Reach"
      options={[
        { id: "1", label: "Direct", count: directCount },
        { id: "2", label: "Extended", count: `+${wideCount - directCount}` },
      ]}
      value={depth}
      onChange={setDepth}
      onHover={setPeek}
    />
  );
  return (
    <div>
      {/* the subject, under the h1 and before any control: the second-largest text on the page names
          the thing being explored, the h1 names the kind */}
      <div className="mt-2">
        <SubjectSwitcher entities={entities} currentId={centerId} onSelect={setCenterId} noun={entityNoun} nounPlural={entityNounPlural} />
      </div>

      {/* the view — the one page-level switch: three lenses on the same subject */}
      <div className="mt-5">
        <ViewTabs
          ariaLabel="View"
          options={[
            { id: "list", label: "List" },
            { id: "graph", label: "Graph" },
            { id: "timeline", label: "Timeline" },
          ]}
          value={view}
          onChange={setView}
        />
      </div>

      <div className="mt-4" data-explorer-view={view}>
        {view === "timeline" ? (
          center ? (
            <TimelineView center={center} />
          ) : (
            <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
              Select an entity to explore.
            </div>
          )
        ) : view === "list" ? (
          <ListView
            nb={nbDirect}
            wide={nbWide}
            open={depth === "2"}
            onToggle={() => setDepth(depth === "2" ? "1" : "2")}
            onSelect={setCenterId}
          />
        ) : (
          <GraphView nb={nb} centerId={centerId} previewIds={previewIds} onSelect={setCenterId} onVerifyEdge={resolve} controls={depthEl} />
        )}
      </div>
    </div>
  );
}
