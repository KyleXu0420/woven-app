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
        // 14px, not 10: the tick is the segment that carries the dash when a tie is only proposed, and a
        // 3-3 pattern needs more than one and a half periods to read as dashed rather than as short.
        const lx = NODE_X - 14 - LANE_GAP * (laneCount - 1 - lane.get(t.hub)!);
        const on = lit ? t.hub === lit || t.members.has(lit) : true;
        // The spine is scaffolding and is always solid; each row's horizontal is the tie itself, so
        // that is the segment that dashes when the tie is only proposed. Drawn as separate paths for
        // exactly that reason — one path could not say two things.
        const spine =
          `M ${lx + BEND} ${t.a} A ${BEND} ${BEND} 0 0 0 ${lx} ${t.a + BEND} ` +
          `V ${t.b - BEND} A ${BEND} ${BEND} 0 0 0 ${lx + BEND} ${t.b}`;
        const stroke = on && lit ? color : rest;
        const opacity = on ? (lit ? 1 : 0.7) : 0.15;
        const ease = { transition: "stroke-opacity 160ms ease-out, stroke 160ms ease-out" } as const;
        return (
          <g key={t.hub}>
            <path d={spine} fill="none" stroke={stroke} strokeOpacity={opacity} strokeWidth={1.5} style={ease} />
            {t.ys.map((y) => (
              <path
                key={y}
                d={`M ${lx} ${y} H ${NODE_X}`}
                fill="none"
                stroke={stroke}
                strokeOpacity={opacity}
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray={t.proposed.has(y) ? "3 3" : undefined}
                style={ease}
              />
            ))}
          </g>
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
