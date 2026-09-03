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
// The drawing is systematic, not free-hand: one node size, one stroke, one corner radius, and
// chords that would overlap take separate lanes, the way a subway map parts its lines. A longer
// span takes the outer lane so shorter ones nest inside it without crossing. At rest the rail is
// neutral ink — structure, not decoration; the collection's hue is spent only on the lit row.
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

type Span = { id: string; from: string; to: string; a: number; b: number };

// Greedy interval colouring. Spans are visited longest-first, each taking the first lane in which
// nothing it overlaps already sits; two spans that meet at a node count as overlapping, so the two
// stubs into that node never share a trunk. Lane 0 (the first taken, the longest) is drawn outermost.
function assignLanes(spans: Span[]): Map<string, number> {
  const lanes: Span[][] = [];
  const out = new Map<string, number>();
  for (const s of [...spans].sort((p, q) => q.b - q.a - (p.b - p.a))) {
    let k = lanes.findIndex((lane) => lane.every((o) => s.a > o.b || s.b < o.a));
    if (k < 0) {
      k = lanes.length;
      lanes.push([]);
    }
    lanes[k].push(s);
    out.set(s.id, k);
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
  const spans: Span[] = edges
    .filter((e) => anchors.has(e.from) && anchors.has(e.to))
    .map((e) => {
      const y1 = anchors.get(e.from)!;
      const y2 = anchors.get(e.to)!;
      return { ...e, a: Math.min(y1, y2), b: Math.max(y1, y2) };
    });
  const lane = assignLanes(spans);
  const laneCount = Math.max(0, ...lane.values()) + 1;
  const linked = new Set(spans.flatMap((s) => [s.from, s.to]));
  const touching = new Set<string>();
  if (lit) for (const s of spans) if (s.from === lit || s.to === lit) touching.add(s.id);
  const rest = "var(--muted-foreground)";

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={RAIL_W}
      height={height}
      viewBox={`0 0 ${RAIL_W} ${height}`}
    >
      {spans.map((s) => {
        // lane 0 is outermost; the innermost lane sits 10px off the node so the stub clears the bend
        const lx = NODE_X - 10 - LANE_GAP * (laneCount - 1 - lane.get(s.id)!);
        const on = lit ? touching.has(s.id) : true;
        const d =
          `M ${NODE_X} ${s.a} H ${lx + BEND} A ${BEND} ${BEND} 0 0 0 ${lx} ${s.a + BEND} ` +
          `V ${s.b - BEND} A ${BEND} ${BEND} 0 0 0 ${lx + BEND} ${s.b} H ${NODE_X}`;
        return (
          <path
            key={s.id}
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
        const r = isLit ? NODE_R * 1.35 : NODE_R;
        const ink = isLit ? color : rest;
        return (
          <rect
            key={id}
            x={NODE_X - r}
            y={y - r}
            width={2 * r}
            height={2 * r}
            rx={r * 0.42}
            // filled = cites or is cited within the collection; hollow = a member with no chords
            fill={isLinked ? ink : "var(--background)"}
            fillOpacity={lit && !isLit ? 0.3 : isLinked ? 0.8 : 1}
            stroke={isLinked ? "var(--background)" : ink}
            strokeOpacity={lit && !isLit ? 0.3 : 0.8}
            strokeWidth={1.5}
            style={{ transition: "all 160ms ease-out" }}
          />
        );
      })}
    </svg>
  );
}
