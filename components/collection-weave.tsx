"use client";

import * as React from "react";

// CollectionWeave — the collection's structure drawn INSIDE its list, as the list's first column.
//
// Sixteen blind verdicts read a hero-sized map of the members as decoration, because a still image
// cannot show that hovering a row lights its node. So the map lives where the rows are: every member
// has a node on its own title line, and every real citation between two members is a chord routed
// through the rail between their rows. The rows are the nodes, the rail is the graph, and the
// relationship is visible without a hover — the hover only lights it.
//
// The drawing is systematic, not free-hand. Citations are grouped by hub: the artifact that three
// others cite gets ONE trunk beside the rows it spans, with a tick into each of them — a file-tree
// stroke, not a chord per citation. A star of three links is one line with three ticks; a chord
// each was a subway map. Trunks whose spans overlap take separate lanes, the longer span outermost
// so shorter ones nest inside without crossing. One node size, one stroke, one corner radius. At
// rest the rail is neutral ink — structure, not decoration; the collection's hue is spent only on
// the lit row.
//
// The rows' y-positions are measured, not assumed: a row with a gist is taller than one without,
// and the list reorders by drag. `useRowAnchors` reads `[data-anchor]` inside `[data-member]`
// children of the list and re-measures on resize.

export type WeaveEdge = { id: string; from: string; to: string };

// The rail's width. The list pads its rows by this much (pl-12 = 48 = rail + 8) so the rail is a
// column of the table, inside its dividers, not a note in the margin.
export const RAIL_W = 40;
const NODE_X = 34; // node centre; 14px short of the title's left edge
const NODE_R = 4;
const LANE_GAP = 6;
const BEND = 5; // one corner radius, everywhere

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
// document citing three others draw the same way: one trunk, three ticks.
type Trunk = { hub: string; members: Set<string>; ys: number[]; a: number; b: number };

function buildTrunks(edges: WeaveEdge[], anchors: Map<string, number>): Trunk[] {
  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  const byHub = new Map<string, Set<string>>();
  for (const e of edges) {
    const hub = (degree.get(e.from) ?? 0) >= (degree.get(e.to) ?? 0) ? e.from : e.to;
    const other = hub === e.from ? e.to : e.from;
    (byHub.get(hub) ?? byHub.set(hub, new Set()).get(hub)!).add(other);
  }
  return [...byHub.entries()].map(([hub, members]) => {
    const ys = [hub, ...members].map((id) => anchors.get(id)!);
    return { hub, members, ys, a: Math.min(...ys), b: Math.max(...ys) };
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
  const laneCount = Math.max(0, ...lane.values()) + 1;
  const linked = new Set(trunks.flatMap((t) => [t.hub, ...t.members]));
  const rest = "var(--muted-foreground)";

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={RAIL_W}
      height={height}
      viewBox={`0 0 ${RAIL_W} ${height}`}
    >
      {trunks.map((t) => {
        // lane 0 is outermost; the innermost lane sits 10px off the node so the stub clears the bend
        const lx = NODE_X - 10 - LANE_GAP * (laneCount - 1 - lane.get(t.hub)!);
        const on = lit ? t.hub === lit || t.members.has(lit) : true;
        // the trunk turns into the top and bottom rows; every row between gets a straight tick
        const d =
          `M ${NODE_X} ${t.a} H ${lx + BEND} A ${BEND} ${BEND} 0 0 0 ${lx} ${t.a + BEND} ` +
          `V ${t.b - BEND} A ${BEND} ${BEND} 0 0 0 ${lx + BEND} ${t.b} H ${NODE_X}` +
          t.ys
            .filter((y) => y !== t.a && y !== t.b)
            .map((y) => ` M ${lx} ${y} H ${NODE_X}`)
            .join("");
        return (
          <path
            key={t.hub}
            d={d}
            fill="none"
            stroke={on && lit ? color : rest}
            strokeOpacity={on ? (lit ? 1 : 0.55) : 0.15}
            strokeWidth={1.5}
            style={{ transition: "stroke-opacity 160ms ease-out, stroke 160ms ease-out" }}
          />
        );
      })}
      {[...anchors.entries()].map(([id, y]) => {
        const isLit = lit === id;
        const isLinked = linked.has(id);
        const outer = isLit ? NODE_R * 1.35 : NODE_R;
        // a hollow mark is drawn inset by half its stroke, so filled and hollow share one outer
        // size — they were 7px and 9px, and read as two glyphs
        const r = isLinked ? outer : outer - 0.75;
        const ink = isLit ? color : rest;
        return (
          <rect
            key={id}
            x={NODE_X - r}
            y={y - r}
            width={2 * r}
            height={2 * r}
            rx={r * 0.42}
            // filled = tied to another member of this collection; hollow = a member with no ties
            fill={isLinked ? ink : "var(--background)"}
            fillOpacity={lit && !isLit ? 0.3 : 0.8}
            stroke={isLinked ? "none" : ink}
            strokeOpacity={lit && !isLit ? 0.3 : 0.8}
            strokeWidth={1.5}
            style={{ transition: "all 160ms ease-out" }}
          />
        );
      })}
    </svg>
  );
}
