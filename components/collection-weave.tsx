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
// hovered. At rest, up to three lanes; on hover, the truth.
//
// Every piece is derived from the row's INDEX in the trunk (first / through / last) and drawn inside
// that row's own 40px cell, so a reorder reflows and nothing is measured. A row inside a trunk's span
// that the trunk does not tick draws the lane passing straight through it — no tick, no node — the
// way tree(1)'s │ runs past a line that is not a child. The bracket was first made to BREAK around
// such a row; after a reorder that drew the far member as an orphan └■ tied to nothing (three blind
// judges, 2026-09-14). One line, the whole span; the ticks say which rows it claims.

export type WeaveEdge = {
  id: string;
  from: string;
  to: string;
  // whether a human has confirmed this tie. The rail drew every tie solid, so an agent's proposal and
  // a confirmed citation were the same mark — on a product whose whole claim is that nothing enters
  // the graph as fact until someone says so. The Map tab already dashes them; the list did not.
  prov: string;
};

// The cell's geometry, in the cell's own px (row top = 0, cell 40 wide; the svg declares no view box,
// so user units are px). The title line is the Link's py-2.5 (10) plus half the body rung's 22, so
// its centre is 21; the strokes sit on the HALF pixel (21.5 across, 20.5 down) so a 1px line fills
// exactly one device row or column at DPR 1. The old 1.5px stroke on a whole-pixel centre smeared
// over two at half ink.
const C = 21.5; // the title line, where the tick and the node sit
const NODE_X = 30; // the node's left edge; the tick ends here, never under a fill
const NODE = 8; // side; rx = side / 4, the artifact square the Map draws
// The innermost lane. 16.5, not 20.5: a tick runs from the lane to the node's left edge (30), and a
// 3-3 dash needs more than two periods to read as dashed — at 20.5 the through-row tick was 9.5px
// (one and a half dashes) and an end row's, after its 5px curl, 4.5px: the provenance mark was a speck
// at 1x. 13.5 / 8.5 + the curl now.
const LANE_X = 16.5;
const LANE_GAP = 6;
const BEND = 5; // one corner radius, everywhere
const MAX_LANES = 3;

// A hub and the rows it is tied to. `hub` is whichever end of each citation has the higher degree —
// direction is not what the rail shows, structure is — so a document cited by three others and a
// document citing three others draw the same way: one bracket, a tick per row. `a`..`b` is the span
// of ROW INDICES the bracket covers; `proposed` holds the member ids whose tie is still the agent's.
export type Trunk = { hub: string; members: Set<string>; proposed: Set<string>; a: number; b: number };

export function buildTrunks(edges: WeaveEdge[], order: string[]): Trunk[] {
  const indexOf = new Map(order.map((id, i) => [id, i]));
  const ties = edges.filter((e) => indexOf.has(e.from) && indexOf.has(e.to)); // both ends are rows
  const degree = new Map<string, number>();
  for (const e of ties) {
    degree.set(e.from, (degree.get(e.from) ?? 0) + 1);
    degree.set(e.to, (degree.get(e.to) ?? 0) + 1);
  }
  const byHub = new Map<string, Set<string>>();
  // a tie is proposed until a human confirms it; remembered by the row it lands on, because that is
  // the segment of the drawing that carries it
  const proposedAt = new Map<string, Set<string>>();
  for (const e of ties) {
    const hub = (degree.get(e.from) ?? 0) >= (degree.get(e.to) ?? 0) ? e.from : e.to;
    const other = hub === e.from ? e.to : e.from;
    (byHub.get(hub) ?? byHub.set(hub, new Set()).get(hub)!).add(other);
    if (e.prov === "ai_generated") {
      (proposedAt.get(hub) ?? proposedAt.set(hub, new Set()).get(hub)!).add(other);
    }
  }
  return [...byHub.entries()].map(([hub, members]) => {
    const idx = [hub, ...members].map((id) => indexOf.get(id)!);
    return { hub, members, proposed: proposedAt.get(hub) ?? new Set(), a: Math.min(...idx), b: Math.max(...idx) };
  });
}

