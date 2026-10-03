"use client";

import * as React from "react";
import { NodeMark } from "@/components/entity-profile";
import { canView, getBlocks, nodeRelations } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { Artifact, RefKind } from "@/lib/types";

// The cover IS the document's neighbourhood. It was a teal→plum blurred gradient with the title in white over
// a black/55 overlay: the only gradient in the product, the largest block on Home, illegible in dark, and it
// encoded nothing. What a Woven document has that no other tool's document has is its confirmed links, so that
// is what the cover draws: the document's own square in its collection's hue, and every confirmed neighbour
// around it in the mark alphabet (shape = kind, size = depth, hue = identity), each tied to it by one hairline.
//
// The first drawing of that fact (2026-07) was a ring: 1.5px ties running into the exact centre, so sixteen of
// them met in a knot under the document's mark; marks at 12 and 10px all one size; one empty slot between
// kinds. The ink went to the lines, the kinds did not read as arcs, and at 230x76 the Library band was a
// starburst with ties crossing marks. Three blind judges ranked it last of five (2026-10-02). This is the
// one they ranked first, the constellation: the same fact with every dial turned down.
//   - The marks lead. Each sits on the graph's 8px floor for its narrowest span (9 on the hero), so a diamond
//     is not a dot beside a square; the document is the one size step up (16 / 12, size = depth).
//   - The ties are 1px and stop short at BOTH ends: a ring of paper round the document that no tie enters,
//     so nothing meets in a point, and a gap before each mark measured to that shape's own edge.
//   - No stub. A tie is never shorter than 14px on the hero, 8 in the Library: the ring skips the arcs over
//     and under the document where a flat box would set a star too close, and a star's inward stagger stops
//     where its tie would get shorter than that.
//   - Nothing touches. Two marks keep 6px of paper between them on the hero, 2 in the Library, and no tie
//     runs over a mark that is not its own; on the flat Library band and the phone hero that is what decides
//     where a star may sit (ringAt).
//   - Kinds read as arcs: up to 1.75 empty slots between them, as much as the ring has room for.
//   - More paper top and bottom in the Library band (12px, was 8), and on Today the drawing sits down on its
//     caption instead of leaving a band of air over it.
//   - Pixel discipline: the document's mark and every star's box land on whole pixels, and a tie within a
//     pixel and a half of the vertical or horizontal is set straight on the half pixel, so it renders as one
//     sharp device row rather than a soft two.
// Limit: the Library band holds about twenty links with every floor kept. Past that its marks touch.
//
// What it does not draw: a tie the agent only proposed (prov ai_generated), since a cover is at rest and
// nothing enters it as fact until a person has said so; a neighbour the viewer cannot see (nodeRelations takes
// no viewer, so canView is applied here, or a cover would publish the existence of a restricted doc); a name ON
// the drawing (the overlay this replaced). No ground of its own, no gradient, no glow, no shadow: it paints on
// whatever surface holds it. Every caller holds it on the card, where every identity hue clears 3:1 in both
// themes (ochre the lowest, 3.09 in light) and the tie ink does too; a caller moving it off the card must
// re-measure (the page ground puts ochre at 2.85).
//
// A document with no confirmed links has no structure to draw, and a ring with one square in it says
// "empty". It shows its own first paragraph set in the reading face instead, Are.na's text block, the honest
// cover for a page with no picture. A document with neither shows its square alone.

// The ring's order: the base's own things first (documents, then the collections and decisions they belong
// to), then topics, then people, then the origins outside the base. Grouped so each kind reads as one arc.
const KIND_ORDER: RefKind[] = ["artifact", "collection", "decision", "topic", "person", "source"];

type Mark = { id: string; kind: RefKind };

