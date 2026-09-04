"use client";

import * as React from "react";

// CollectionWeave — the collection's structure drawn INSIDE its list, as the list's first column.
//
// The lineage is the outline glyph: tree(1)'s ├── stroke, an editor's indent guide, a rowspan bracket.
// Orthogonal, one weight, one curl radius, inside a column. Every member has a node on its own title
// line; the ties among members are drawn as a bracket beside the rows they span, with a horizontal
// tick into each row.
//
// AT REST THE RAIL IS A BRACKET, ON HOVER IT IS A STAR. The bracket's honest claim is "these rows are
// tied through one of them": the hub is whichever end of the ties has the higher degree, and the data
// carries no direction, so a tree with a parent would draw a relation that does not exist. The hover
// makes the second claim — "this row is tied to that one" — and lights ONLY the ticks that are real
// ties of the hovered row. It used to light the whole bracket, which said press was tied to OKRs
// when the only thing they share is being cited by the same document.
//
// Four axes, one job each: shape = kind (a rounded square is an artifact), size = depth, hue = identity
// (the collection's, spent only on the lit row and its ties), line = provenance (a tie a person has
// not confirmed is dashed, and forest — the agent's hand — as everywhere else in the app).
//
// An untied row has no mark at rest. A hollow square in a table with a header row is the unchecked-
// checkbox glyph; two untied rows read as two unselected ones. The node appears in hue on hover, so
// the row still answers.
//
// Lanes cap at three. A bracket that would need a fourth lane sits at x=2 and clips; it is held at
// rest (its rows stay filled — they are tied) and drawn in the innermost lane when one of its rows is
// hovered, on top of everything that has receded. At rest, up to three lanes; on hover, the truth.
//
// The rows' y-positions are measured, not assumed: a row with a gist is taller than one without,
// and the list reorders by drag. `useRowAnchors` reads `[data-anchor]` inside `[data-member]`
// children of the list and re-measures on resize.

export type WeaveEdge = {
  id: string;
  from: string;
  to: string;
  // whether a human has confirmed this tie. The rail drew every tie solid, so an agent's proposal and
  // a confirmed citation were the same mark — on a product whose whole claim is that nothing enters
  // the graph as fact until someone says so. The Map tab already dashes them; the list did not.
  prov: string;
};

// The rail's width. The list pads its rows by this much (pl-12 = 48 = rail + 8) so the rail is a
// column of the table, inside its dividers, not a note in the margin.
export const RAIL_W = 40;
const NODE_X = 34; // node centre; 14px short of the title's left edge
const NODE_R = 4;
const LANE_GAP = 6;
const BEND = 5; // one corner radius, everywhere
const MAX_LANES = 3;

export function useRowAnchors(ref: React.RefObject<HTMLElement | null>, deps: React.DependencyList) {
  const [state, setState] = React.useState<{ height: number; anchors: Map<string, number> }>({
    height: 0,
    anchors: new Map(),
  });
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      const top = el.getBoundingClientRect().top;
      const anchors = new Map<string, number>();
      el.querySelectorAll<HTMLElement>("[data-member]").forEach((row) => {
        const line = row.querySelector<HTMLElement>("[data-anchor]") ?? row;
        const r = line.getBoundingClientRect();
        anchors.set(row.dataset.member!, r.top + r.height / 2 - top);
      });
      setState({ height: el.getBoundingClientRect().height, anchors });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return state;
}

// A hub and the rows it is tied to. `hub` is whichever end of each citation has the higher degree —
// direction is not what the rail shows, structure is — so a document cited by three others and a
// document citing three others draw the same way: one bracket, a tick per row.
type Trunk = { hub: string; members: Set<string>; ys: number[]; a: number; b: number; proposed: Set<number> };

function buildTrunks(edges: WeaveEdge[], anchors: Map<string, number>): Trunk[] {
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  const byHub = new Map<string, Set<string>>();
  // a tie is proposed until a human confirms it; remembered by the row it lands on, because that is
  // the segment of the drawing that carries it
  const proposedAt = new Map<string, Set<string>>();
  for (const e of edges) {
    const hub = (degree.get(e.from) ?? 0) >= (degree.get(e.to) ?? 0) ? e.from : e.to;
    const other = hub === e.from ? e.to : e.from;
    (byHub.get(hub) ?? byHub.set(hub, new Set()).get(hub)!).add(other);
    if (e.prov === "ai_generated") {
      (proposedAt.get(hub) ?? proposedAt.set(hub, new Set()).get(hub)!).add(other);
    }
  }
  return [...byHub.entries()].map(([hub, members]) => {
    const ys = [hub, ...members].map((id) => anchors.get(id)!);
    const proposed = new Set(
      [...(proposedAt.get(hub) ?? [])].map((id) => anchors.get(id)!).filter((y) => y != null),
    );
    return { hub, members, ys,
      proposed, a: Math.min(...ys), b: Math.max(...ys) };
  });
}

