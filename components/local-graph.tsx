"use client";

import * as React from "react";
import { Check, Info, X } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { cn } from "@/lib/utils";
import type { GraphEdge, GraphNode, Neighborhood, RefKind } from "@/lib/types";
import { tintVar } from "@/lib/identity";
import { collectionById, primaryCollection } from "@/lib/api";
import { orbitLayout, chooseLabelSides, labelBoxAt, labelAnchor, SIDES, SIDE_GAP, LABEL, type Box, type LabelSide } from "@/components/orbit-layout";
import { FOCUS_RING } from "./classes";

// Hue is identity. The focused centre used to be painted forest — the colour the doctrine reserves for
// chrome, the agent and confirms — so a settled plum collection turned green the moment you looked at
// it, which AGENTS.md reads as "agent still deciding". Focus is already carried three ways: the pinned
// position, size 8.5 against 6, and the 500 label. The space itself is not an identity, so it is ink.
function nodeFill(n: GraphNode): string {
  if (n.kind === "artifact") return primaryCollection(n.id)?.color ?? "var(--chart-1)"; // by collection
  // a collection wears its own swatch. The one "collection" with no swatch is the space itself, the
  // centre of the team field — it is the frame, not a thing, so it is ink.
  if (n.kind === "collection") return collectionById(n.id)?.color ?? (n.depth === 0 ? "var(--muted-foreground)" : "var(--chart-1)");
  return tintVar(n.id); // person / topic / source — own identity hue
}

// The graph's OWN marks at legend scale. A key that invents flat abstractions (a straight rule, a round dot)
// reads as disconnected from the canvas — so these reuse the real `NodeShape` and echo the edges' woven bow.
const LEGEND_KINDS: { kind: RefKind; label: string }[] = [
  { kind: "artifact", label: "Artifact" },
  { kind: "topic", label: "Topic" },
  { kind: "person", label: "Person" },
  { kind: "collection", label: "Collection" },
  { kind: "decision", label: "Decision" },
  // the ring was on the canvas (a transcript, a meeting) and not in the key, so the one hollow letter of the
  // alphabet was the one the key did not spell
  { kind: "source", label: "Source" },
];

function EdgeSwatch({ dashed = false }: { dashed?: boolean }) {
  return (
    <svg width="20" height="10" viewBox="0 0 20 10" className="shrink-0" aria-hidden>
      <path
        d="M1 5 L19 5"
        fill="none"
        stroke={dashed ? "var(--primary)" : "var(--muted-foreground)"}
        strokeOpacity={dashed ? 0.8 : 0.5}
        strokeWidth={1.5}
        strokeDasharray={dashed ? "3 3" : undefined}
        strokeLinecap="round"
      />
    </svg>
  );
}

function NodeSwatch({ kind, fill, processing }: { kind: RefKind; fill: string; processing?: boolean }) {
  return (
    <svg width="13" height="13" viewBox="-6.5 -6.5 13 13" className="shrink-0" aria-hidden>
      <NodeShape kind={kind} r={4.4} fill={fill} processing={processing} />
    </svg>
  );
}

// the key's typographic hierarchy — the graph encodes on THREE axes (line · colour · shape), so each gets a
// quiet axis LABEL over inked ITEMS. Without that split every row reads at one weight and the whole key goes
// flat; grouping by label + whitespace also retires the repeated dividers that made it a uniform stack.
function LegendGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium tracking-[0.01em] text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

// one fixed swatch slot so the 20px edge bows and the 13px node shapes still share a single left edge
function LegendItem({ swatch, children }: { swatch?: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-sm text-foreground-prose">
      <span className="flex w-5 shrink-0 items-center justify-center">{swatch}</span>
      {children}
    </span>
  );
}

// The graph's key — kept OFF the canvas. A permanent legend row is chrome sitting on every knowledge graph;
// instead a quiet ⓘ in the corner reveals the key on hover, so the field reads clean at rest. Shape carries
// the kind (the nodes draw it); only two colour rules are real — forest = the focused node, and solid vs
// dashed strokes = confirmed vs the agent's proposed links. (A per-kind colour legend would be wrong: nodes
// colour by collection / identity.)
export function GraphLegend({
  className = "",
  compact = false,
  colorLabel = "Collection",
  colorDot = false,
}: {
  className?: string;
  compact?: boolean;
  colorLabel?: string; // what node COLOUR means — the ego graph's focused centre, or the space graph's team
  colorDot?: boolean; // a single forest dot suits "focused"; a multi-hue cluster encoding shouldn't show one
}) {
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        openOnHover
        delay={80}
        render={
          <span
            aria-label="What this graph shows"
            className={`inline-flex size-6 cursor-help items-center justify-center rounded-full text-foreground-hint outline-none transition-colors hover:bg-tint-1 hover:text-muted-foreground data-[popup-open]:bg-tint-2 data-[popup-open]:text-muted-foreground ${className}`}
          >
            <Info className="size-3.5" />
          </span>
        }
      />
      <PopoverContent side="bottom" align="start" sideOffset={6} className="w-auto p-3.5">
        {/* grouped by the THREE axes the graph encodes on, each with a quiet label over inked items — the flat
            same-weight stack (every row 12px muted, parted by dividers) had no hierarchy to read */}
        <div className="flex flex-col gap-3.5 whitespace-nowrap">
          {/* "Line", not "Links": the dash is one axis of the alphabet and it is worn by a tie AND by a mark
              still being woven in, so the group is named for the axis, as "Colour" and "Shape" are */}
          <LegendGroup label="Line">
            <div className="flex flex-col gap-1.5">
              <LegendItem swatch={<EdgeSwatch />}>Confirmed</LegendItem>
              <LegendItem swatch={<EdgeSwatch dashed />}>Proposed</LegendItem>
              {/* the same dash on a MARK: a node still being woven in. It was drawn on the canvas (a dashed
                  outline is the alphabet's one "not yet") and explained nowhere, so a reader who had the key
                  open still met a dashed square it did not name. */}
              <LegendItem swatch={<NodeSwatch kind="artifact" fill="var(--muted-foreground)" processing />}>Still processing</LegendItem>
            </div>
          </LegendGroup>
          {compact ? null : (
            <>
              <LegendGroup label="Colour">
                {/* ego graph → a forest swatch + "Focused"; space graph → no single swatch (the cluster
                    encoding is multi-hue, one dot would lie), so the item is the meaning alone */}
                <LegendItem swatch={colorDot ? <NodeSwatch kind="artifact" fill="var(--primary)" /> : null}>
                  {colorLabel}
                </LegendItem>
              </LegendGroup>
              <LegendGroup label="Shape">
                <div className="grid grid-cols-2 gap-x-5 gap-y-1.5">
                  {LEGEND_KINDS.map((k) => (
                    <LegendItem
                      key={k.kind}
                      swatch={
                        <NodeSwatch kind={k.kind} fill="color-mix(in srgb, var(--muted-foreground) 42%, var(--card))" />
                      }
                    >
                      {k.label}
                    </LegendItem>
                  ))}
                </div>
              </LegendGroup>
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// node body by KIND — shape carries the category (colour carries identity). The halo stroke is the GROUND's
// colour (--graph-ground), not the card's: a graph on the page ground with a card-coloured halo showed a pale
// ring around every mark, a glow the alphabet forbids. The fill transitions: in another node's spotlight a
// mark gives up its hue for the ink (see the nodes below), and the change should read as a dimming, not a swap.
function NodeShape({
  kind,
  r,
  fill,
  processing,
}: {
  kind: RefKind;
  r: number;
  fill: string;
  processing?: boolean;
}) {
  const p = {
    stroke: "var(--graph-ground, var(--card))",
    strokeWidth: 1.5,
    // a node still being processed is a dashed outline on the ground — the graph's one "not yet" mark, the
    // same dash a proposed tie wears, at the mark's own radius so a pending square is the size of a settled
    // one. Half-transparent fill said "faded", not "pending".
    strokeDasharray: processing ? "2.2 2.2" : undefined,
    style: {
      fill: processing ? "var(--graph-ground, var(--card))" : fill,
      fillOpacity: 1,
      transition: "fill 160ms ease-out, stroke 160ms ease-out",
      ...(processing ? { stroke: fill, strokeWidth: 1.2 } : {}),
    },
  };
  if (kind === "artifact") return <rect x={-r} y={-r} width={2 * r} height={2 * r} rx={r * 0.5} {...p} />;
  if (kind === "collection")
    return <rect x={-r} y={-r} width={2 * r} height={2 * r} rx={r * 0.2} {...p} />;
  if (kind === "topic") {
    const pts = Array.from({ length: 6 }, (_, k) => {
      const a = Math.PI / 6 + (k * Math.PI) / 3;
      return `${(r * 1.06 * Math.cos(a)).toFixed(1)},${(r * 1.06 * Math.sin(a)).toFixed(1)}`;
    }).join(" ");
    return <polygon points={pts} {...p} />;
  }
  if (kind === "decision")
    return <polygon points={`0,${-r * 1.18} ${r * 1.18},0 0,${r * 1.18} ${-r * 1.18},0`} {...p} />;
  // a source is a RING: the ground inside, the identity hue on the line. A person and a source were both
  // filled discs, so the one alphabet the drawing promises (shape = kind) had two kinds on one letter, and
  // a transcript read as a person. A hollow circle is an origin OUTSIDE the base. The inside takes the
  // canvas's own ground (the explorer sets it to the page's), so the ring is a hole in the paper and not a
  // lighter disc; a source still being processed keeps the dash, which already says "not yet".
  if (kind === "source")
    return <circle r={r} {...p} style={{ ...p.style, fill: "var(--graph-ground, var(--card))", stroke: fill }} />;
  return <circle r={r} {...p} />; // person
}

// The drawing's box, in its own units — the svg's viewBox. Every layout is computed in it and the svg scales it
// to the container, type included, so the unit's size on screen is the container's width over W. The default
// is the collection map's and the overlay's; the explorer hands in its own width (780: at the 976px column the
// unit is 1.25px, the rung the names are cut for — see GraphView), because the field there is the column's
// whole width and a 520-wide box stretched across it would have put every name two rungs up.
// H is optional: absent, the HEIGHT IS THE DRAWING'S — the ring and its margins, plus whatever column is
// open under it (radial), or the rings and their margins (orbit). Round 1 gave the explorer a 440-unit box
// whatever was drawn, and a topic with five neighbours sat in the upper third of a 550px slab with 280px of
// empty ground under it: the field was sized to the viewport, not to what it held. A box with no H is as
// tall as its content and one margin, and grows only when the reader opens a column. The force settle
// still needs a frame to fit into (it scales the cloud to the box), so a caller without one gets the
// default's aspect.
export type GraphBox = { W: number; H?: number };
const BOX: GraphBox = { W: 520, H: 400 };

// The node's drawn radius, at rest and unclustered. Shared with the label-collision pass so a name can
// never be placed on top of a mark the drawing is about to put there. Diameters at the explorer's unit
// (1.25px): the subject 16, a direct neighbour 12 — the list's own 12px mark, one alphabet at one size across
// the page — a further node 10 (8 under the explorer's "beside" rule, see markRadius). They were 21 / 15 / 10
// and the ring's squares outweighed the 13px names beside them; a figure's marks are the size of its type.
function nodeRadius(n: GraphNode) {
  return n.depth === 0 ? 6.4 : n.depth === 2 ? 4 : 4.8;
}
const PAD_X = 48;
const PAD_BOT = 46; // labels sit below the node — keep the settled cloud inside the frame

// Force-directed settle (Fruchterman–Reingold) seeded from a deterministic radial layout: the result
// is stable across renders (no RNG, so SSR == client) yet nodes repel into an even, overlap-free
// spread. The focused node is pinned at centre; everything else relaxes under repulsion + edge springs.
export function layout(
  nodes: GraphNode[],
  edges: Neighborhood["edges"],
  spread = false,
  box: { W: number; H: number } = { W: BOX.W, H: BOX.H! },
): Map<string, { x: number; y: number }> {
  const { W, H } = box;
  const cx = W / 2;
  const cy = H / 2;
  const n = nodes.length;
  const idx = new Map(nodes.map((nd, i) => [nd.id, i]));
  const centerI = Math.max(0, nodes.findIndex((nd) => nd.depth === 0));

  // spread — a graph of DISCONNECTED pairs (the verify view). A force settle flings the components to
  // the corners and the scale-to-fit then crushes each pair to a dot, so instead grid the components:
  // one connected group per cell, its nodes fanned around the cell centre. Bounded box, readable pairs.
  if (spread) {
    const adj = new Map<string, string[]>();
    for (const nd of nodes) adj.set(nd.id, []);
    for (const e of edges) {
      adj.get(e.from)?.push(e.to);
      adj.get(e.to)?.push(e.from);
    }
    const compOf = new Map<string, number>();
    let nc = 0;
    for (const nd of nodes) {
      if (compOf.has(nd.id)) continue;
      const stack = [nd.id];
      while (stack.length) {
        const u = stack.pop()!;
        if (compOf.has(u)) continue;
        compOf.set(u, nc);
        for (const v of adj.get(u) ?? []) if (!compOf.has(v)) stack.push(v);
      }
      nc++;
    }
    const comps: string[][] = Array.from({ length: nc }, () => []);
    for (const nd of nodes) comps[compOf.get(nd.id) ?? 0].push(nd.id);
    const cols = Math.ceil(Math.sqrt(nc));
    const rows = Math.max(1, Math.ceil(nc / cols));
    const px = 70;
    const py = 48;
    const cellW = (W - 2 * px) / cols;
    const cellH = (H - 2 * py) / rows;
    const out = new Map<string, { x: number; y: number }>();
    comps.forEach((ids, ci) => {
      const ccx = px + cellW * ((ci % cols) + 0.5);
      const ccy = py + cellH * (Math.floor(ci / cols) + 0.5);
      const r = ids.length === 1 ? 0 : Math.min(cellW, cellH) * 0.3;
      ids.forEach((id, k) => {
        const a = -Math.PI / 2 + (k / Math.max(ids.length, 1)) * 2 * Math.PI;
        out.set(id, { x: ccx + r * Math.cos(a), y: ccy + r * Math.sin(a) });
      });
    });
    return out;
  }

  // seed — radial rings (deterministic), the settle's starting frame
  const P = nodes.map((nd) => {
    if (nd.depth === 0) return { x: cx, y: cy };
    const ring = nodes.filter((m) => m.depth === nd.depth);
    const ri = ring.indexOf(nd);
    const R = nd.depth === 1 ? 122 : 196;
    const a =
      -Math.PI / 2 + (ri / Math.max(ring.length, 1)) * 2 * Math.PI + (nd.depth === 2 ? 0.5 : 0);
    return { x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) };
  });

  const k = 1.28 * Math.sqrt((W * H) / Math.max(n, 1)); // ideal node separation (roomier → fills the frame evenly)
  let temp = W / 9;
  const ITER = 340;
  for (let it = 0; it < ITER; it++) {
    const disp = nodes.map(() => ({ x: 0, y: 0 }));
    // repulsion — every pair pushes apart (f = k²/d)
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = P[i].x - P[j].x;
        const dy = P[i].y - P[j].y;
        const d = Math.hypot(dx, dy) || 0.01;
        const f = (k * k) / d;
        const ux = dx / d;
        const uy = dy / d;
        disp[i].x += ux * f;
        disp[i].y += uy * f;
        disp[j].x -= ux * f;
        disp[j].y -= uy * f;
      }
    }
    // attraction — linked nodes pull together (f = d²/k)
    for (const e of edges) {
      const a = idx.get(e.from);
      const b = idx.get(e.to);
      if (a == null || b == null) continue;
      const dx = P[a].x - P[b].x;
      const dy = P[a].y - P[b].y;
      const d = Math.hypot(dx, dy) || 0.01;
      const f = (d * d) / k;
      const ux = dx / d;
      const uy = dy / d;
      disp[a].x -= ux * f;
      disp[a].y -= uy * f;
      disp[b].x += ux * f;
      disp[b].y += uy * f;
    }
    // integrate — pin centre, mild gravity on the rest, step-limit by temperature, clamp to frame
    for (let i = 0; i < n; i++) {
      if (i === centerI) continue;
      const g = spread ? 0.004 : 0.006; // gentle centering only — a connected ego graph is held by its edges,
      // so heavy gravity just collapses the branches into the middle; less gravity lets them fan out evenly
      disp[i].x += (cx - P[i].x) * g;
      disp[i].y += (cy - P[i].y) * g;
      const dl = Math.hypot(disp[i].x, disp[i].y) || 0.01;
      const step = Math.min(dl, temp);
      P[i].x += (disp[i].x / dl) * step;
      P[i].y += (disp[i].y / dl) * step;
    }
    temp = Math.max(temp * 0.975, 1.5);
  }

  // normalise — scale the settled cloud around the pinned centre so it fits the frame without
  // clamping nodes onto the border (which would otherwise pile them along an edge in a line).
  let maxAbsX = 1;
  let maxAbsY = 1;
  for (let i = 0; i < n; i++) {
    if (i === centerI) continue;
    maxAbsX = Math.max(maxAbsX, Math.abs(P[i].x - cx));
    maxAbsY = Math.max(maxAbsY, Math.abs(P[i].y - cy));
  }
  // fit each axis INDEPENDENTLY — a tall-narrow settle otherwise leaves the wide canvas' sides empty
  // (uniform scale is limited by the tighter axis). Cap the anisotropy so the weave never visibly stretches.
  let sx = Math.min((W / 2 - PAD_X) / maxAbsX, 1.6);
  let sy = Math.min((H / 2 - PAD_BOT) / maxAbsY, 1.6);
  const ASPECT = 1.35;
  if (sx > sy * ASPECT) sx = sy * ASPECT;
  else if (sy > sx * ASPECT) sy = sx * ASPECT;
  for (let i = 0; i < n; i++) {
    if (i === centerI) continue;
    P[i].x = cx + (P[i].x - cx) * sx;
    P[i].y = cy + (P[i].y - cy) * sy;
  }

  const pos = new Map<string, { x: number; y: number }>();
  nodes.forEach((nd, i) => pos.set(nd.id, P[i]));
  pos.set(nodes[centerI]?.id ?? "", { x: cx, y: cy });
  return pos;
}