// The document's OWN confirmed ties, one mark per neighbour. The first build also drew the confirmed ties among
// the neighbours (5 on Notification strategy v3): those chords cut straight through the middle, two of them
// lay along a pair of spokes and drew a line twice as dark as the rest, which in the alphabet is a claim about
// weight the data never made. A cover draws the document's links, and those are the ties.
function confirmedNeighbourhood(id: string): Mark[] {
  const seen = new Map<string, RefKind>();
  for (const r of nodeRelations(id)) {
    if (r.prov !== "human_verified" || r.target_id === id || !canView(r.target_id)) continue;
    if (!seen.has(r.target_id)) seen.set(r.target_id, r.kind);
  }
  const marks = [...seen].map(([mid, kind]) => ({ id: mid, kind }));
  marks.sort((x, y) => KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0));
  return marks;
}

// the first paragraph of the document's own text — the first block that has words (a callout is a template's
// box, not the document speaking), cut at its first blank line
function firstParagraph(id: string): string | undefined {
  const b = getBlocks(id).find((x) => !x.callout && x.text?.trim());
  return b?.text.trim().split(/\n\s*\n/)[0];
}

const KIND_WORD: Record<RefKind, [string, string]> = {
  artifact: ["document", "documents"],
  collection: ["collection", "collections"],
  decision: ["decision", "decisions"],
  topic: ["topic", "topics"],
  person: ["person", "people"],
  source: ["source", "sources"],
};

// ── the drawing ─────────────────────────────────────────────────────────────────────────────────────────

type Box = { w: number; h: number };
type Pt = { x: number; y: number };

// The cover's two densities. hero: Home's Continue card and Today's, 38% of the card at 1440, a 112px band
// on a phone. band: the Library card's 3:1 strip, 230x76. Every length is CSS px.
//   narrow   the glyph floor: a mark's NARROWEST span
//   centre   the document's own mark, one step up
//   paper    the ring of paper round it that no tie enters
//   gap      the air between a tie's end (its round cap included) and the mark's own edge
//   tie      the shortest visible tie
//   padX     the card's own gutter (px-6 / px-4), so a full ring and the caption share one edge
//   padY     top and bottom; padUnder replaces the bottom when a caption follows, so the name and the
//            lowest stars read as one unit rather than a drawing and a stray line of type under it
//   fill     the most of the frame a full ring takes: air inside the gutter on the hero; the whole measure in
//            the band, where the measure is what runs out first
//   stagger  how far in from the ring a star may be set by its own id (a constellation, not an ellipse)
//   air      the least paper between two marks, and between a mark and a tie that is not its own
const DENSITY = {
  hero: { narrow: 9, centre: 16, paper: 7, gap: 4, tie: 14, padX: 24, padY: 22, padUnder: 8, fill: 0.92, stagger: 0.34, air: 6 },
  band: { narrow: 8, centre: 12, paper: 4, gap: 3, tie: 8, padX: 16, padY: 12, padUnder: 4, fill: 1, stagger: 0.14, air: 3 },
} as const;

// Up to one empty slot and three quarters between kinds, so each kind reads as its own arc without a line
// drawn round it (at one slot, or one and a quarter, documents and collections ran together on the left).
// The gap takes only what the ring has left once every mark has its own room: in the Library band a doc with
// sixteen links has room for about one, and a wider gap there set marks on top of each other.
const KIND_GAP = 1.75;
// 1px ties with round caps: the cap reaches half the width past each end, so the ends are pulled in by it
const STROKE = 1;
const CAP = STROKE / 2;

// The graph's glyph floor (local-graph AMP.glyphMin) is on the NARROWEST span, so the box a mark is drawn in
// grows by kind. A square and a circle are their side; NodeMark's pointy hexagon is 88% as wide as its box
// (MARK_SHAPE 6%–94%); its diamond is box/√2 edge to edge. At one box for all, a diamond read as a dot.
const NARROW_SHARE: Partial<Record<RefKind, number>> = { topic: 0.88, decision: Math.SQRT1_2 };
const boxFor = (kind: RefKind, narrow: number) => Math.round((narrow / (NARROW_SHARE[kind] ?? 1)) * 2) / 2;