// Greedy interval colouring. Trunks are visited longest-first, each taking the first lane in which
// nothing it overlaps already sits; two that meet at a row count as overlapping, so two ticks into
// one node never share a lane. Lane 0 (the first taken, the longest) is drawn outermost.
function assignLanes(trunks: Trunk[]): Map<string, number> {
  const lanes: Trunk[][] = [];
  const out = new Map<string, number>();
  for (const t of [...trunks].sort((p, q) => q.b - q.a - (p.b - p.a))) {
    let k = lanes.findIndex((lane) => lane.every((o) => t.a > o.b || t.b < o.a));
    if (k < 0) {
      k = lanes.length;
      lanes.push([]);
    }
    lanes[k].push(t);
    out.set(t.hub, k);
  }
  return out;
}

export function CollectionWeave({
  anchors,
  height,
  edges,
  color,
  lit,
  className,
}: {
  anchors: Map<string, number>;
  height: number;
  // member ↔ member only; the caller filters. Spokes from the collection are not drawn — the list IS
  // the spoke.
  edges: WeaveEdge[];
  // the collection's hue: spent on the lit row's node and chords, nowhere else
  color: string;
  lit?: string | null;
  className?: string;
}) {
  if (!height || anchors.size === 0) return null;
  const trunks = buildTrunks(
    edges.filter((e) => anchors.has(e.from) && anchors.has(e.to)),
    anchors,
  );
  const lane = assignLanes(trunks);
  const linked = new Set(trunks.flatMap((t) => [t.hub, ...t.members]));
  const rest = "var(--muted-foreground)";
  const proposedInk = "var(--primary)";

  // the star: which rows the lit row is actually tied to
  const inTrunk = (t: Trunk) => lit != null && (t.hub === lit || t.members.has(lit));
  const adjacent = new Set<string>();
  if (lit) for (const t of trunks) {
    if (t.hub === lit) t.members.forEach((m) => adjacent.add(m));
    else if (t.members.has(lit)) adjacent.add(t.hub);
  }
  const shown = trunks.filter((t) => lane.get(t.hub)! < MAX_LANES || inTrunk(t));
  const laneCount = Math.min(MAX_LANES, Math.max(0, ...lane.values()) + 1);
  const ease = { transition: "stroke-opacity 160ms ease-out, stroke 160ms ease-out" } as const;

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={RAIL_W}
      height={height}
      viewBox={`0 0 ${RAIL_W} ${height}`}
    >
      {shown.map((t) => {
        // lane 0 is outermost. 14px of tick: a 3-3 dash needs more than a period and a half to read
        // as dashed rather than as short, which is what 10 gave.
        const k = Math.min(lane.get(t.hub)!, MAX_LANES - 1);
        const lx = NODE_X - 14 - LANE_GAP * (laneCount - 1 - k);
        const hubY = anchors.get(t.hub)!;
        const litY = lit ? anchors.get(lit) : undefined;
        // a tick is on when it is a real tie of the lit row: the lit row's own tick, every tick when
        // the hub is lit, and the hub's tick when a member is lit. Nothing else.
        const tickOn = (y: number) =>
          !lit || y === litY || lit === t.hub || (y === hubY && t.members.has(lit));
        const anyOn = t.ys.some(tickOn);
        const spine =
          `M ${lx + BEND} ${t.a} A ${BEND} ${BEND} 0 0 0 ${lx} ${t.a + BEND} ` +
          `V ${t.b - BEND} A ${BEND} ${BEND} 0 0 0 ${lx + BEND} ${t.b}`;
        return (
          <g key={t.hub}>
            <path
              d={spine}
              fill="none"
              stroke={lit && anyOn ? color : rest}
              strokeOpacity={anyOn ? (lit ? 1 : 0.7) : 0.15}
              strokeWidth={1.5}
              style={ease}
            />
            {t.ys.map((y) => {
              const on = tickOn(y);
              const proposed = t.proposed.has(y);
              return (
                <path
                  key={y}
                  d={`M ${lx} ${y} H ${NODE_X}`}
                  fill="none"
                  // a proposed tie is forest and dashed at rest AND lit — provenance is not a hover state
                  stroke={proposed ? proposedInk : lit && on ? color : rest}
                  strokeOpacity={on ? (lit ? 1 : 0.7) : 0.15}
                  strokeWidth={1.5}
                  strokeLinecap="round"
                  strokeDasharray={proposed ? "3 3" : undefined}
                  style={ease}
                />
              );
            })}
          </g>
        );
      })}
      {[...anchors.entries()].map(([id, y]) => {
        const isLit = lit === id;
        const isLinked = linked.has(id);
        if (!isLinked && !isLit) return null; // untied: no mark at rest
        const r = isLit ? NODE_R * 1.35 : NODE_R;
        const near = adjacent.has(id);
        return (
          <rect
            key={id}
            x={NODE_X - r}
            y={y - r}
            width={2 * r}
            height={2 * r}
            rx={r * 0.5}
            fill={isLit || near ? color : rest}
            fillOpacity={isLit ? 1 : near ? 0.8 : lit ? 0.3 : 0.8}
            style={{ transition: "all 160ms ease-out" }}
          />
        );
      })}
    </svg>
  );
}