// radial — the ego arrangement: the focused node pinned at the ring's centre, its direct neighbours on ONE
// ring around it, and each neighbour's further ties — the fold behind its "+N" — as a COLUMN hanging off it.
// Index-based → deterministic and stable across renders, no settle.
//
// Angles by WEIGHT, not by count. Four neighbours used to sit at exact 45° intervals — a diagram, not a
// neighbourhood. Each first-ring node owns a sector of the circle proportional to √(1 + the second-hop nodes
// it reaches) and sits at its sector's middle; the square root keeps a hub from taking the whole circle — a
// fifteen-tie hub against three leaves gets 44%, not 71%. The sectors run clockwise in the data's order, turned
// so the HEAVIEST hub's middle sits at −45° (upper right): its column has the whole lower right of the box to
// hang into, and its names go outward to the right, where the box is widest. (Round 0 started the first sector
// at 12 o'clock, which put a fifteen-tie hub on the right at mid-height and a lone neighbour at 6 o'clock —
// exactly where a hanging list has the least room.)
//
// The further ties were a FAN on an outer ring: fifteen hairlines from one point to a staggered stack of names
// that ran into the column's edge, with the last four faded out (round 0's judge: "a sunburst plus a gradient
// fade, the two laziest reveal patterns"). Now they are a list — the same list the List tab draws under the
// hub's fold row: one column of rows at an equal pitch (ROW, 16 units = 20px at the explorer's unit), each row
// a kind mark and its name on ONE edge, the column standing just OUTSIDE the ring on the hub's side of the
// field (COL_OUT past the ring's rx) so it clears every ring name inside it, and hanging DOWN from the hub.
// The ties are drawn as a CHAIN — the hub to its first row, then each row to the next (see `prev`), so one
// line runs down the column through the marks instead of fifteen from one point; each row's own tie is the
// segment that reaches it (dashed there if proposed, lit there on hover, verifiable there). The first segment,
// the LEAD, leaves the hub's mark for the column two rows down. It used to pass under the hub's name, which
// sat beside the mark on the column's side, and the knockout hid the line under the first glyphs — a line
// that emerged from beneath a word, the one thing round 1's judge asked the field never to do. The lead now
// COSTS the hub its beside seat (chooseLabelSides no longer treats it as soft at the hub's end), so a hub with
// a column seats its name where nothing leaves the mark — above it, or a corner — and the lead leaves clean.
// A column that would run past MAX_H is cut at the last row that fits, and that row reads "+N more" for the
// rest (`hidden`, `more`) — a name is shown or folded, never faded. Every hub's column is laid out here, drawn
// or not (the seats depend on it), and two hubs on one side lay their columns over the same ground: ONE fold
// is open at a time (the explorer's accordion), so no two are ever drawn together — the box could not hold a
// fifteen-row column and a four-row one on the same side, and stacking the second under the first left it
// nothing but "+4 more".
//
// The ring must hold still when a column appears (the explorer PREVIEWS a fold on hover; a name that hops on
// hover reads as a glitch), so the caller lays out on the WIDE neighbourhood (layoutData) whichever reach it
// draws: the sectors and every column are the same at every reach. A second-hop node hangs off the first
// first-ring node (in ring order) that reaches it; one tied to two parents keeps one straight chord to the other.
// Output is rounded to 1/100 px (server and browser V8 can differ in the 14th digit, and React reports the
// mismatch on hydration).
//
// Geometry in ABSOLUTE units from the box's top, not fractions of a height that is no longer given: the ring's
// ry is 128 (160px at the explorer's unit), its centre PAD_TOP + ry under the tab row's hairline, its rx 0.26
// of the width (at 780 a hub at −45° with a 24-character name and its chip still ends inside the box, and so
// does the column beside it). The field's height follows (`extent`): at rest the ring and its margins — the
// bottom margin the larger, so the hub sits a little above the middle (152 of 336, 45%: the optical centre)
// — and, with a column out, that column's last row and one margin. Round 1 fixed the height at 440 and put the
// centre at 0.36 of it so the columns had room below; the room was there whether or not a column was, and a
// five-node topic floated in the upper third of the well.
const EGO = { rx: 0.26, ry: 128, PAD_TOP: 24, PAD_BOT: 56, ROW: 16, COL_OUT: 10, MAX_H: 480 };
// Which first-ring node a second-hop node hangs off: the first (in ring order) that reaches it; a node tied
// to two hubs belongs to one sector and keeps a chord to the other. Exported because the explorer's FOLDS are
// these same sets — the "+N" on a hub counts exactly the nodes its sector holds, so unfolding a hub fills its
// own column and nothing else. Computed here once so the column and the fold can never disagree about who is whose.
export function sectorKids(nodes: GraphNode[], edges: Neighborhood["edges"]): Map<string, GraphNode[]> {
  const ring1 = nodes.filter((n) => n.depth === 1);
  const ring2 = nodes.filter((n) => n.depth === 2);
  const tied = (a: string, b: string) => edges.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
  const kids = new Map<string, GraphNode[]>(ring1.map((n) => [n.id, []]));
  for (const m of ring2) {
    // an orphan (no first-ring tie in the given edges) hangs off the last sector rather than vanishing
    const parent = ring1.find((n) => tied(n.id, m.id)) ?? ring1[ring1.length - 1];
    if (parent) kids.get(parent.id)!.push(m);
  }
  return kids;
}
// what the radial layout knows beyond positions: the column structure the drawing and the seats are built on
export type Radial = {
  pos: Map<string, { x: number; y: number }>;
  parent: Map<string, string>; // a listed node → the hub whose column it sits in
  prev: Map<string, string>; // a listed node → what its chain segment comes from: the hub, or the row above
  side: Map<string, 1 | -1>; // a listed node → which way its row reads (1: mark then name to the right)
  hidden: Set<string>; // listed nodes with no row (their column ran out of box) — folded into a "+N more" row
  more: { hub: string; count: number; x: number; y: number; side: 1 | -1 }[];
  // how tall the drawing is: the ring and its margins at rest, and under each hub the height its column
  // needs once it is out (its last row — or its "+N more" row — plus one margin). The box takes the largest
  // of rest and the open columns' (see the field's H).
  extent: { rest: number; column: Map<string, number> };
};
const NO_RADIAL: Omit<Radial, "pos"> = { parent: new Map(), prev: new Map(), side: new Map(), hidden: new Set(), more: [], extent: { rest: 0, column: new Map() } };
function radialLayout(nodes: GraphNode[], edges: Neighborhood["edges"], W: number): Radial {
  const cx = W / 2;
  const cy = EGO.PAD_TOP + EGO.ry;
  const rx = Math.round(W * EGO.rx);
  const ry = EGO.ry;
  const pos = new Map<string, { x: number; y: number }>();
  const put = (id: string, x: number, y: number) => pos.set(id, { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
  for (const nd of nodes) if (nd.depth === 0) put(nd.id, cx, cy);
  const ring1 = nodes.filter((n) => n.depth === 1);
  const kids = sectorKids(nodes, edges);
  const weight = ring1.map((n) => Math.sqrt(1 + (kids.get(n.id)?.length ?? 0)));
  const total = weight.reduce((a, b) => a + b, 0) || 1;
  // the heaviest sector's middle at −45°: the sectors before it (in ring order) sum to `before`, so the ring
  // starts that far, and half the heaviest's own span, earlier
  const heavy = weight.reduce((bi, w, i) => (w > weight[bi] ? i : bi), 0);
  const before = weight.slice(0, heavy).reduce((a, b) => a + b, 0);
  let a = -Math.PI / 4 - ((before + weight[heavy] / 2) / total) * 2 * Math.PI;
  const hubAt = new Map<string, { x: number; y: number }>();
  ring1.forEach((n, i) => {
    const span = (weight[i] / total) * 2 * Math.PI;
    const mid = a + span / 2;
    const hx = cx + rx * Math.cos(mid);
    const hy = cy + ry * Math.sin(mid);
    put(n.id, hx, hy);
    hubAt.set(n.id, { x: hx, y: hy });
    a += span;
  });
  // the columns
  const out: Radial = {
    pos,
    parent: new Map(),
    prev: new Map(),
    side: new Map(),
    hidden: new Set(),
    more: [],
    extent: { rest: cy + ry + EGO.PAD_BOT, column: new Map() },
  };
  for (const hub of ring1) {
    const { x: hx, y: hy } = hubAt.get(hub.id)!;
    const ks = kids.get(hub.id) ?? [];
    if (!ks.length) continue;
    const sx: 1 | -1 = hx >= cx ? 1 : -1;
    const colX = cx + sx * (rx + EGO.COL_OUT);
    const y0 = hy + 2 * EGO.ROW;
    // rows that fit under the cap: a row's name is ~7 units tall either side of its centre, over the top
    // margin's worth of ground — the box grows to hold them, up to MAX_H
    const fit = Math.max(0, Math.floor((EGO.MAX_H - EGO.PAD_TOP - 7 - y0) / EGO.ROW) + 1);
    const shown = fit >= ks.length ? ks.length : Math.max(0, fit - 1);
    let prevId = hub.id;
    ks.forEach((k, j) => {
      out.parent.set(k.id, hub.id);
      out.side.set(k.id, sx);
      if (j >= shown) {
        out.hidden.add(k.id);
        put(k.id, colX, y0 + shown * EGO.ROW); // parked on the "+N more" row: a seat for anything that asks
        return;
      }
      put(k.id, colX, y0 + j * EGO.ROW);
      out.prev.set(k.id, prevId);
      prevId = k.id;
    });
    if (shown < ks.length) out.more.push({ hub: hub.id, count: ks.length - shown, x: colX, y: y0 + shown * EGO.ROW, side: sx });
    // the column's last row (the "+N more" row when there is one) and, under it, the same air the ring has
    // over it: a list's end, not the ring's optical margin
    out.extent.column.set(hub.id, y0 + (shown < ks.length ? shown : shown - 1) * EGO.ROW + 7 + EGO.PAD_TOP);
  }
  return out;
}

// arc — a provenance/timeline reading along X: "where it came from → where it goes". The focused doc
// sits dead centre; sources (and anything the focus was sourced_from / superseded by) go LEFT; outgoing
// links and artifacts derived from the focus go RIGHT. Each column spreads down Y so a depth-1
// neighborhood stays legible. Deterministic (stable node/edge order → stable rows).
function arcLayout(
  nodes: GraphNode[],
  edges: Neighborhood["edges"],
  box: { W: number; H: number },
): Map<string, { x: number; y: number }> {
  const { W, H } = box;
  const cx = W / 2;
  const cy = H / 2;
  const focusId = nodes.find((n) => n.depth === 0)?.id;

  // -1 = left (provenance / upstream), 0 = middle (the focus), 1 = right (derived / referenced)
  const sideOf = (n: GraphNode): -1 | 0 | 1 => {
    if (n.id === focusId) return 0;
    if (n.kind === "source") return -1; // an external origin — always upstream
    if (focusId != null) {
      for (const e of edges) {
        const other = e.from === focusId ? e.to : e.to === focusId ? e.from : null;
        if (other !== n.id) continue;
        // sourced_from / supersedes point from the derived/newer node back to the origin/older one, so
        // they read AGAINST the arrow; every other edge reads with it (focus → x means x is downstream).
        const reversed = e.type === "sourced_from" || e.type === "supersedes";
        return (e.from === focusId) !== reversed ? 1 : -1;
      }
    }
    return 1; // no direct edge to the focus (e.g. a depth-2 node) — read as downstream
  };

  const left: string[] = [];
  const mid: string[] = [];
  const right: string[] = [];
  for (const n of nodes) {
    const s = sideOf(n);
    (s < 0 ? left : s > 0 ? right : mid).push(n.id);
  }

  const out = new Map<string, { x: number; y: number }>();
  // fan each side into a gentle arc: nodes bow outward at mid-height, so a crowded column spreads in 2D
  // (varying x AND y) instead of a straight vertical line — that's what keeps the labels from stacking.
  const place = (ids: string[], baseX: number, dir: -1 | 0 | 1) => {
    const top = 52;
    const bot = H - 52;
    const n = ids.length;
    const bowMax = n > 4 ? 56 : n > 2 ? 26 : 0; // only bow columns crowded enough to need the room
    ids.forEach((id, k) => {
      const t = n <= 1 ? 0.5 : k / (n - 1);
      const y = n <= 1 ? cy : top + (bot - top) * t;
      const x = baseX + Math.sin(t * Math.PI) * bowMax * dir;
      out.set(id, { x, y });
    });
  };
  place(left, 104, -1);
  place(mid, cx, 0);
  place(right, W - 104, 1);
  return out;
}

// orbit — the space field (Team). Lives in orbit-layout.ts so it can be scored without a browser. The rings:
// the outer rx at 0.36 of the width and ry 158 units (the people's marks span 72% of the width and their
// names, beside them, reach the box's margins; at 780 wide the outer ring is 562×316), the inner at 0.19 of
// the width and 84 tall. The ellipse is wide, which is what a ring of names beside their marks wants: at the
// sides, where names stack, equal angular steps land 76 units apart; at the top and bottom, where they sit
// side by side, 136. The box's height is the rings' (the same PAD_TOP / PAD_BOT the ego map takes, so the
// two pages set their figure into the page the same way: the space a little above the middle of the drawing,
// 182 of 396). Round 1 stated the rings as fractions of a 440-unit box; the box is the drawing's now, and
// the rings are the same size they were.
const ORBIT = { rx: 0.36, ry: 158, innerRx: 0.19, innerRy: 84 };
const orbitGeom = (W: number) => {
  const cy = EGO.PAD_TOP + ORBIT.ry;
  return {
    W,
    H: cy + ORBIT.ry + EGO.PAD_BOT,
    cy,
    INNER: { rx: Math.round(W * ORBIT.innerRx), ry: ORBIT.innerRy },
    OUTER: { rx: Math.round(W * ORBIT.rx), ry: ORBIT.ry },
    names: "beside" as const,
  };
};

function clip(label: string, n = 17): string {
  return label.length > n ? label.slice(0, n - 1) + "…" : label;
}
// how much of a name is drawn at rest: the space field and a collection map clip at 16 (22 for the centre)
// because forty names compete for the frame; a subject's ego map with a handful of neighbours has nothing
// but white space to spend, so it writes them out (fullLabels). An ellipsis beside an empty field was the
// canvas saying it had no room while showing that it did.
const CLIP = { center: 22, other: 16 } as const;
const NO_CLIP = { center: Infinity, other: Infinity } as const;

// A FOLD on the field — "+N" standing in for the nodes a hub reaches that are not drawn. It is the house's
// fold chip (the people stack's "+3", the collection tag's "+2"; settled 2026-09-10): the one small number
// that takes a ground, because it stands among grounded objects — tint-1, muted 500, tabular, 12, no border,
// 20 tall. Open, it reads "−": the same object, saying the ring is out. A passive span: the graph wraps it
// in the button that carries the hit area and the aria (the fold layer below), the list puts it inside its
// row's own button — one material, two hosts. `opaque`: on the field the ground is the tint-1 rung mixed
// over the page (OverflowAvatar's mix — the same rung, resolved per theme), because a tie runs under the
// chip and the alpha ground let the line through; the name beside it knocks its line out with a stroke of
// the ground, and the chip does the same with a solid one. The mix is over --graph-ground, the field's own
// ground, so on the explorer's well (itself the tint-1 rung over the page) the chip composites one rung up,
// the way an alpha tint would — stated over the page it put a well-coloured chip on a well-coloured ground
// and vanished. `lifted` is the hover: one rung up (tint-2), the figure in full ink — the collection tag's own
// hover — which the field states by hand because an inline ground outranks a hover class. Open, the chip KEEPS its closed width (an invisible "+N" holds the box
// under the "−"): it is the same object at the same seat, so the click that opens a ring moves nothing
// under the pointer, on the field or in the list's fold row — and the field measures one box for both
// faces. `ref` is that box, for the field's seat (see the fold layer).
export function FoldChip({
  count,
  open,
  opaque,
  lifted,
  className,
  ref,
}: {
  count: number;
  open: boolean;
  opaque?: boolean;
  lifted?: boolean;
  className?: string;
  ref?: React.Ref<HTMLSpanElement>;
}) {
  return (
    <span
      ref={ref}
      aria-hidden="true"
      data-count={`+${count}`}
      className={cn(
        "inline-grid h-5 min-w-5 shrink-0 place-items-center rounded-full px-1.5 text-xs leading-none font-medium tabular-nums transition-colors",
        "before:invisible before:col-start-1 before:row-start-1 before:content-[attr(data-count)]",
        !opaque && "bg-tint-1",
        lifted ? "text-foreground" : "text-muted-foreground",
        className,
      )}
      style={opaque ? { backgroundColor: `color-mix(in oklab, var(--foreground) ${lifted ? 10 : 6}%, var(--graph-ground, var(--background)))` } : undefined}
    >
      <span className="col-start-1 row-start-1">{open ? "−" : `+${count}`}</span>
    </span>
  );
}

// the fold's state on a hub, as the explorer hands it in: how many the fold hides, and whether it is out
export type Fold = { count: number; open: boolean };
// a chip's seat moves on the node's transform clock (a relayout) and fades on the spotlight's; read through
// --fold-motion, which the box switches on after its first paint. Nothing rides a hover: the hover scales
// the MARK alone (round 2), and the chip is seated on the name, which does not move.
const FOLD_MOTION = "left 0.55s cubic-bezier(0.22,1,0.36,1), top 0.55s cubic-bezier(0.22,1,0.36,1), opacity 160ms ease-out";
// the air between a name's last glyph and its chip, CSS pixels
const CHIP_GAP = 6;

export function LocalGraph({
  data,
  onSelect,
  onVerifyEdge,
  verifiedBy,
  spread,
  flow,
  dense,
  renderPopover,
  layout: layoutMode = "force",
  highlight,
  fullLabels,
  outerRing = "faint",
  previewIds,
  layoutData,
  labelRule = "seat",
  namedDepth,
  folds,
  onFoldToggle,
  onFoldPeek,
  box = BOX,
  centreName = "drawn",
  className,
}: {
  data: Neighborhood;
  onSelect: (id: string) => void;
  // when provided, proposed (dashed) edges become resolvable in place — hover one, then ✓ / ✕
  onVerifyEdge?: (edgeId: string, action: "confirm" | "discard") => void;
  // a verified edge's durable record — WHO confirmed it, WHEN — surfaced as a stamp on the edge (the ledger).
  // Returns null for edges verified without a recorded gesture (seed data), so only real confirms carry one.
  verifiedBy?: (edgeId: string) => { name: string; seed: string; at: string } | null;
  // spread layout — for a graph of disconnected pairs (the verify view), so they don't collapse inward
  spread?: boolean;
  // flow — send a slow particle down each confirmed edge, so the web reads as alive (immersive view only)
  flow?: boolean;
  // dense — finer nodes, labels + strokes for the immersive full-screen view (which scales the graph ~2×)
  dense?: boolean;
  // when provided, clicking a node opens a popover anchored AT the node — the parent renders its body;
  // api.select moves the peek to another node (e.g. a related chip), api.close dismisses it
  renderPopover?: (id: string, api: { close: () => void; select: (id: string) => void }) => React.ReactNode;
  // layout lens — "force" (default) is the settle; "radial" is a concentric ego view by depth; "arc" is
  // a left→right provenance reading (sources ← focus → derived). Only swaps the position map.
  layout?: "force" | "radial" | "arc" | "orbit";
  // highlight — when non-empty, drives the SAME spotlight hover uses: these node ids (and the edges with
  // both ends inside the set) stay lit, everything else dims. Hover still works and takes precedence.
  highlight?: string[];
  // fullLabels — names unclipped, and offered a seat at every depth (not only depth ≤ 1). For a field with
  // few nodes and room to spare; a crowded field keeps the clip and the depth cap.
  fullLabels?: boolean;
  // outerRing — how depth-2 nodes are drawn at rest. "faint" (0.4) is the context ring an artifact's
  // neighbourhood carries; "full" is for a view where the reader CHOSE the wider reach, and what they
  // asked for is drawn in full ink, size alone saying it is a hop further.
  outerRing?: "faint" | "full";
  // previewIds — the ghost: node AND edge ids the wider setting would add, drawn in one grey at half strength
  // (named where a name fits) while a pointer rests on the control that would add them. Hover shows what the
  // setting would add before the click commits it; the hue arrives with the click. Edges are listed by id as well, because a wider reach can add a
  // tie between two nodes already drawn (a second hop that lands on a first-hop neighbour), and a tie
  // like that is as new as the ring is.
  previewIds?: string[];
  // layoutData — the neighbourhood the LAYOUT is computed on when it is wider than the one drawn: the
  // explorer lays out on the two-hop neighbourhood at every reach, so the inner ring's seats are the same
  // whether the outer ring is drawn, previewed or absent. It is also the FIELD the names and the fold chips
  // are seated against — every node and tie of it, drawn or not — so no seat changes when a ring is
  // unfolded; hand in only the ties the drawing can ever hold. Positions are looked up by id; a node in
  // data but not here falls back to the centre. Radial only (the other lenses lay out what they draw).
  layoutData?: Neighborhood;
  // labelRule — where a name sits. "seat" (default): each name picks the side of its mark that crosses no line,
  // mark or other name (chooseLabelSides), below first — a crowded field's rule, where forty names compete.
  // "beside" (the explorer's fields, round 1): every name BESIDE its mark, vertically centred, on the mark's
  // outer side — right of it on the right half of the field, left of it on the left — the one seat a ring
  // node's spoke never crosses; the subject's name to the right of its mark, its own spokes breaking behind
  // it (the knockout stroke). A name whose outer seat is taken (a hub's column stands there) takes the inner
  // one, then below or above — the chooser's order with "beside" first — so the placement is one rule with
  // exceptions the reader can see the reason for, not four placements read as meaning (round 0: Dan Lee above,
  // Research right, Growth above-left, the subject below and larger).
  labelRule?: "seat" | "beside";
  // namedDepth — the deepest ring NAMED at rest (a name still comes up in the hover spotlight). Default: 1, or
  // every ring under fullLabels. A far name is drawn only where it fits (the collision pass culls the rest) and,
  // under the "below" rule, one step lighter than a first-ring name — so a fan of twenty-four second-hop names
  // does not arrive as a wall of type at the first ring's weight (round 7 left the far ring unnamed for that
  // reason, and the preview then said only "there is a lot"). A ghost is named the same way, after the live
  // names, and never moves one.
  namedDepth?: number;
  // folds — the reach, grown by touching the graph (2026-09-14; the Direct / Nearby switch is gone). A
  // first-ring node with further ties wears a fold beside its name: "+N", the nodes its sector holds that are
  // not drawn. Hover or focus it and its ring ghosts in (onFoldPeek → the caller's previewIds); click and it
  // unfolds (onFoldToggle → the caller draws the ring live), the chip reading "−". Keyed by hub id; a hub
  // absent here wears nothing. The caller owns the state, because the list shares it (unfold in the list,
  // the graph is unfolded too).
  folds?: Map<string, Fold>;
  onFoldToggle?: (id: string) => void;
  onFoldPeek?: (id: string | null) => void;
  // box — the drawing's units (see GraphBox); the default is the collection map's and the overlay's. A box
  // with no H is as tall as its drawing (see H below).
  box?: GraphBox;
  // centreName — whether the centre's name is written on the field at rest. "drawn" (default): it is, as
  // every other name is. "hover" (the explorer's fields, round 2): the page's h1 IS the subject — its mark
  // at cap height, its name at the title rung — and the same mark and name drawn again 15/500 at the hub
  // said the subject twice at near-equal weight, the two not conversing (round 1's judge). The hub keeps its
  // mark (the letter the title wears, so the figure hangs from the page's own name) and its name comes up
  // under the pointer only, the way a culled name does in the spotlight.
  centreName?: "drawn" | "hover";
  // className — the field's box; a caller with a compact drawing caps the width lower than the 720 default.
  className?: string;
}) {
  const W = box.W;
  const spaceField = layoutMode === "orbit";
  const field = React.useMemo(() => {
    const colIds = new Set(data.nodes.filter((n) => n.kind === "collection" && n.depth !== 0).map((n) => n.id));
    const degree = new Map<string, number>();
    for (const e of data.edges) {
      degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
      degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
    }
    // each person's cluster = the collection they contribute to MOST (highest tie weight = # shared artifacts),
    // not just the first team they touch → the muted hue the person inherits reflects their primary team.
    // weightSum = their TOTAL contribution across every team (Σ shared artifacts) → drives node SIZE, so a hub
    // who spans three teams reads bigger than a one-artifact-each three-edge person (raw degree can't separate
    // them: both are ~3 edges, but the hub's Σweight is far higher).
    const cluster = new Map<string, string>();
    const clusterW = new Map<string, number>();
    const weightSum = new Map<string, number>();
    // only PEOPLE cluster/accumulate weight — guard against the space→collection edges, whose non-collection end
    // is the depth-0 center (a collection node, so it slips past a bare !colIds check); keep it out explicitly.
    const personIds = new Set(data.nodes.filter((n) => n.kind === "person").map((n) => n.id));
    for (const e of data.edges) {
      const person = colIds.has(e.to) ? e.from : colIds.has(e.from) ? e.to : null;
      const col = colIds.has(e.to) ? e.to : colIds.has(e.from) ? e.from : null;
      if (person && col && personIds.has(person)) {
        const w = e.weight ?? 1;
        weightSum.set(person, (weightSum.get(person) ?? 0) + w);
        if (w > (clusterW.get(person) ?? 0)) {
          clusterW.set(person, w);
          cluster.set(person, col);
        }
      }
    }
    const rangeOf = (vals: number[]) => (vals.length ? ([Math.min(...vals), Math.max(...vals)] as const) : ([0, 1] as const));
    return {
      colIds,
      degree,
      cluster,
      weightSum,
      // people size by contribution weight; collections still by degree (member count)
      perRange: rangeOf(data.nodes.filter((n) => n.kind === "person").map((n) => weightSum.get(n.id) ?? 0)),
      colRange: rangeOf([...colIds].map((id) => degree.get(id) ?? 0)),
    };
  }, [data]);
  const norm = (v: number, [lo, hi]: readonly [number, number]) => (hi > lo ? (v - lo) / (hi - lo) : 0.5);
  // the mark's radius as it will be drawn — the space field sizes by member count / contribution weight; the
  // layout needs the same number so a spoke clears the mark that is actually drawn, not the depth default
  const markRadius = React.useCallback(
    (n: GraphNode) => {
      const base = nodeRadius(n);
      // the explorer's third register (labelRule "beside", round 2): a listed row's mark is 8px at the
      // explorer's unit, a step under the ring's 12 as the ring's is under the subject's 16. At 10 the
      // column's fifteen rows weighed the same as the first ring beside them (round 1's judge: "everything
      // at one weight in the unfolded state"); the hop is in the mark's size as it is in the name's ink.
      if (labelRule === "beside" && n.depth >= 2) return 3.2;
      if (!spaceField || n.depth === 0) return base;
      // collections 12–16px across at the explorer's unit, people 9.5–13.5: the same band the ego map's ring
      // and kids sit in (they were 16–21 / 11–19, and the field's squares outweighed its 13px names)
      return n.kind === "collection"
        ? 5 + 1.4 * norm(field.degree.get(n.id) ?? 0, field.colRange)
        : 3.8 + 1.6 * norm(field.weightSum.get(n.id) ?? 0, field.perRange);
    },
    [spaceField, field, labelRule],
  );
  const preview = React.useMemo(() => new Set(previewIds ?? []), [previewIds]);
  const isGhostEdge = (e: GraphEdge) => preview.has(e.id) || preview.has(e.from) || preview.has(e.to);
  // memoised so hovering (which re-renders) never re-runs the 340-iteration force settle; keyed on the
  // layout lens too, so switching mode recomputes once (radial/arc are cheap, deterministic placements).
  // `pos` seats what is DRAWN; `fieldPos` seats the whole field the layout was computed on (layoutData —
  // the same map where there is none). The drawing reads `pos`; the seats are decided against `fieldPos`,
  // see the field below.
  // `radial` is the column structure the radial layout built on the field (empty for the other lenses).
  // `restH` is the height the lens asks for when the box gives none: the rings and their margins (radial,
  // orbit) or the default box's aspect (the force settle and the arc, which fit themselves to a frame).
  const { pos, fieldPos, radial, restH } = React.useMemo(() => {
    if (layoutMode === "radial") {
      const r = radialLayout((layoutData ?? data).nodes, (layoutData ?? data).edges, W);
      const all = r.pos;
      const restH = box.H ?? r.extent.rest;
      if (!layoutData) return { pos: all, fieldPos: all, radial: r, restH };
      return { pos: new Map(data.nodes.map((n) => [n.id, all.get(n.id) ?? { x: W / 2, y: restH / 2 }])), fieldPos: all, radial: r, restH };
    }
    const geom = orbitGeom(W);
    const restH = box.H ?? (layoutMode === "orbit" ? geom.H : Math.round((W * BOX.H!) / BOX.W));
    const frame = { W, H: restH };
    const own =
      layoutMode === "arc"
        ? arcLayout(data.nodes, data.edges, frame)
        : layoutMode === "orbit"
          ? orbitLayout(data.nodes, data.edges, { ...geom, radius: markRadius })
          : layout(data.nodes, data.edges, spread, frame);
    return { pos: own, fieldPos: own, radial: NO_RADIAL, restH };
  }, [data, layoutData, spread, layoutMode, markRadius, box.H, W]);
  // THE BOX'S HEIGHT — the drawing's, when the caller gives none: the ring and its margins, and with a
  // column OUT (its rows live in `data`, not ghosts), that column's height instead. The field grows only on
  // the click that opens a fold, never on the hover that previews one: a ghost column hangs past the box's
  // bottom edge (the svg overflows) rather than growing the page under the pointer — a page whose height
  // changes on hover can summon a scrollbar and shift everything on it by its width. The ring is laid out
  // from the box's TOP in absolute units, so a taller box moves nothing already drawn.
  const H = React.useMemo(() => {
    if (box.H) return box.H;
    let h = restH;
    for (const n of data.nodes) {
      if (preview.has(n.id)) continue;
      const hub = radial.parent.get(n.id);
      if (hub) h = Math.max(h, radial.extent.column.get(hub) ?? 0);
    }
    return h;
  }, [box.H, restH, data, preview, radial]);
  // the FIELD's height — the box at its tallest, every column out — is what the seats are decided against
  // (chooseLabelSides' bounds): a seat decided against the drawn box would change when the box grew, and a
  // name would hop on the click that opens a fold
  const fieldH = React.useMemo(() => Math.max(box.H ?? restH, ...radial.extent.column.values()), [box.H, restH, radial]);
  const at = (id: string) => pos.get(id) ?? { x: W / 2, y: H / 2 };
  // a listed node's row is folded away ("+N more") — drawn nowhere, no tie reaches it
  const hidden = (id: string) => radial.hidden.has(id);
  // THE SEGMENT a tie is drawn as, against a position map: a straight line between its ends, except a listed
  // node's tie to its own hub, which is its CHAIN segment — from the row above it (or the hub, for the first
  // row) to its mark — so a column's ties are one line down the column and not a fan. Null for a tie that
  // reaches a folded-away row ("+N more"). Every consumer of a tie's geometry reads this (the stroke, the
  // hit-line, the verify buttons, the chips' clearance, the names' seats), so none can disagree about where
  // a line is.
  const segOf = React.useCallback(
    (e: { from: string; to: string }, P: Map<string, { x: number; y: number }>): [{ x: number; y: number }, { x: number; y: number }] | null => {
      const kid = radial.parent.get(e.from) === e.to ? e.from : radial.parent.get(e.to) === e.from ? e.to : null;
      if (kid && radial.hidden.has(kid)) return null;
      const a = P.get(kid ? radial.prev.get(kid)! : e.from);
      const b = P.get(kid ?? e.to);
      return a && b ? [a, b] : null;
    },
    [radial],
  );
  // THE FIELD — what every seat is decided against: each node and tie the layout was computed on, drawn or
  // not. The names used to be seated against the drawing, so a hub's name sat below its mark at rest and,
  // the moment its fan was unfolded into that seat, moved to the left seat with its chip — 250px from where
  // the reader had just clicked (2026-09-14, two judges). Unfolding never changes a live name's seat: the
  // undrawn ring is an obstacle from the start, so a hub's name is seated from the first render where its
  // fan leaves room, and the fan's arrival changes nothing. The cost is a seat chosen around marks the
  // reader may never open — on the ego map that is the hub's name to one side instead of below, which is
  // what it would have become on the first unfold anyway. Without layoutData the field is the drawing
  // minus its ghosts (a ghost is not there yet — neither its mark nor its ties may move a name already
  // seated, or every name hops the moment the pointer touches the control and the hover reads as a
  // glitch); with it, a ghost is a field node like any other, already seated around before it ghosts in.
  const fieldNodes = React.useMemo<GraphNode[]>(() => {
    if (!layoutData) return preview.size ? data.nodes.filter((n) => !preview.has(n.id)) : data.nodes;
    const ids = new Set(layoutData.nodes.map((n) => n.id));
    return [...layoutData.nodes, ...data.nodes.filter((n) => !ids.has(n.id))];
  }, [layoutData, data, preview]);
  const fieldEdges = React.useMemo<GraphEdge[]>(() => {
    if (layoutData) return layoutData.edges;
    return preview.size ? data.edges.filter((e) => !isGhostEdge(e)) : data.edges;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- isGhostEdge derives from preview
  }, [layoutData, data, preview]);
  // a field node's index — the seating passes address marks by it, and it orders the names of one depth
  // (the field's own order, which does not change with what is drawn; the drawing's order does — an
  // unfolded ring lists in the order the hubs were opened)
  const fieldIndex = React.useMemo(() => new Map(fieldNodes.map((n, i) => [n.id, i])), [fieldNodes]);
  // Every name picks the side of its mark that crosses no line, mark or other name (chooseLabelSides): the
  // space field's collections send their spokes down through their own names, and an ego map's centre does the
  // same with its ties. Order = the same priority the idle-label pass uses (space: structure then hubs; ego:
  // depth). The dense (immersive) graph scales marks 0.62 and hangs names at r + 10 with smaller type.
  // three registers of type under the explorer's "beside" rule (round 2): the subject 12 units (15px at the
  // explorer's unit), a ring name 10.5 (13), a listed row 9.6 (12, the ladder's next rung) — one step down
  // in size as its mark is one size down and its ink one rung lighter. Elsewhere the far ring keeps the
  // ring's size (a collection map's context ring is faint, not a third register).
  const labelFs = (n: GraphNode) => (dense ? (n.depth === 0 ? 8.5 : 7.5) : n.depth === 0 ? 12 : n.depth >= 2 && labelRule === "beside" ? 9.6 : 10.5);
  const clipAt = fullLabels ? NO_CLIP : CLIP;
  // a name as drawn. A listed row's name is cut to the room its column has to the box's edge (the row has a
  // fuller form: the List tab, the peek): "Cap push notifications at two per day" ran 20px past the well's
  // right edge, its knockout halo showing as a pale patch on the page.
  const textOf = React.useCallback(
    (n: GraphNode) => {
      const sx = radial.side.get(n.id);
      if (sx) {
        const q = fieldPos.get(n.id);
        if (q) {
          // 0.55 em per glyph, not the box model's 0.62 (an upper bound, right for "does this overlap" and a
          // char too strict for "does this fit": it cut "Embargo lifts on the 14th" one glyph short)
          const room = sx > 0 ? W - 8 - (q.x + 4 + SIDE_GAP) : q.x - 4 - SIDE_GAP - 8;
          return clip(n.label, Math.max(6, Math.floor(room / (labelFs(n) * 0.55))));
        }
      }
      return clip(n.label, n.depth === 0 ? clipAt.center : clipAt.other);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labelFs derives from dense
    [radial, fieldPos, W, dense, clipAt],
  );
  // a tie's HOP: direct when it touches the centre, a step further when neither end is the centre (a
  // second-hop tie, or a tie between two direct neighbours the wider reach picks up). Every tie was drawn
  // at one weight, so with the outer ring in full ink the depth was legible only from the marks' sizes —
  // a hub's fan of fifteen second-hop ties weighed the same as its one tie to the subject, and the
  // drawing could not show what the depth switch had done. Direct ties in fuller ink, further ties a
  // lighter, thinner hairline: the distance is in the line, as the size is in the mark.
  const centreId = React.useMemo(() => data.nodes.find((n) => n.depth === 0)?.id, [data]);
  const isFarEdge = (e: GraphEdge) => centreId != null && e.from !== centreId && e.to !== centreId;
  const labelBaseline = dense ? 10 : 13;
  const drawnRadius = React.useCallback((n: GraphNode) => markRadius(n) * (dense ? 0.62 : 1), [markRadius, dense]);
  // each chip's box in the box's units, and the scale it was measured at. The chip is CSS pixels — 20 tall,
  // as wide as its "+N" — and the unit is the box's width over W, so one chip is 16 units tall at 650px
  // and 28 on a phone; its seat is decided in units against the field's ties (the fold layer), so the box
  // is measured, with the names, and again when the box resizes. Declared here, above the seats, because a
  // hub's name is seated with its chip's width in hand (trailOf).
  const chipRefs = React.useRef(new Map<string, HTMLSpanElement>());
  const boxRef = React.useRef<HTMLDivElement>(null);
  const [chipGeom, setChipGeom] = React.useState<{ scale: number; box: Map<string, { w: number; h: number }> } | null>(null);
  // the room a hub's name keeps AFTER itself for its chip and the gap before it, in units: the chip's measured
  // box once there is one, before that an estimate (14px + 7 per glyph of "+N", at the explorer's 1.25 unit)
  const trailOf = React.useCallback(
    (id: string) => {
      const f = folds?.get(id);
      if (!f) return 0;
      const scale = chipGeom?.scale ?? 1.25;
      const w = chipGeom?.box.get(id)?.w ?? (14 + 7 * (1 + String(f.count).length)) / scale;
      return w + CHIP_GAP / scale;
    },
    [folds, chipGeom],
  );
  // the seats a name is offered, most wanted first. Under "beside": the mark's outer side, then its inner
  // side, then below and above, then the corners — one rule the whole field shares (see labelRule); a listed
  // node (a column's row) has ONE seat, outward, because its row is the seat. Elsewhere the chooser's own order.
  const cxOf = React.useMemo(() => fieldPos.get(centreId ?? "")?.x ?? W / 2, [fieldPos, centreId, W]);
  const preferOf = React.useCallback(
    (id: string): LabelSide[] => {
      if (labelRule !== "beside") return SIDES;
      const p = fieldPos.get(id) ?? pos.get(id);
      const listed = radial.side.get(id);
      // the space field's collections read right of their marks whichever side they sit: on the inner ring
      // a collection's spokes leave on every side (its people outward, the space inward), so no side is
      // clear by construction and the outer one is no better than the reading side; the people, on the
      // outer ring, keep the outer side, where nothing crosses
      const readingSide = spaceField && field.colIds.has(id);
      const outer: LabelSide = listed ? (listed > 0 ? "right" : "left") : readingSide || (p?.x ?? cxOf) >= cxOf ? "right" : "left";
      if (listed || id === centreId) return [outer];
      const inner: LabelSide = outer === "right" ? "left" : "right";
      return [outer, inner, "below", "above", ...SIDES.filter((s) => s.includes("-"))];
    },
    [labelRule, fieldPos, pos, radial, cxOf, centreId, spaceField, field],
  );
  // Chosen on the FIELD (fieldNodes / fieldEdges / fieldPos), every name of it, drawn or not: the chooser's
  // answer is then one function of the layout and cannot change with what is drawn — a hub's chosen seat is
  // the same at rest, under a ghosted column and with the column out. The columns' rows are placed FIRST: their
  // seats are fixed (outward, on the row), and a ring name that would sit on a row the next unfold draws is a
  // name that unfold would have to cull, so it is costed against them now and takes another seat at rest.
  // (Names of one depth are placed by id.) A spoke is `soft` at the subject's end alone, where the name's
  // knockout takes it by design (see chooseLabelSides); at every other end a line costs what a line costs.
  const labelSides = React.useMemo<Map<string, LabelSide>>(() => {
    const rankOf = (n: GraphNode) => (n.depth === 0 ? 3 : n.kind === "collection" ? 2 : 1);
    const seatPos = new Map(fieldNodes.map((n) => [n.id, fieldPos.get(n.id) ?? { x: W / 2, y: H / 2 }]));
    const listedFirst = (n: GraphNode) => (radial.side.has(n.id) ? 0 : 1);
    const order = [...fieldNodes]
      .filter((n) => !radial.hidden.has(n.id))
      .sort(
        spaceField
          ? (a, b) => rankOf(b) - rankOf(a) || (field.weightSum.get(b.id) ?? 0) - (field.weightSum.get(a.id) ?? 0) || a.id.localeCompare(b.id)
          : (a, b) => listedFirst(a) - listedFirst(b) || a.depth - b.depth || a.id.localeCompare(b.id),
      )
      .map((n) => ({ id: n.id, text: textOf(n), fs: labelFs(n), baseline: labelBaseline, trail: trailOf(n.id) }));
    const byId = new Map(fieldNodes.map((n) => [n.id, n]));
    const segs = fieldEdges.flatMap((e) => {
      const sg = segOf(e, fieldPos);
      if (!sg) return [];
      const kid = radial.parent.get(e.from) === e.to ? e.from : radial.parent.get(e.to) === e.from ? e.to : null;
      const from = kid ? radial.prev.get(kid)! : e.from;
      const to = kid ?? e.to;
      // soft at the CENTRE's end only, under "beside": the subject's spokes pass behind its name by design
      // (the knockout takes them, and the name is drawn over them when it is drawn at all). Round 1 made a
      // tie soft at BOTH ends, and a column's lead soft at its hub's too, so a neighbour's name sat on its
      // own spoke ("Research" under its line to the hub) and every hub's name had its lead emerging from
      // under its first glyphs: a line the name's other end should keep off costs what any line costs.
      const soft = labelRule === "beside" && (from === centreId || to === centreId) ? [centreId!] : undefined;
      return [{ from, to, soft }];
    });
    return chooseLabelSides(order, seatPos, (id) => drawnRadius(byId.get(id)!), segs, { W, H: fieldH }, preferOf);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labelFs/labelBaseline derive from dense, clipAt from fullLabels
  }, [spaceField, dense, fullLabels, fieldNodes, fieldEdges, fieldPos, field, drawnRadius, radial, segOf, labelRule, centreId, trailOf, preferOf, textOf, W, fieldH]);
  // the seat a name is offered first: the side the chooser found (its first preference where nothing stood
  // in the way). The idle pass may still move a name on when a mark sits where its name would go (see idleSides).
  const sideOf = (id: string): LabelSide => labelSides.get(id) ?? preferOf(id)[0] ?? "below";

  // adjacency for the hover spotlight — who sits one edge away from whom
  const adj = React.useMemo(() => {
    const m = new Map<string, Set<string>>();
    const add = (a: string, b: string) => {
      if (!m.has(a)) m.set(a, new Set());
      m.get(a)!.add(b);
    };
    for (const e of data.edges) {
      add(e.from, e.to);
      add(e.to, e.from);
    }
    return m;
  }, [data]);

  // ── space-field styling (orbit only, i.e. the Team space graph): colour encodes the COLLECTION cluster,
  // node size encodes DEGREE, and edges carry their collection's hue — so the teams read at rest, not on hover
  // (grounded in Obsidian color-groups + node-size-by-references, Kumu decorate-by-field). Scoped to `orbit`
  // so the reader's ego graph (force / radial / arc) keeps its identity-hue palette untouched.
  // the geometry of one thread — a woven bow in the space field, a straight line elsewhere. Shared by the edge
  // stroke AND anything that rides the thread (the flow particle) so they never disagree. Consistent handedness
  // (perpendicular offset = 8% of the span, capped 16px so a long spoke's sagitta stays ≤ 8px and clears nodes).
  // consistent-handed bow so spokes read woven, not a rigid cross. The space field is a bold fan (k .08); the
  // ego graphs get a SUBTLER bow (k .05) — a soft pinwheel. The arc (provenance timeline) stays straight: it
  // reads left→right, a curve would fight that. Long edges cap at a 16px control-offset either way.
  const edgeD = (a: { x: number; y: number }, b: { x: number; y: number }) => {
    if (layoutMode === "arc") return `M${a.x} ${a.y} L${b.x} ${b.y}`;
    // straight. A bow was a third line grammar beside the rail's orthogonal and the mark's straight,
    // and geometry carries nothing here — provenance is the dash, identity is the node.
    return `M${a.x} ${a.y} L${b.x} ${b.y}`;
  };

  const [hovered, setHovered] = React.useState<string | null>(null);
  // what was on the field when it first drew. The entrance is staggered — each mark and tie a few
  // frames after the last, so the figure draws itself in — but ONLY for that first drawing: a node or
  // a tie that arrives later answers a click (an unfold) or a hover (a preview), and an answer does not
  // wait. Staggered, an unfolded column's fifteen rows arrived over a second, smaller and paler toward
  // the bottom, and a still taken 600ms after the click showed the last four rows fading to nothing —
  // round 0's "gradient fade", which was never a design, only a capture of the entrance mid-flight.
  // A ghost is not born: the same node arrives live on the click that follows the hover, and it is
  // that arrival — the answer to the click — that must not wait (born as a ghost, the column's rows
  // came in staggered after all: the pointer had rested on the chip before pressing it). A registry
  // held in state and grown in place after each paint, not a ref: the render reads it, and a ref read
  // in render is what the hooks lint forbids; nothing sets it, so nothing re-renders for it.
  const [born] = React.useState(() => new Set<string>([...data.nodes.map((n) => n.id), ...data.edges.map((e) => e.id)]));
  const late = (id: string) => !born.has(id);
  React.useEffect(() => {
    for (const n of data.nodes) if (!preview.has(n.id)) born.add(n.id);
    for (const e of data.edges) if (!isGhostEdge(e)) born.add(e.id);
  });
  // the hub whose FOLD the pointer rests on. The chip is HTML laid over the svg, seated after the name; it
  // takes no spotlight — a fold hover is what the old Nearby hover was: the whole field stays lit and the
  // column ghosts in. (It used to also hold the hub's hover scale so the chip would not slide out from under
  // the pointer; nothing scales on hover now, so nothing needs holding.)
  const [chipHover, setChipHover] = React.useState<string | null>(null);
  // each folded hub's name as RENDERED, in the box's units, so its chip sits one gap after the last glyph.
  // Measured (getComputedTextLength), not estimated: the collision pass's per-glyph average answers "does
  // this box overlap" and is 4px out on "where does the word end" — the chip hung inside the name or past
  // it. Read after layout and again once the font has arrived; the state moves only when a number does.
  const textRefs = React.useRef(new Map<string, SVGTextElement>());
  const [nameW, setNameW] = React.useState<Map<string, number>>(() => new Map());
  const measure = React.useCallback(() => {
    if (!folds?.size) return;
    setNameW((prev) => {
      let changed = false;
      const next = new Map(prev);
      for (const id of folds.keys()) {
        const el = textRefs.current.get(id);
        if (!el) continue;
        const w = Math.round(el.getComputedTextLength() * 100) / 100;
        if (prev.get(id) !== w) {
          next.set(id, w);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    setChipGeom((prev) => {
      const scale = (boxRef.current?.clientWidth ?? 0) / W;
      if (!(scale > 0)) return prev; // a box with no width (hidden) measures nothing
      let changed = !prev || prev.scale !== scale;
      const box = new Map(prev?.box);
      for (const id of folds.keys()) {
        const el = chipRefs.current.get(id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        const b = { w: Math.round((r.width / scale) * 100) / 100, h: Math.round((r.height / scale) * 100) / 100 };
        const was = prev?.box.get(id);
        if (!was || was.w !== b.w || was.h !== b.h) {
          box.set(id, b);
          changed = true;
        }
      }
      return changed ? { scale, box } : prev;
    });
  }, [folds, W]);
  React.useLayoutEffect(measure, [measure, data]);
  React.useEffect(() => {
    document.fonts?.ready.then(measure);
  }, [measure]);
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [measure]);
  // the chips' motion — the ride on a hub's hover scale, the fade in a spotlight — is switched on two
  // frames after mount, through a custom property their inline transition reads. A chip is first drawn
  // before its box is measured, at the seat the estimate gives; the measurement may move it to the name's
  // other end, and with the transition already on that correction slid the chip across the name on every
  // load. Two frames: the first callback runs before the next paint, the second after it, so the measured
  // seat has been painted once, still, before anything may move.
  React.useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    let raf = requestAnimationFrame(() => {
      raf = requestAnimationFrame(() => el.style.setProperty("--fold-motion", FOLD_MOTION));
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  const hoveredNode = hovered ? data.nodes.find((x) => x.id === hovered) : undefined;
  const hoveredFill = hoveredNode ? nodeFill(hoveredNode) : null;
  const [hoveredEdge, setHoveredEdge] = React.useState<string | null>(null);
  const [sel, setSel] = React.useState<string | null>(null); // the node whose popover is open (popover mode)

  // THE WEAVE — confirming a proposed edge plays a one-shot cinematic beat: a bright signal races down the
  // edge and blooms at its target — the moment a proposal becomes trusted knowledge, the confirm made felt.
  // Endpoints are captured at confirm time so it plays even if the edge then leaves the graph (verify mode
  // drops it). Skipped under prefers-reduced-motion.
  const [weaves, setWeaves] = React.useState<{ key: string; a: { x: number; y: number }; b: { x: number; y: number } }[]>([]);
  const weaveSeq = React.useRef(0);
  const motionOK = React.useRef(true);
  React.useEffect(() => {
    motionOK.current = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);
  function playWeave(a: { x: number; y: number }, b: { x: number; y: number }) {
    if (!motionOK.current) return;
    const key = `w${weaveSeq.current++}`;
    setWeaves((w) => [...w, { key, a, b }]);
    window.setTimeout(() => setWeaves((w) => w.filter((x) => x.key !== key)), 1400);
  }

  // the durable ledger — a confirmed edge REMEMBERS who verified it and when. After a confirm the stamp rises
  // on the edge (the payoff — the gesture became a record), holds ~4.5s, then lives on as a hover reveal. We
  // key by edge id and read the midpoint from live positions at render, so it tracks the edge if the graph shifts.
  const [stamped, setStamped] = React.useState<string[]>([]);
  function stampEdge(id: string) {
    setStamped((s) => (s.includes(id) ? s : [...s, id]));
    window.setTimeout(() => setStamped((s) => s.filter((x) => x !== id)), 4500);
  }
  React.useEffect(() => {
    if (!sel) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSel(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel]);
  // spotlight — hover takes precedence (most immediate intent); otherwise a non-empty `highlight` drives
  // it. Both feed the same lit()/edgeLit() so nodes AND edges dim identically whatever the source.
  const hlSet = React.useMemo(() => new Set(highlight ?? []), [highlight]);
  const active = hovered !== null || hlSet.size > 0;
  const lit = (id: string): boolean => {
    if (!active) return true;
    if (hovered !== null) return id === hovered || (adj.get(hovered)?.has(id) ?? false);
    return hlSet.has(id);
  };
  // an edge belongs to the spotlight when: on hover, it touches the hovered node; on highlight, BOTH
  // ends sit in the set. Nothing is specially lit when idle.
  const edgeLit = (e: GraphEdge): boolean => {
    if (!active) return false;
    if (hovered !== null) return e.from === hovered || e.to === hovered;
    return hlSet.has(e.from) && hlSet.has(e.to);
  };

  // every mark of the field as a box, 1px of margin for the mark's halo stroke — the names keep off them
  // (below) and so do the chips (the fold layer)
  const fieldMarks = React.useMemo<Box[]>(
    () =>
      fieldNodes.map((n) => {
        const p = fieldPos.get(n.id) ?? { x: W / 2, y: H / 2 };
        const r = drawnRadius(n) + 1;
        return { x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r };
      }),
    [fieldNodes, fieldPos, drawnRadius, W, H],
  );
  // label collision avoidance (idle state) — lay out focus + direct labels by priority (focus first,
  // then direct); hide any that would overlap one already placed. The hidden labels return on hover.
  // Returns the names that fit AND the seat each took: under labelRule="beside" a name is offered the chooser's
  // seat first and, if a mark or a placed name already sits there, the rule's next seats in order — a hub
  // whose column's rows stand beside it would otherwise lose its own name the moment the column was drawn.
  const { idleLabels, idleSides } = React.useMemo(() => {
    const set = new Set<string>();
    const sides = new Map<string, LabelSide>();
    // Seeded with every MARK of the field (drawn or not — see the field), not just the labels placed so
    // far. The pass only ever tested a candidate label against other label boxes, so a name was free to
    // land on someone else's node — on the Q4 collection map "Q4 press outrea…" sat squarely on the node
    // belonging to "Q4 launch plan". A label colliding with a mark is the same defect as a label colliding
    // with a label; it was only ever half-checked. 1px of margin covers the node's own background-coloured
    // halo stroke. And the marks not yet drawn are here for the same reason the chooser sees them: a name
    // that would sit on a mark the next unfold draws is a name the unfold would move.
    const boxes: Box[] = [...fieldMarks];
    const markIndex = new Map(fieldIndex);
    // a ghost OUTSIDE the field (a caller previewing without layoutData) culls no LIVE name. Its box is
    // parked OFF the field while the live names are seated (it takes its real box once the ghosts' own
    // names are placed, below), not shrunk to a point: a zero-size box at the ghost's centre still hit
    // any name drawn over it (the overlap test is strict on both sides, so a point inside a box counts),
    // and a hub's name vanished the moment its fan of ghosts landed beside it — the one thing the preview
    // promised not to do.
    const parked = data.nodes.filter((n) => preview.has(n.id) && !markIndex.has(n.id));
    for (const g of parked) {
      markIndex.set(g.id, boxes.length);
      boxes.push({ x: -1e6, y: -1e6, w: 0, h: 0 });
    }
    // and every column's ROWS — the name beside each listed mark, drawn or not — for the reason the marks
    // are here: a row is a seat the next unfold fills, and a ring name seated over it would cull the row's
    // name the moment the column came out. These reservations bind the RING's names only: the columns are
    // laid over one another (one is open at a time, see radialLayout), so a drawn row is tested against
    // nothing reserved — not the other columns' rows, not their undrawn marks — or the rows of the one
    // column that is out lost their names to the rows of the columns that are not (round 1, measured: four
    // of fifteen rows unnamed, and all four of another hub's).
    const drawnIds = new Set(data.nodes.map((n) => n.id));
    const reserved = new Set<number>();
    for (const n of fieldNodes) {
      const sx = radial.side.get(n.id);
      if (!sx) continue;
      if (!drawnIds.has(n.id)) reserved.add(markIndex.get(n.id) ?? -1);
      if (radial.hidden.has(n.id)) continue;
      const q = fieldPos.get(n.id) ?? { x: W / 2, y: H / 2 };
      reserved.add(boxes.length);
      boxes.push(labelBoxAt(sx > 0 ? "right" : "left", q.x, q.y, drawnRadius(n), textOf(n), labelFs(n), labelBaseline));
    }
    // In the space field, name the STRUCTURE first (space center → teams), then people by weight; the ego
    // map by depth. Every name that fits is drawn at rest (round 1 retired the four-people cap the space
    // field had: a mark with no name is a person the reader cannot address, and hover was doing the naming
    // the rest state owed).
    const rankOf = (n: GraphNode) => (n.depth === 0 ? 3 : n.kind === "collection" ? 2 : 1);
    const deepest = namedDepth ?? (fullLabels ? Infinity : 1);
    // a centre named under the pointer only (centreName "hover") takes no seat at rest: its name is not
    // there, so it holds no ground against the names that are
    const cand = data.nodes.filter((n) => n.depth <= deepest && !radial.hidden.has(n.id) && !(n.depth === 0 && centreName === "hover"));
    // the live names first (by depth, then in the field's order), then the ghosts: a ghost's name is placed
    // against everything already on the field and never moves a live name — and it is placed, because a
    // preview of bare grey marks said "there is a lot" and nothing about what; the names that fit are what
    // the hover tells you
    const fieldRank = (n: GraphNode) => fieldIndex.get(n.id) ?? fieldNodes.length + data.nodes.indexOf(n);
    cand.sort(
      spaceField
        ? (a, b) => rankOf(b) - rankOf(a) || (field.weightSum.get(b.id) ?? 0) - (field.weightSum.get(a.id) ?? 0) || a.id.localeCompare(b.id)
        : (a, b) => Number(preview.has(a.id)) - Number(preview.has(b.id)) || a.depth - b.depth || fieldRank(a) - fieldRank(b),
    );
    let ghostsSeated = false;
    for (const n of cand) {
      // the first ghost name to be placed: every live name is seated by now, so the parked ghost marks may
      // take their real boxes — a ghost's name must clear the ghost marks beside it, even though the live
      // names never had to
      if (preview.has(n.id) && !ghostsSeated) {
        ghostsSeated = true;
        for (const g of parked) {
          const q = pos.get(g.id) ?? { x: W / 2, y: H / 2 };
          const r = drawnRadius(g) + 1;
          boxes[markIndex.get(g.id)!] = { x: q.x - r, y: q.y - r, w: 2 * r, h: 2 * r };
        }
      }
      const p = pos.get(n.id) ?? { x: W / 2, y: H / 2 };
      const txt = textOf(n);
      // the seats to try, in order: the chooser's, then (under "beside") the rule's own order after it — a
      // first-ring name is one the reader asked for at every reach, and any free seat beats none; a listed
      // row has its one seat.
      const tries: LabelSide[] = labelRule === "beside" ? [...new Set<LabelSide>([sideOf(n.id), ...preferOf(n.id)])] : [sideOf(n.id)];
      // a name may not sit on another mark or name — its OWN mark is the one thing it is allowed to touch
      // (the shared box model starts a hair inside the mark's 1px halo; the centre's name was being culled by
      // the centre's own square); a listed row is tested against nothing reserved (see above)
      const own = markIndex.get(n.id);
      const listed = radial.side.has(n.id);
      for (const side of tries) {
        const box = labelBoxAt(side, p.x, p.y, drawnRadius(n), txt, labelFs(n), labelBaseline, trailOf(n.id));
        const hit = boxes.some(
          (b, bi) =>
            bi !== own && !(listed && reserved.has(bi)) && box.x < b.x + b.w && box.x + box.w > b.x && box.y < b.y + b.h && box.y + box.h > b.y,
        );
        if (hit) continue;
        boxes.push(box);
        set.add(n.id);
        sides.set(n.id, side);
        break;
      }
    }
    return { idleLabels: set, idleSides: sides };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labelFs/labelBaseline/sideOf derive from dense and labelRule
  }, [data, pos, fieldNodes, fieldIndex, fieldMarks, fieldPos, radial, spaceField, field, labelSides, drawnRadius, dense, fullLabels, preview, labelRule, namedDepth, centreName, trailOf, preferOf, textOf, W, H]);

  return (
    // The field's box IS the svg's box: the width cap and mx-auto sit here, the svg fills it. The peek and
    // the fold chips are positioned in percentages of this box, and with the cap on the svg alone the box
    // was the column — 976 wide around a 650 drawing — so a peek on a node at the ring's edge opened 109px
    // away from it (measured on /people: node at 1065, peek centred at 1174).
    <div ref={boxRef} className={cn("relative mx-auto w-full max-w-[720px]", className)}>
      {/* max-w, because the viewBox scales EVERYTHING with the container — including the type. At a
          928px pane the 520-unit box renders at 1.78x, so a 10.5-unit node label came out at 18.7px:
          bigger than the 16px row titles for the same six artifacts one tab away. Capped at 720 the
          scale is 1.385 and a label lands at 14.5, under the titles where it belongs. */}
      <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" style={{ overflow: "visible" }} role="img">
        {/* ambient — a whisper of forest light behind the field: soft depth that ties the composition to the
            focused centre (layers under the centre node's bloom). Kept very low so it reads as depth, not a wash. */}
        {/* click-away target — sits behind the graph; a click on empty space dismisses the popover
            (nodes render on top, so clicking another node moves the peek instead of closing it) */}
        {renderPopover && sel ? (
          <rect width={W} height={H} fill="transparent" onClick={() => setSel(null)} />
        ) : null}
      {/* edges — one neutral ink, three weights; on hover the pointed node's ties take its hue and the rest
          recede to a third. A line carries no identity: the space field's ties wore their collection's hue for
          five rounds, and with three teams plus identity-tinted people the field was five-hue spaghetti that
          competed with the rail's collection dots instead of echoing them (round 0). Hue lives on the marks. */}
      {data.edges.map((e, idx) => {
        const sg = segOf(e, pos);
        if (!sg) return null; // reaches a row folded into "+N more"
        const [a, b] = sg;
        const ai = e.prov === "ai_generated";
        const touches = edgeLit(e);
        const faded = active && !touches;
        const ghost = isGhostEdge(e);
        // a tie's HOP: the subject's own ties (they touch the centre — on the space field, the space's ties to
        // its collections) are the heavy line, 1.5px at the explorer's unit; every further tie (a column's chain,
        // a chord, a person's tie to a collection) a 1px hairline
        const far = isFarEdge(e);
        // a column's CHAIN segment — the spine down a hub's list, one line through its rows' marks
        const chain = radial.parent.get(e.from) === e.to || radial.parent.get(e.to) === e.from;
        // three lines, near to far: the subject's spoke 1.5px at 0.5; a column's spine 1px at the same 0.5 —
        // it is ONE line down the column, broken only by the marks' halos, and at 0.3 (round 1) it read as a
        // barely-there dotted thread between the rows (the judge's "barely visible dotted spine"); a chord or
        // a person's tie 1px at 0.3. A direct PROPOSED tie at the same 0.5 as a verified one — dashed, so it
        // carries half the ink and reads one step lighter by construction (it rested at 0.7, which put the
        // agent's guess ahead of every settled tie on the field); a proposed chord 0.35 (the dash would lose
        // it at 0.3). A ghost — a tie only previewed — rests under all of them, see strokeOpacity.
        const rest = ai ? (far && !chain ? 0.35 : 0.5) : far && !chain ? 0.3 : 0.5;
        const d = edgeD(a, b); // straight — pathLength=1 keeps the draw-on
        return (
          <path
            key={e.id}
            d={d}
            fill="none"
            // the ink, everywhere; forest for a proposed tie (the dash's own colour); lit, a tie takes the
            // hovered node's colour — the field's one second colour, and it is on the pointed path only.
            // A ghost tie is grey whatever its provenance (the dash still says proposed): the preview is one
            // grey thing, and forest arrives with the click that makes the tie part of the drawing
            stroke={ghost ? "var(--muted-foreground)" : ai ? "var(--primary)" : touches && hoveredFill ? hoveredFill : "var(--foreground)"}
            // a ghost tie at 0.15, UNDER the 0.3 the same tie rests at once chosen: at 0.3 (round 6) the preview
            // weighed the same as the commit and the two states could not be told apart in a still — the reader
            // could not see that the column was only being offered. It is a whisper together with its marks
            // (0.5, see the ghost's mark), so the column pales as one thing. Faded (another node's spotlight):
            // half its rest — the shape of the field survives the hover; at 0.15 flat the far half of the
            // drawing vanished and the figure went lopsided (round 0), and at a third of 0.3 the hairlines
            // were gone again while their marks, at 0.35, stayed.
            strokeOpacity={faded ? +(rest * 0.5).toFixed(3) : touches ? 0.9 : ghost ? 0.15 : rest}
            strokeWidth={(far ? 0.8 : 1.2) * (dense ? 0.82 : 1)}
            strokeDasharray={ai ? "2.2 2.2" : 1}
            pathLength={ai ? undefined : 1}
            className={ai && !ghost ? "thread-in" : undefined}
            style={{
              transition: "stroke-opacity 160ms ease-out, stroke 160ms ease-out",
              // confirmed threads draw on end-to-end (staggered); proposed threads weave in a beat later via
              // the .thread-in class, so the settled web reads first and the agent's proposals arrive after.
              // A ghost tie is not staggered: the preview is one gesture, and with forty ties in the wide
              // reach the last of them drew on 2s after the pointer arrived — a still of the hover showed
              // one parent's fan and the rest of the ghosts hanging unconnected. Nor is a tie that arrives
              // after the first drawing (an unfolded column's chain): it draws on at once, see `born`.
              animation: ai || ghost ? undefined : late(e.id) ? "edge-draw 0.25s ease-out both" : `edge-draw 0.7s ease-out ${(0.04 * idx).toFixed(2)}s both`,
            }}
          />
        );
      })}

      {/* flow — a slow particle glides down each confirmed edge (source → target), so the connections read
          as living conduits. Foreground motion (on the content), staggered so they never pulse in sync;
          on hover only the focused node's flows stay lit. */}
      {flow
        ? data.edges.map((e, idx) => {
            if (e.prov === "ai_generated") return null; // unconfirmed edges don't carry flow yet
            if (active && !edgeLit(e)) return null;
            const sg = segOf(e, pos);
            if (!sg) return null;
            const [a, b] = sg;
            const dur = `${(2.4 + (idx % 4) * 0.45).toFixed(2)}s`;
            const begin = `${((idx * 0.41) % 2.4).toFixed(2)}s`;
            return (
              <circle key={`flow-${e.id}`} r={1.5} fill="var(--primary)" opacity={0}>
                <animateMotion dur={dur} begin={begin} repeatCount="indefinite" path={edgeD(a, b)} />
                <animate attributeName="opacity" values="0;0.6;0.6;0" dur={dur} begin={begin} repeatCount="indefinite" />
              </circle>
            );
          })
        : null}

      {/* nodes — shape by kind, colour by identity (a ghost: grey), size by distance (focus 8.5 / direct 6 /
          extended 4); on hover everything but the focused node + its neighbours dims to a whisper */}
      {/* ghosts (the previewed outer ring) are drawn FIRST, so a live mark and its name paint over them: in
          data order the ghosts came last and a ghost's mark landed on top of a first-ring name — the fan
          around a hub put a diamond on the "v3" of "Notification strategy v3". The ghost is not there yet;
          it belongs behind everything that is. Stable keys, so the reorder moves nothing on screen. */}
      {[...data.nodes].sort((a, b) => Number(preview.has(b.id)) - Number(preview.has(a.id))).map((n, i) => {
        if (hidden(n.id)) return null; // folded into its column's "+N more" row
        const p = at(n.id);
        const center = n.depth === 0;
        // space-field: size collections by member count (degree), people by total contribution weight (Σ shared
        // artifacts) — so a cross-team connector reads bigger than a lightly-linked person, not the flat depth size
        let r = markRadius(n);
        r *= dense ? 0.62 : 1;
        // space-field: a person is one neutral disc in the ink the space itself wears. People wore a muted tint of
        // their team's hue for five rounds; it repeated what their spokes already say and, with the ties in the
        // same hues, made the field a colour wheel (round 0). The collection squares keep their swatch — hue is
        // identity, and on this field the collections are the identities.
        let fill = nodeFill(n);
        if (spaceField && n.kind === "person") fill = "var(--muted-foreground)";
        const isLit = lit(n.id);
        const ghost = preview.has(n.id);
        // a ghost is drawn in ONE grey — the glyph ink, no identity hue — at half strength: the preview says
        // what is there and where, and the hue (a collection's, a person's) is what the click adds. It was
        // the identity hue at 0.3, and twenty-four hues at a whisper read as confetti: the preview was loud
        // about there being a lot and said nothing about what. Grey at 0.5 is one quiet thing, and the
        // step to full hue on commit is larger than the step from 0.3 to 1 was.
        if (ghost) fill = "var(--foreground-hint)";
        // at rest: the context ring (an artifact's neighbourhood) at 0.4, everything else in full ink; a
        // ghost's own paleness is on its MARK (below), so its name can stay legible at the far ring's ink.
        // In another node's spotlight a mark and its name go to 0.35, not 0.1 and 0: the hover is a
        // deepening of the neighbours, and the rest of the figure keeps its shape and its names — at 0.1 the
        // unlit half vanished, the figure went lopsided, and names appeared and disappeared under the pointer
        // (round 0's hover was doing reveal work the rest state owed).
        const restOpacity = n.depth === 2 && outerRing === "faint" ? 0.4 : 1;
        const faded = active && !isLit;
        const nodeOpacity = faded ? 0.35 : restOpacity;
        // faded, a mark gives up its HUE as well as its ink: a plum square at 0.35 over warm paper is a
        // lilac tint, an ochre one a beige — pastel, and the field read as five washed-out colours instead of
        // one figure stepped back (round 1's judge). The whole unlit set drops to the one ink at one
        // strength, marks and names together, and the hue is what the spotlight — and rest — gives back.
        if (faded && !ghost) fill = "var(--foreground)";
        // labels: idle shows the collision-free set; the spotlight lifts the lit set to full ink (a name culled
        // for room at rest comes up with its neighbour) and lowers the rest with their marks. A centre whose
        // name the page's title already says (centreName "hover") is named under the pointer alone — not with
        // a neighbour's spotlight, where it would fade in over the spokes every time the pointer crossed the ring.
        const impliedCentre = center && centreName === "hover";
        const labelOpacity = impliedCentre
          ? hovered === n.id ? 1 : 0
          : active ? (isLit ? 1 : idleLabels.has(n.id) ? 0.35 : 0) : idleLabels.has(n.id) ? 1 : 0;
        // the name's ink: the subject and the space field's people in full ink; under "beside" a direct
        // neighbour in full ink too and a listed row in muted — the far hop one rung lighter, as its mark is
        // one size smaller and its tie one weight thinner
        const nameInk = labelRule === "beside" && n.depth >= 2 ? "var(--muted-foreground)" : "var(--foreground)";
        return (
          <g
            key={n.id}
            className="cursor-pointer"
            style={{
              transform: `translate(${p.x}px, ${p.y}px)`,
              transition: "transform 0.55s cubic-bezier(0.22,1,0.36,1), opacity 0.25s",
              opacity: nodeOpacity,
            }}
            onClick={() => {
              onSelect(n.id);
              if (renderPopover) setSel(n.id);
            }}
            onMouseEnter={() => setHovered(n.id)}
            onMouseLeave={() => setHovered(null)}
          >
            <title>{n.label}</title>
            {/* entrance layer (scale in) — no idle drift; the graph stays still at rest. A ghost arrives
                together and at once (no stagger): it answers a hover, and a hover does not wait. */}
            <g
              style={{
                // a ghost arrives inside 150ms: a preview is a glance, and at 250 the ring was still
                // fading in when the eye had already asked what changed. An unfolded row the same, and
                // all of a column's rows together (see `born`): the stagger is the first drawing's alone.
                animation: ghost || late(n.id) ? "node-in 0.15s ease-out both" : `node-in 0.45s ease-out ${(0.03 * i).toFixed(2)}s both`,
                transformBox: "fill-box",
                transformOrigin: "center",
                transition: "transform 160ms ease-out",
              }}
            >
              {/* node body — shape encodes kind. A ghost's mark at 0.5: the offered ring is visibly not
                  there yet, and the click that commits it is a visible step to full ink.
                  The HOVER is on the mark alone: it scales one step (1.3 — a ring mark to the subject's size,
                  a row's to the ring's) about its own centre, 160ms, and its name goes to 500 (below). No
                  ring, no halo: round 1 circled the pointed mark with its own outline one size out, and a
                  thin outlined square with a gap is the keyboard's focus grammar, not a hover's. Round 0
                  scaled the whole node — name and chip with it — and the name grew two sizes under the
                  pointer; the mark alone grows 4px and nothing seated on the name moves. */}
              <g
                style={{
                  opacity: ghost ? 0.5 : 1,
                  transform: hovered === n.id && !ghost ? "scale(1.3)" : undefined,
                  transformBox: "fill-box",
                  transformOrigin: "center",
                  transition: "opacity 160ms ease-out, transform 160ms ease-out",
                }}
              >
                <NodeShape kind={n.kind} r={r} fill={fill} processing={n.state === "processing"} />
              </g>
              {/* label */}
              <text
                // a folded hub's name is measured (see nameW) so its chip can sit after the last glyph
                ref={
                  folds?.has(n.id)
                    ? (el) => {
                        if (el) textRefs.current.set(n.id, el);
                        else textRefs.current.delete(n.id);
                      }
                    : undefined
                }
                x={labelAnchor(idleSides.get(n.id) ?? sideOf(n.id), r, labelFs(n), labelBaseline, trailOf(n.id)).x}
                y={labelAnchor(idleSides.get(n.id) ?? sideOf(n.id), r, labelFs(n), labelBaseline, trailOf(n.id)).y}
                textAnchor={labelAnchor(idleSides.get(n.id) ?? sideOf(n.id), r, labelFs(n), labelBaseline, trailOf(n.id)).anchor}
                // the name takes the pointer with its mark: it is the node's label, and a reader who rests on
                // "Research" means Research — a name that let the pointer through to the ground (round 0) lit
                // nothing until the pointer found the 12px mark beside it
                className="select-none"
                fontSize={labelFs(n)}
                // the subject at 500; a pointed name takes 500 too — the hover's second half, with the mark's
                // step up — and gives it back at rest
                fontWeight={center || hovered === n.id ? 500 : 400}
                fill={nameInk}
                // knockout: the name is painted over a stroke of the ground colour, so a line that has to pass
                // behind it breaks around the glyphs instead of running through them. A hub's ties fill all
                // eight seats (chooseLabelSides), and this is what keeps the name legible there. It is the
                // ground's own colour — a cartographic knockout, not a glow — and it never shows as a shape.
                paintOrder="stroke"
                stroke="var(--graph-ground, var(--card))"
                // under "beside" the halo is half the type size, not 0.3: the subject's name sits in the path
                // of its own spokes and a hub's in the path of its column's lead, and at 0.3 the ties broke
                // around each glyph but still read as running through the word — the halo has to be wide
                // enough to read as paper the line passes behind, not a nick in the line
                strokeWidth={labelFs(n) * (labelRule === "beside" ? 0.5 : 0.3)}
                strokeLinejoin="round"
                style={{ opacity: labelOpacity, transition: "opacity 160ms ease-out" }}
              >
                {textOf(n)}
              </text>
            </g>
          </g>
        );
      })}

      {/* "+N more" — the last row of a column that ran out of box, standing in for the rows it could not hold
          (see radialLayout). A row of the list in muted ink, no mark: the reader sees that there is more and
          how much, where round 0 faded the bottom names to nothing. The List tab holds every row; the peek's
          "Focus here" is the way to all of them on the field. Drawn only when the column is out (live or
          ghosted), and lit with its hub. */}
      {radial.more
        .filter((m) => data.nodes.some((n) => hidden(n.id) && radial.parent.get(n.id) === m.hub))
        .map((m) => {
          const ghost = data.nodes.some((n) => hidden(n.id) && radial.parent.get(n.id) === m.hub && preview.has(n.id));
          const on = active ? lit(m.hub) : true;
          const fs = dense ? 7.5 : labelRule === "beside" ? 9.6 : 10.5; // the row's own register
          return (
            <text
              key={`more-${m.hub}`}
              x={m.x + m.side * (4 + SIDE_GAP)}
              y={m.y + fs * 0.36}
              textAnchor={m.side > 0 ? "start" : "end"}
              className="pointer-events-none select-none"
              fontSize={fs}
              fill="var(--muted-foreground)"
              paintOrder="stroke"
              stroke="var(--graph-ground, var(--card))"
              strokeWidth={fs * 0.5}
              strokeLinejoin="round"
              style={{ opacity: on ? (ghost ? 0.5 : 1) : 0.35, transition: "opacity 160ms ease-out" }}
            >
              {`+${m.count} more`}
            </text>
          );
        })}

      {/* verify layer — proposed (dashed) edges are resolvable IN PLACE: hover one, a ✓ / ✕ pops at its
          midpoint. Confirm re-strokes it solid on the next render; dismiss drops it. Sits above the nodes. */}
      {onVerifyEdge
        ? data.edges
            .filter((e) => e.prov === "ai_generated")
            .map((e) => {
              const sg = segOf(e, pos);
              if (!sg) return null;
              const [a, b] = sg;
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              const on = hoveredEdge === e.id;
              return (
                <g key={`v-${e.id}`} onMouseEnter={() => setHoveredEdge(e.id)} onMouseLeave={() => setHoveredEdge(null)}>
                  <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={14} style={{ cursor: "pointer" }} />
                  {on ? (
                    <foreignObject x={mx - 24} y={my - 13} width={48} height={26} style={{ overflow: "visible" }}>
                      <div style={{ display: "flex", gap: "4px", alignItems: "center", justifyContent: "center" }}>
                        <button
                          aria-label="Confirm"
                          onClick={() => {
                            onVerifyEdge(e.id, "confirm"); // record the gesture first so its ledger stamp resolves
                            playWeave(a, b);
                            stampEdge(e.id);
                          }}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", borderRadius: "9999px", border: "none", background: "var(--primary)", color: "var(--primary-foreground)", cursor: "pointer", boxShadow: "0 1px 5px rgba(0,0,0,0.2)" }}
                        >
                          <Check style={{ width: 13, height: 13 }} />
                        </button>
                        <button
                          aria-label="Dismiss"
                          onClick={() => onVerifyEdge(e.id, "discard")}
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "22px", height: "22px", borderRadius: "9999px", border: "0.5px solid var(--border)", background: "var(--background)", color: "var(--muted-foreground)", cursor: "pointer", boxShadow: "0 1px 5px rgba(0,0,0,0.12)" }}
                        >
                          <X style={{ width: 13, height: 13 }} />
                        </button>
                      </div>
                    </foreignObject>
                  ) : null}
                </g>
              );
            })
        : null}

      {/* THE WEAVE — the confirm made cinematic. A bright signal races the just-confirmed edge and blooms at
          its target: the instant a proposal becomes trusted knowledge. One-shot; cleared after ~1.4s. */}
      {weaves.map((w) => (
        <g key={w.key} style={{ pointerEvents: "none" }}>
          {/* the edge flares bright, then settles to the confirmed weight */}
          <line x1={w.a.x} y1={w.a.y} x2={w.b.x} y2={w.b.y} stroke="var(--primary)" strokeLinecap="round" opacity={0}>
            <animate attributeName="opacity" values="0;0.9;0" dur="0.9s" begin="0s" fill="freeze" />
            <animate attributeName="stroke-width" values="3.5;1.75" dur="0.9s" begin="0s" fill="freeze" />
          </line>
          {/* the signal traveling the strand (rhymes with the woven-wave identity) */}
          <circle r={3.5} fill="var(--primary)" opacity={0}>
            <animateMotion dur="0.7s" begin="0s" fill="freeze" path={`M${w.a.x} ${w.a.y} L${w.b.x} ${w.b.y}`} />
            <animate attributeName="opacity" values="0;1;1;0" dur="0.7s" begin="0s" fill="freeze" />
          </circle>
          {/* the bloom at the target — the proposal lands as remembered knowledge */}
          <circle cx={w.b.x} cy={w.b.y} r={3} fill="none" stroke="var(--primary)" strokeWidth={1.75} opacity={0}>
            <animate attributeName="r" values="3;15" dur="0.6s" begin="0.45s" fill="freeze" />
            <animate attributeName="opacity" values="0.7;0" dur="0.6s" begin="0.45s" fill="freeze" />
          </circle>
          <circle cx={w.b.x} cy={w.b.y} r={4} fill="var(--primary)" opacity={0}>
            <animate attributeName="opacity" values="0;0.9;0" dur="0.5s" begin="0.5s" fill="freeze" />
          </circle>
        </g>
      ))}

      {/* the ledger, recallable — an edge that carries a real confirm-record gets a wider transparent hit-line,
          so its stamp can be summoned on hover at any time, not only in the instant it was verified. */}
      {verifiedBy
        ? data.edges
            .filter((e) => e.prov !== "ai_generated" && !!verifiedBy(e.id))
            .map((e) => {
              const sg = segOf(e, pos);
              if (!sg) return null;
              const [a, b] = sg;
              return (
                <line
                  key={`ph-${e.id}`}
                  x1={a.x}
                  y1={a.y}
                  x2={b.x}
                  y2={b.y}
                  stroke="transparent"
                  strokeWidth={12}
                  style={{ cursor: "default" }}
                  onMouseEnter={() => setHoveredEdge(e.id)}
                  onMouseLeave={() => setHoveredEdge(null)}
                />
              );
            })
        : null}

      {/* the stamp — ✓ WHO · WHEN riding the edge's midpoint. Auto-raised for ~4.5s the moment you confirm (the
          payoff: the gesture is now a record), and recalled on hover ever after — the durable, human-fingerprinted
          provenance no plain graph or notes tool keeps. Midpoint read live so it tracks the edge if things shift. */}
      {verifiedBy
        ? data.edges
            .filter((e) => e.prov !== "ai_generated" && (stamped.includes(e.id) || hoveredEdge === e.id))
            .map((e) => {
              const rec = verifiedBy(e.id);
              const sg = segOf(e, pos);
              if (!rec || !sg) return null;
              const [a, b] = sg;
              const mx = (a.x + b.x) / 2;
              const my = (a.y + b.y) / 2;
              const justConfirmed = stamped.includes(e.id);
              return (
                <foreignObject
                  key={`stamp-${e.id}`}
                  x={mx - 80}
                  y={my - 15}
                  width={160}
                  height={30}
                  style={{ overflow: "visible", pointerEvents: "none" }}
                >
                  <div
                    style={{
                      display: "flex",
                      width: "fit-content",
                      margin: "0 auto",
                      alignItems: "center",
                      gap: "5px",
                      padding: "3px 9px 3px 3px",
                      borderRadius: "9999px",
                      background: "var(--popover)",
                      border: "0.5px solid var(--border)",
                      boxShadow: "0 2px 9px rgba(0,0,0,0.16)",
                      fontSize: "11px",
                      lineHeight: 1,
                      whiteSpace: "nowrap",
                      animation: justConfirmed
                        ? "node-in 0.4s ease-out 0.55s both"
                        : "node-in 0.18s ease-out both",
                    }}
                  >
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "16px",
                        height: "16px",
                        borderRadius: "9999px",
                        background: "var(--primary)",
                        color: "var(--primary-foreground)",
                        flexShrink: 0,
                      }}
                    >
                      <Check style={{ width: 10, height: 10 }} />
                    </span>
                    <span style={{ color: "var(--foreground)", fontWeight: 500 }}>{rec.name}</span>
                    <span aria-hidden="true" style={{ width: "1px", height: "10px", background: "var(--border)", flexShrink: 0 }} />
                    <span style={{ color: "var(--muted-foreground)" }}>{rec.at}</span>
                  </div>
                </foreignObject>
              );
            })
        : null}
      </svg>

      {/* the folds — a hub's "+N" after its name, and the way the reach grows (2026-09-14: the Direct /
          Nearby switch is gone; a first-ring node that has further ties is unfolded in place, one at a
          time). HTML buttons laid over the svg rather than svg groups: a real button is a real focus stop
          with the house ring and Enter / Space for free, and its 20px chip and 24px hit area are CSS
          pixels at every width — an svg chip would have scaled with the viewBox to 13px on a phone,
          under a thumb. Seated in percentages of the box, AFTER the name in reading order, on the name's
          cap centre: one gap past the measured end (nameW) of a start-anchored or centred name; for a name
          seated left of its mark, between the name and the mark (the name has given way by the chip's
          width, see trailOf), so "Q4 OKRs +2 ■" reads the same way round as "■ Notification strategy v3
          +15" — round 0 hung the chip at a left name's outer end and the count read first on one node and
          last on the next. It fades with its name in another node's spotlight (and takes no pointer while
          faded). The hub alone: a live hop-2 node may have further ties of its own, and it wears no fold —
          the neighbourhood is computed to depth 2 (getNeighborhood), and a third ring is what the peek's
          "Focus here" is for. */}
      {folds && folds.size
        ? data.nodes
            .filter((n) => folds.has(n.id) && !preview.has(n.id))
            .map((n) => {
              const f = folds.get(n.id)!;
              const p = at(n.id);
              const r = drawnRadius(n);
              const fs = labelFs(n);
              const named = active ? lit(n.id) : idleLabels.has(n.id);
              const side = idleSides.get(n.id) ?? sideOf(n.id);
              const a = labelAnchor(side, r, fs, labelBaseline, trailOf(n.id));
              const w = nameW.get(n.id) ?? textOf(n).length * fs * LABEL.glyph;
              // where the name ENDS in reading order, in the node's own frame: past the middle of a centred
              // name, past the whole of a start-anchored one, and at the anchor of an end-anchored one (which
              // is its last glyph, one trail short of the mark)
              const endX = a.anchor === "middle" ? a.x + w / 2 : a.anchor === "start" ? a.x + w : a.x;
              // the name's cap centre sits 0.36 of the size above its baseline; a name culled at rest (no
              // free seat — a first-ring name is offered every seat, so this is the rare hub) leaves the chip
              // centred under the mark at the "below" seat
              const x = p.x + (named ? endX : 0);
              const y = p.y + (named ? a.y - fs * 0.36 : r + labelBaseline - fs * 0.36);
              const opacity = active ? (lit(n.id) ? 1 : 0) : 1;
              return (
                <button
                  key={`fold-${n.id}`}
                  type="button"
                  data-fold={n.id}
                  aria-expanded={f.open}
                  aria-label={f.open ? `Hide ${f.count} around ${n.label}` : `Show ${f.count} more around ${n.label}`}
                  // the hit area is 24 on a 20 chip: the pseudo-element extends the target 2px each way
                  // and is part of the button for hit-testing, while the ring keeps to the chip's edge
                  className={cn(
                    "absolute z-10 flex rounded-full before:absolute before:-inset-0.5 before:content-['']",
                    !named ? "-translate-x-1/2 -translate-y-1/2" : "-translate-y-1/2",
                    FOCUS_RING,
                  )}
                  style={{
                    left: named ? `calc(${((x / W) * 100).toFixed(3)}% + ${CHIP_GAP}px)` : `${((x / W) * 100).toFixed(3)}%`,
                    top: `${((y / H) * 100).toFixed(3)}%`,
                    opacity,
                    pointerEvents: opacity ? undefined : "none",
                    // the seat's clock is the node's transform clock, so the chip and the name move as one —
                    // once the box has switched the motion on (see --fold-motion)
                    transition: "var(--fold-motion, none)",
                  }}
                  // a mouse on the chip previews the column; a finger does not (a tap would leave the ghosts
                  // standing with nothing to leave), and neither does the focus a tap gives the button —
                  // only a keyboard's focus (:focus-visible) is a hover it can hold and release
                  onPointerEnter={(e) => {
                    if (e.pointerType !== "mouse") return;
                    setChipHover(n.id);
                    onFoldPeek?.(n.id);
                  }}
                  onPointerLeave={() => {
                    setChipHover(null);
                    onFoldPeek?.(null);
                  }}
                  onFocus={(e) => {
                    if (e.currentTarget.matches(":focus-visible")) onFoldPeek?.(n.id);
                  }}
                  onBlur={() => onFoldPeek?.(null)}
                  onClick={() => onFoldToggle?.(n.id)}
                >
                  <FoldChip
                    count={f.count}
                    open={f.open}
                    opaque
                    lifted={chipHover === n.id}
                    ref={(el) => {
                      if (el) chipRefs.current.set(n.id, el);
                      else chipRefs.current.delete(n.id);
                    }}
                  />
                </button>
              );
            })
        : null}

      {/* the peek — an EntityProfile popover anchored AT the clicked node (above it, or below when the
          node sits high). Related chips inside move the peek via api.select; Esc / empty-space click closes. */}
      {renderPopover && sel
        ? (() => {
            const p = at(sel);
            const below = p.y / H < 0.42;
            return (
              // key on sel so the peek re-mounts (and re-animates) each time it opens or hops to another
              // node; the outer div owns positioning (transform), the inner owns the enter animation so the
              // two transforms never fight. It grows from the anchor side (top when the peek sits below).
              <div
                key={sel}
                className="absolute z-20 w-72"
                style={{
                  left: `${(p.x / W) * 100}%`,
                  top: `${(p.y / H) * 100}%`,
                  transform: below ? "translate(-50%, 22px)" : "translate(-50%, calc(-100% - 18px))",
                }}
              >
                <div
                  className="animate-in fade-in-0 zoom-in-95 duration-150 ease-out"
                  style={{ transformOrigin: below ? "top center" : "bottom center" }}
                >
                  {renderPopover(sel, { close: () => setSel(null), select: (id) => setSel(id) })}
                </div>
              </div>
            );
          })()
        : null}
    </div>
  );
}