// How far a mark reaches from its centre along the unit direction (ux, uy): its own edge, by shape, so every
// tie stops the same distance short of what it points at. Squares are taken square (their rounded corners
// only add air); the diamond's tips touch its box; the pointy hexagon's flanks sit at 44% of the box.
function reachAlong(kind: RefKind, side: number, ux: number, uy: number) {
  const h = side / 2;
  const ax = Math.abs(ux);
  const ay = Math.abs(uy);
  if (kind === "person" || kind === "source") return h;
  if (kind === "decision") return h / (ax + ay);
  if (kind === "topic") return Math.min(ax > 0 ? (0.88 * h) / ax : Infinity, h / (ay + (0.5 / 0.88) * ax));
  return h / Math.max(ax, ay);
}
// the farthest a mark reaches in any direction: a square's corner, every other shape's tip
const reachMax = (kind: RefKind, side: number) => (kind === "artifact" || kind === "collection" ? (side / 2) * Math.SQRT2 : side / 2);

// one stable number in [0, 1) per id — a star's stagger, so it sits where it sat yesterday
function unitOf(id: string) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  h ^= h >>> 13;
  h = Math.imul(h, 0x5bd1e995);
  h ^= h >>> 15;
  return ((h >>> 0) % 1000) / 1000;
}

// Points round an ellipse at equal steps of ROOM. The box runs from 1:1 to 3:1, so the ring is an ellipse
// fitted to it, and a star needs two kinds of room from its neighbour: arc, so two marks do not touch, and
// angle seen from the document, so the tie to the farther one does not graze the nearer. On a round ring the
// two agree. Along the flat top of the Library band they do not: two stars a mark apart sit almost in line
// with the centre and one tie runs past the other's mark. So each step of the ring counts the LESSER of its
// arc over `arc` and its swept angle (times its radius) over `angle`, and the stars are spaced at equal
// counts: wide where the ring runs along the ties, close where it runs across them.
// Only the arc at least `near` from the centre counts, so in a flat box the ring skips the stretch over and
// under the document where a star's tie would be a stub; if no arc is that far (a box too small to hold the
// rule), the whole ring counts. `room` is how many stars the ring holds with both kinds of room kept.
function ringAt(rx: number, ry: number, near: number, arc: number, angle: number) {
  const STEPS = 720;
  const pts: Pt[] = [];
  for (let k = 0; k <= STEPS; k++) {
    const t = (k / STEPS) * 2 * Math.PI;
    pts.push({ x: rx * Math.cos(t), y: ry * Math.sin(t) });
  }
  const far = (p: Pt) => Math.hypot(p.x, p.y) >= near;
  const measure = (only: boolean) => {
    const cum = [0];
    for (let k = 1; k <= STEPS; k++) {
      const a = pts[k - 1];
      const b = pts[k];
      let step = 0;
      if (!only || (far(a) && far(b))) {
        const swept = Math.abs(Math.atan2(a.x * b.y - a.y * b.x, a.x * b.x + a.y * b.y));
        const radius = (Math.hypot(a.x, a.y) + Math.hypot(b.x, b.y)) / 2;
        step = Math.min(Math.hypot(b.x - a.x, b.y - a.y) / arc, (swept * radius) / angle);
      }
      cum.push(cum[k - 1] + step);
    }
    return cum;
  };
  let cum = measure(true);
  if (cum[STEPS] < 0.01) cum = measure(false);
  const P = cum[STEPS];
  const at = (frac: number): Pt => {
    const s = (((frac % 1) + 1) % 1) * P;
    // the first segment whose end lies PAST s — strictly, so a skipped (zero-length) segment is never chosen
    let lo = 1;
    let hi = STEPS;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= s) lo = mid + 1;
      else hi = mid;
    }
    const f = (s - cum[lo - 1]) / (cum[lo] - cum[lo - 1] || 1);
    const a = pts[lo - 1];
    const b = pts[lo];
    return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
  };
  return { at, room: P };
}