// Greedy interval colouring. Trunks are visited longest-first, each taking the first lane in which
// nothing it overlaps already sits; two that meet at a row count as overlapping, so two ticks into
// one node never share a lane. Lane 0 (the first taken, the longest) is drawn outermost.
export function assignLanes(trunks: Trunk[]): Map<string, number> {
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

// how many lanes the list draws — the clip rule: a fourth lane never gets an x of its own
export function countLanes(lanes: Map<string, number>): number {
  return Math.min(MAX_LANES, Math.max(0, ...lanes.values()) + 1);
}

// The inks, by token. The spine and a verified tick are the glyph hint (#878681 light — pixel-identical
// to what muted@0.7 landed on, so the rest line did not move); a proposed tick is solid forest and
// dashed — the dash is the provenance, the forest is whose hand — up from 3.4:1 to 7.5:1; the node is
// the row's own meta ink. No opacity attribute anywhere: four hand-written alphas on muted-foreground
// and primary were the list's only theme-blind values, and the alpha-ink family forbids them.
const SPINE = "var(--foreground-hint)";
const PROPOSED = "var(--primary)";
const NODE_INK = "var(--muted-foreground)";

// One row's cell. Everything it draws comes from these props — no measurement, no observer, no state —
// so the rest rail is in the server HTML and a reorder simply reflows.
export function RailCell({
  index,
  id,
  trunks,
  lanes,
  laneCount,
  lit,
  litIndex,
  hubIndexOf,
  color,
}: {
  index: number;
  id: string;
  trunks: Trunk[];
  lanes: Map<string, number>;
  laneCount: number;
  // the row under the pointer or holding focus, and its index (-1 when none)
  lit: string | null;
  litIndex: number;
  // hub id → its row index
  hubIndexOf: Map<string, number>;
  // the collection's hue: spent on the lit row's node and its real ties, nowhere else
  color: string;
}) {
  const inTrunk = (t: Trunk) => lit != null && (t.hub === lit || t.members.has(lit));
  const tiedHere = (t: Trunk) => t.hub === id || t.members.has(id);
  // a clipped trunk (a fourth lane) is drawn only while one of its rows is lit
  const shown = trunks.filter((t) => lanes.get(t.hub)! < MAX_LANES || inTrunk(t));
  const isLit = lit === id;
  let nodeHue = false;
  const pieces: React.ReactNode[] = [];

  for (const t of shown) {
    const tied = tiedHere(t);
    if (!tied && (index <= t.a || index >= t.b)) continue; // outside the span: not this trunk's row
    const k = Math.min(lanes.get(t.hub)!, MAX_LANES - 1);
    const lx = LANE_X - LANE_GAP * (laneCount - 1 - k);
    const hubIdx = hubIndexOf.get(t.hub)!;

    // The star. S = [lo, hi] is the span the lit row's REAL ties cover: the whole trunk when the hub
    // is lit, hub-to-member when a member is. A piece below the title line (`down`, a's curl) takes
    // the hue iff lo <= i < hi and a piece above it (`up`, b's curl) iff lo < i <= hi, so the hue
    // stops at the two ticks and never runs past the lit row. Nothing recedes: every other piece
    // keeps its rest ink. The member hover used to light the whole bracket past receded ticks, which
    // said press was tied to rows 3-4, and the dimmed untied rows read as disabled.
    let lo = -1, hi = -1, tickHue = false;
    if (inTrunk(t)) {
      const litIsHub = t.hub === lit;
      lo = litIsHub ? t.a : Math.min(hubIdx, litIndex);
      hi = litIsHub ? t.b : Math.max(hubIdx, litIndex);
      // the hub lit: every tick of the trunk is a real tie. A member lit: only its own tick and the
      // hub's — the other members share a hub with it, not a tie. The same rows' nodes take the hue.
      tickHue = litIsHub || isLit || index === hubIdx;
      if (litIsHub || index === hubIdx) nodeHue = true;
    }
    const downHue = lo <= index && index < hi;
    const upHue = lo < index && index <= hi;
    const key = t.hub;

    if (!tied) {
      // a stranger inside the span: the lane runs through, in the hue only when the lit span covers it
      pieces.push(
        <line key={`${key}-through`} className="weave-ease" x1={lx} y1={0} x2={lx} y2="100%" stroke={upHue && downHue ? color : SPINE} strokeWidth={1} />,
      );
      continue;
    }
    // a proposed tie is forest and dashed in EVERY state — provenance is not a hover state
    const proposed = t.proposed.has(id);
    const tickInk = proposed ? PROPOSED : tickHue ? color : SPINE;

    // The TIE is everything from the lane to the node: on a through row a straight tick, on an end row
    // the curl and the tick as ONE path. Drawn as one, a proposed end row dashes its curl too (three
    // dashes over 16px, not one over 4.5) and the curl's ink is the tie's — which on an end row is the
    // same answer the span rule gives, since a's curl is `down` and b's is `up`.
    if (index === t.a) {
      pieces.push(
        <line key={`${key}-down`} className="weave-ease" x1={lx} y1={C + BEND} x2={lx} y2="100%" stroke={downHue ? color : SPINE} strokeWidth={1} />,
      );
    } else if (index === t.b) {
      pieces.push(
        <line key={`${key}-up`} className="weave-ease" x1={lx} y1={0} x2={lx} y2={C - BEND} stroke={upHue ? color : SPINE} strokeWidth={1} />,
      );
    } else {
      pieces.push(
        <line key={`${key}-up`} className="weave-ease" x1={lx} y1={0} x2={lx} y2={C} stroke={upHue ? color : SPINE} strokeWidth={1} />,
        <line key={`${key}-down`} className="weave-ease" x1={lx} y1={C} x2={lx} y2="100%" stroke={downHue ? color : SPINE} strokeWidth={1} />,
      );
    }
    const tie =
      index === t.a
        ? `M ${lx} ${C + BEND} A ${BEND} ${BEND} 0 0 1 ${lx + BEND} ${C} H ${NODE_X}`
        : index === t.b
          ? `M ${lx} ${C - BEND} A ${BEND} ${BEND} 0 0 0 ${lx + BEND} ${C} H ${NODE_X}`
          : `M ${lx} ${C} H ${NODE_X}`;
    pieces.push(
      <path
        key={`${key}-tie`}
        className="weave-ease"
        d={tie}
        fill="none"
        stroke={tickInk}
        strokeWidth={1}
        strokeDasharray={proposed ? "3 3" : undefined}
      />,
    );
  }
  // a node on every tied row, whether or not its trunk is drawn; an untied row gets one only while lit.
  // A stranger inside a span has pieces (the lane through it) and no node.
  const node = isLit || trunks.some(tiedHere);
  if (!node && pieces.length === 0) return null;
  return (
    // absolute in the cell (see MemberRows): the cell takes the row's height, the svg fills the cell,
    // and the `100%` verticals resolve against it
    <svg aria-hidden="true" className="absolute inset-0 block h-full w-10" width={40}>
      {pieces}
      {node ? (
      <rect
        className="weave-ease weave-node"
        x={NODE_X}
        y={C - 0.5 - NODE / 2}
        width={NODE}
        height={NODE}
        rx={NODE / 4}
        fill={isLit || nodeHue ? color : NODE_INK}
        // the hover is a scale about the node's own centre (.weave-node), never a redrawn box
        style={isLit ? { transform: "scale(1.35)" } : undefined}
      />
      ) : null}
    </svg>
  );
}
