"use client";

import * as React from "react";

// CollectionWeave — the collection's structure drawn INSIDE its list, not as a picture above it.
//
// Sixteen blind verdicts read a hero-sized map of the members as decoration, because a still image
// cannot show that hovering a row lights its node. So the map moves to where the rows are: each
// member gets a node in the left gutter, on its own title line, and every real citation between
// two members is a chord bowed out into the margin between their rows. The rows are the nodes, the
// gutter is the graph, and the relationship is visible without a hover — the hover only lights it.
//
// The rows' y-positions are measured, not assumed: a row with a gist is taller than one without,
// and the list reorders by drag. `useRowAnchors` reads `[data-anchor]` inside `[data-member]`
// children of the list and re-measures on resize.

export type WeaveEdge = { id: string; from: string; to: string };

const NODE_X = 30; // node centre, px from the svg's left edge; the svg's right edge meets the grip slot
const WIDTH = 40;

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
  color: string;
  // hovered member id: its node and chords take full ink, everything else recedes
  lit?: string | null;
  className?: string;
}) {
  if (!height || anchors.size === 0) return null;
  const chords = edges.filter((e) => anchors.has(e.from) && anchors.has(e.to));
  // a node marks the end of a chord. A row with no chords gets none: inside its own collection,
  // "this belongs here" is what every row already says, and a square there was a bullet.
  const linked = new Set(chords.flatMap((e) => [e.from, e.to]));
  const touching = new Set<string>();
  if (lit) for (const e of chords) if (e.from === lit || e.to === lit) touching.add(e.id);
  return (
    <svg
      aria-hidden="true"
      className={className}
      width={WIDTH}
      height={height}
      viewBox={`0 0 ${WIDTH} ${height}`}
      style={{ overflow: "visible" }}
    >
      {chords.map((e) => {
        const y1 = anchors.get(e.from)!;
        const y2 = anchors.get(e.to)!;
        // a longer span bows further out, so two chords that share a row part instead of stacking
        const bow = Math.min(26, 10 + Math.abs(y2 - y1) / 10);
        const on = lit ? touching.has(e.id) : true;
        return (
          <path
            key={e.id}
            d={`M ${NODE_X} ${y1} C ${NODE_X - bow} ${y1}, ${NODE_X - bow} ${y2}, ${NODE_X} ${y2}`}
            fill="none"
            stroke={color}
            strokeOpacity={on ? (lit ? 1 : 0.7) : 0.12}
            strokeWidth={1.5}
            style={{ transition: "stroke-opacity 160ms ease-out" }}
          />
        );
      })}
      {[...anchors.entries()].filter(([id]) => linked.has(id)).map(([id, y]) => {
        const isLit = lit === id;
        const r = isLit ? 5.5 : 4;
        return (
          <rect
            key={id}
            x={NODE_X - r}
            y={y - r}
            width={2 * r}
            height={2 * r}
            rx={r * 0.42}
            fill={color}
            fillOpacity={lit && !isLit ? 0.3 : 1}
            stroke="var(--background)"
            strokeWidth={1.5}
            style={{ transition: "all 160ms ease-out" }}
          />
        );
      })}
    </svg>
  );
}