// the shortest distance from p to the segment a→b
function toSegment(p: Pt, a: Pt, b: Pt) {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / (vx * vx + vy * vy || 1)));
  return Math.hypot(p.x - a.x - vx * t, p.y - a.y - vy * t);
}

const r2 = (n: number) => Math.round(n * 100) / 100;
// a 1px line centred on a half pixel fills one device row at 1x
const half = (n: number) => Math.floor(n) + 0.5;
// a box of this side centred at n, moved so its near edge lands on a whole pixel
const onGrid = (n: number, side: number) => Math.round(n - side / 2) + side / 2;

type Star = Mark & { x: number; y: number; side: number };
type Tie = { id: string; x1: number; y1: number; x2: number; y2: number };

// The whole layout, pure: the same document in the same box draws the same picture on every load.
function constellation(marks: Mark[], box: Box, large: boolean, seed: number, captioned: boolean) {
  const D = large ? DENSITY.hero : DENSITY.band;
  const n = marks.length;
  const under = captioned ? D.padUnder : D.padY;
  const cx = Math.round(box.w / 2);
  const cy = Math.round((D.padY + box.h - under) / 2);
  const r0 = D.centre / 2 + D.paper;
  const sides = marks.map((m) => boxFor(m.kind, D.narrow));
  const biggest = Math.max(0, ...sides);
  // the nearest a star's centre may sit: the paper, the shortest tie, the gap, and the mark's farthest reach,
  // plus a pixel for the grid snap below
  const nearOf = (i: number) => r0 + CAP + D.tie + CAP + D.gap + reachMax(marks[i].kind, sides[i]) + 1;
  const near = Math.max(0, ...marks.map((_, i) => nearOf(i)));
  // A ring of one or two marks stretched to the box's edge is a long stray line to a corner, so the ring grows
  // with what it holds, up to the density's fill of the frame.
  const rxMax = Math.max(box.w / 2 - D.padX - biggest / 2, 0);
  const ryMax = Math.max((box.h - D.padY - under) / 2 - biggest / 2, 0);
  const k = Math.min(D.fill, 0.5 + 0.06 * n);
  const rx = Math.max(rxMax * k, Math.min(near, rxMax));
  const ry = Math.max(ryMax * k, Math.min(near, ryMax));
  const reachOf = (i: number) => reachMax(marks[i].kind, sides[i]);
  const clearTie = D.air / 2; // the least paper between a mark and a tie that is not its own
  const ring = ringAt(rx, ry, near, biggest + D.air, Math.max(0, ...marks.map((_, i) => reachOf(i))) + clearTie);
  const kinds = [...new Set(marks.map((m) => m.kind))];
  const gap = kinds.length > 1 ? Math.min(KIND_GAP, Math.max(0, (ring.room - n) / kinds.length)) : 0;
  const total = n + gap * kinds.length;
  const turn = (seed % 1000) / 1000; // the document's own seed turns the ring, so two docs alike do not stack alike
  const onRing = marks.map((m, i) => ring.at((i + gap * kinds.indexOf(m.kind)) / total + turn));

  // Each star is set in from the ring by its own id, so the drawing is a constellation and not an ellipse. It
  // moves along the ring's normal, toward the document and never along the ring into its neighbour, by up to
  // the density's stagger of its depth; and it backs off toward the ring for as long as it would sit nearer
  // the document than its shortest tie allows, nearer a mark than the air, or on a tie that is not its own.
  const at: Pt[] = onRing.map((p) => ({ ...p }));
  const tieOf = (p: Pt, i: number): [Pt, Pt] => {
    const d = Math.hypot(p.x, p.y) || 1;
    const e = Math.max(r0, d - sides[i] / 2 - D.gap);
    return [
      { x: (p.x / d) * r0, y: (p.y / d) * r0 },
      { x: (p.x / d) * e, y: (p.y / d) * e },
    ];
  };
  const fits = (i: number, p: Pt) => {
    if (Math.hypot(p.x, p.y) < nearOf(i)) return false;
    const [a0, a1] = tieOf(p, i);
    for (let j = 0; j < n; j++) {
      if (j === i) continue;
      const q = at[j];
      const span = (sides[i] + sides[j]) / 2;
      const gx = Math.max(0, Math.abs(p.x - q.x) - span);
      const gy = Math.max(0, Math.abs(p.y - q.y) - span);
      if (Math.hypot(gx, gy) < D.air) return false;
      const [b0, b1] = tieOf(q, j);
      if (toSegment(p, b0, b1) < reachOf(i) + clearTie || toSegment(q, a0, a1) < reachOf(j) + clearTie) return false;
    }
    return true;
  };
  marks.forEach((m, i) => {
    const p = onRing[i];
    const nx = p.x / (rx * rx || 1);
    const ny = p.y / (ry * ry || 1);
    const nl = Math.hypot(nx, ny) || 1;
    const depth = (p.x * nx + p.y * ny) / nl; // how far the ring's tangent here lies from the document
    const want = D.stagger * unitOf(m.id);
    for (let step = 8; step > 0; step--) {
      const f = (want * step) / 8;
      const c = { x: p.x - (nx / nl) * depth * f, y: p.y - (ny / nl) * depth * f };
      if (fits(i, c)) {
        at[i] = c;
        break;
      }
    }
  });
  const stars: Star[] = marks.map((m, i) => ({
    ...m,
    side: sides[i],
    x: onGrid(cx + at[i].x, sides[i]),
    y: onGrid(cy + at[i].y, sides[i]),
  }));

  const ties: Tie[] = [];
  for (const s of stars) {
    const dx = s.x - cx;
    const dy = s.y - cy;
    const d = Math.hypot(dx, dy) || 1;
    const ux = dx / d;
    const uy = dy / d;
    const from = r0 + CAP;
    const to = d - reachAlong(s.kind, s.side, ux, uy) - D.gap - CAP;
    if (to - from < 2) continue; // only in a box too small to hold the floor
    let x1 = cx + ux * from;
    let y1 = cy + uy * from;
    let x2 = cx + ux * to;
    let y2 = cy + uy * to;
    // within a pixel and a half of the axis, set it ON the axis, on the half pixel
    if (Math.abs(x2 - x1) < 1.5) x1 = x2 = half((x1 + x2) / 2);
    if (Math.abs(y2 - y1) < 1.5) y1 = y2 = half((y1 + y2) / 2);
    ties.push({ id: s.id, x1: r2(x1), y1: r2(y1), x2: r2(x2), y2: r2(y2) });
  }
  return { centre: { x: cx, y: cy, side: D.centre }, stars, ties };
}

// a mark seated at a point, drawn by the alphabet's own renderer at an exact box
function Seat({ node, x, y, side }: { node: Mark; x: number; y: number; side: number }) {
  return (
    <span
      className="absolute flex -translate-x-1/2 -translate-y-1/2"
      style={{ left: r2(x), top: r2(y), width: side, height: side }}
    >
      <NodeMark node={node} className="size-full" />
    </span>
  );
}

export function NeighbourhoodCover({
  a,
  seed,
  large = false,
  excerpt,
  title,
}: {
  a: Artifact;
  seed: number;
  large?: boolean; // the hero cover — bigger marks, more air
  excerpt?: string; // the words to set when there is nothing to draw; the doc's first paragraph by default
  title?: string; // the document's name, when the cover is the card's only place for it (CoverArt label)
}) {
  // subscribed, so a confirm in the Inbox or an unlink redraws the cover; read on every render rather than
  // memoised on the version — a filter over the edge list, cheaper than the memo's own bookkeeping
  useGraphVersion();
  const marks = confirmedNeighbourhood(a.id);
  const text = marks.length ? undefined : (excerpt ?? firstParagraph(a.id));

  // The box, measured. The ring is fitted to the box's own aspect, so the drawing mounts once the box is
  // known (the explorer's pattern): the server and the first client render paint the ground and nothing else,
  // and nothing is laid out twice.
  const [el, setEl] = React.useState<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState<Box | null>(null);
  React.useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!(width > 0 && height > 0)) return;
      setBox({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  let drawing: React.ReactNode = null;
  if (text) {
    // The reading face at its own rung (19/30), cut on a whole line: the count of lines is what the measured
    // box holds, never half a line. The Library band is 76px; with 10px of air it held one line, "A staged
    // rollout —…", which is a fragment, not a page's first lines. 8px holds two. The hero shows a paragraph.
    const padY = large ? 20 : 8;
    const lines = box ? Math.max(1, Math.floor((box.h - 2 * padY) / 30)) : large ? 4 : 1;
    drawing = (
      <p
        className="text-read text-foreground-prose"
        style={{ display: "-webkit-box", WebkitBoxOrient: "vertical", WebkitLineClamp: lines, overflow: "hidden" }}
      >
        {text}
      </p>
    );
  } else if (box) {
    const { centre, stars, ties } = constellation(marks, box, large, seed, !!title);
    drawing = (
      <>
        {/* The ties are the hint ink, the graph's glyph rung: 3.49:1 on the card in light, 3.85 in dark. On a
            cover they are the content (the doc's links), so they hold the 3:1 a meaningful graphic needs; the
            next rung down, line-stroke, is 1.90 / 2.46, under it. The marks stay the first read by size and
            hue, not by thinning the ties past legibility. */}
        <svg width={box.w} height={box.h} viewBox={`0 0 ${box.w} ${box.h}`} className="absolute inset-0" aria-hidden="true">
          <g strokeWidth={STROKE} strokeLinecap="round" className="stroke-foreground-hint">
            {ties.map((t) => (
              <line key={t.id} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} />
            ))}
          </g>
        </svg>
        <Seat node={{ id: a.id, kind: "artifact" }} x={centre.x} y={centre.y} side={centre.side} />
        {stars.map((s) => (
          <Seat key={s.id} node={s} x={s.x} y={s.y} side={s.side} />
        ))}
      </>
    );
  }

  // what the drawing says, for a reader who cannot see it — counted by kind, in the ring's order
  const counts = KIND_ORDER.map((kd) => [kd, marks.filter((m) => m.kind === kd).length] as const).filter(([, c]) => c);
  const said = counts.length
    ? `Linked to ${counts.map(([kd, c]) => `${c} ${KIND_WORD[kd][c === 1 ? 0 : 1]}`).join(", ")}`
    : "No confirmed links yet";
  // ONE root in every mode, so the observer keeps watching the same box when a confirm or an unlink moves the
  // cover between the drawing and the first lines. The words are aria-hidden: the card's text column already
  // gives the link its name, and a paragraph read into it would bury the title.
  const root = (
    <div
      ref={setEl}
      data-cover={text ? "first-lines" : marks.length ? "neighbourhood" : "alone"}
      role={text ? undefined : "img"}
      aria-label={text ? undefined : said}
      aria-hidden={text ? true : undefined}
      className={`relative h-full w-full overflow-hidden ${text ? `flex items-center ${large ? "px-6" : "px-4"}` : ""}`}
    >
      {drawing}
    </div>
  );

  // The name, where the card has no other place for it (Today's hero): a caption under the block on the body
  // rung, on the card's own gutter, the way Are.na captions a block. Set above on the heading rung it was a
  // second heading stacked on the drawing; under it, the drawing leads and the name says whose it is.
  if (!title) return root;
  return (
    <div className="flex h-full w-full flex-col">
      <div className="min-h-0 flex-1">{root}</div>
      <p className={`line-clamp-2 text-base font-medium text-foreground ${large ? "px-6 pb-5" : "px-4 pb-3"}`}>{title}</p>
    </div>
  );
}
