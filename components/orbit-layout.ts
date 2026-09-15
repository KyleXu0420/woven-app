// The space field's layout (the /team graph): the space pinned at the centre, its collections on an inner
// ellipse, its people on an outer one. Pure geometry — no React, no DOM — so it can be measured:
// scripts/orbit-bench.mjs scores it against fixtures for the three defects the eye objects to (a spoke grazing a
// mark it does not end at, a spoke through a name, a collection sitting on a person's line to the centre — the
// bead) and for determinism, ring gaps and bounds. Chosen 2026-09-03 from a four-way panel (penalty sum, sectors,
// combinatorial search, free) judged on the bench and on renders; sectors won on clearance (34px mean over seven
// fixtures), crossings (19) and spoke length.
//
// Known limits, measured by the panel's adversaries: 19+ people cannot all keep 20° apart on one ring
// (pigeonhole), so the ring packs evenly and the bench reports the gap; everyone-in-every-collection graphs keep
// some crossings (inherent — a person in four collections has four spokes) but no hits on the fixtures; the label
// metrics below (12/10.5px, 0.54em per glyph, 17-char clip) mirror local-graph.tsx and must move with it.
import type { GraphNode } from "@/lib/types";

const clip = (s: string, n = 17) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export type Geom = {
  W: number;
  H: number;
  INNER: { rx: number; ry: number };
  OUTER: { rx: number; ry: number };
  // the mark's drawn radius, as the renderer will draw it (the space field sizes collections by member count and
  // people by contribution weight). When absent, the depth default the renderer uses at rest.
  radius?: (n: GraphNode) => number;
  // where the rings are centred; the box's centre when absent (the bench's geometry)
  cx?: number;
  cy?: number;
  // where the renderer hangs a name — the settle keeps spokes off the box the name will take, so it must
  // assume the same seat the page gives. "below" (default, the bench's model): under the mark. "beside"
  // (rounds 1–3 of the graph loop): on the mark's OUTER side, right of it on the right half of the ring and
  // left of it on the left, vertically centred. "outward" (round 4): the one of the eight seats that points
  // AWAY from the rings' centre — above for a mark at 12 o'clock, right at 3, below-left at half past seven
  // (outwardSides) — so every name on the field points the same way its spoke does not, and one rule places
  // a collection on the inner ring and a person on the outer. Under "beside" a collection's name was pushed
  // off its right seat by whichever spoke crossed it and fell to the chooser's next free seat, so "Growth"
  // sat below-left, "Research" below-right and "Q4 Roadmap" left — four placements read as meaning (round 3's
  // judge). Modelled HERE, at the seat the page gives, the settle keeps the people's spokes off it: the seat
  // is clear because the layout cleared it, not because the chooser found another.
  names?: "below" | "beside" | "outward";
};

// The label box the layout and the bench both assume — the name hangs under the mark at baseline r + 13. The
// numbers are the measured upper bound of Inter at 10.5/12px on /team (2026-09-03: 0.46–0.60 em per glyph, box
// 1.3 em tall, top 1.03 em above the baseline), rounded up so the model never claims less than the page shows.
export const LABEL = { glyph: 0.62, height: 1.32, ascent: 1.05, baseline: 13 };
// The EXPECTED width of a name — for the one job the upper bound is wrong for: fitting a name's end to an
// edge. A ring sized with 0.62 em a glyph stopped every name 5–15px short of the margin it was fitted to
// (round 3: "Sam Park" 29px inside the title's x), and one average is wrong by name: "Onboarding revamp
// notes" is 12.1 em of narrow letters, "Sam Park" 4.4 em of wide ones. Inter's advances by class, in em
// (measured on /team at 13px: Acme Product 85 vs 87 rendered at 500, Ana Sridhar 70 vs 70, Theo Novak 72 vs
// 71). The chooser still tests overlap with `glyph`, and its off-frame test allows the difference.
export function fitWidth(text: string, fs: number): number {
  let w = 0;
  for (const ch of text)
    w += ch === " " ? 0.27 : /[ijl'.,:;|!]/.test(ch) ? 0.27 : /[ftrI]/.test(ch) ? 0.34 : /[mwMW]/.test(ch) ? 0.87 : /[A-Z]/.test(ch) ? 0.68 : /[0-9+−]/.test(ch) ? 0.6 : 0.56;
  return w * fs;
}
export function labelBox(x: number, y: number, r: number, label: string, fs: number) {
  const w = clip(label).length * fs * LABEL.glyph + 2;
  return { x: x - w / 2, y: y + r + LABEL.baseline - fs * LABEL.ascent, w, h: fs * LABEL.height };
}
type Pt = { x: number; y: number };
export type Box = { x: number; y: number; w: number; h: number };
type Placed = Pt & { box: Box | null };
type Seat = { p: GraphNode; i: number; u: number };
type Spoke = { a: string; b: string; person: string | null; col: string | null };

// Sectors: collections own arcs of the outer ring sized by head-count; a person sits inside the arc of their
// collection, or between the arcs of the collections they share — so spokes are short and fan outward instead
// of crossing the field. A final coordinate descent settles every angle against the three clearances above.
// Angles are the ellipses' parametric angles (what cos/sin receive), 0 at 3 o'clock, clockwise on screen.
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const wrap = (a: number) => ((a % TAU) + TAU) % TAU; // [0, TAU)
const signed = (a: number) => wrap(a + Math.PI) - Math.PI; // (-PI, PI]
const circ = (a: number, b: number, m: number) => {
  const d = Math.abs(a - b) % m;
  return Math.min(d, m - d);
}; // distance around a ring of m slots

export function orbitLayout(nodes: GraphNode[], edges: { from: string; to: string }[], geom: Geom): Map<string, Pt> {
  const cx = geom.cx ?? geom.W / 2;
  const cy = geom.cy ?? geom.H / 2;
  const centre: Placed = { x: cx, y: cy, box: null };
  // Rings are by KIND, not depth: the space graph gives every node depth 1 (the space alone is depth 0), and
  // depth only sizes the mark in the renderer. The centre is the depth-0 node; collections take the inner ring;
  // everyone else is a person on the outer ring.
  const cols = nodes.filter((n) => n.depth !== 0 && n.kind === "collection");
  const people = nodes.filter((n) => n.depth !== 0 && n.kind !== "collection");
  const k = cols.length;
  const colIndex = new Map(cols.map((c, i) => [c.id, i]));
  const memberCols = new Map<string, number[]>(people.map((p) => [p.id, []])); // person → collection input indices
  for (const e of edges) {
    const [p, c] = colIndex.has(e.to) ? [e.from, e.to] : colIndex.has(e.from) ? [e.to, e.from] : [undefined, undefined];
    if (p && c && memberCols.has(p) && !memberCols.get(p)!.includes(colIndex.get(c)!)) memberCols.get(p)!.push(colIndex.get(c)!);
  }

  // 1. Ring order of the collections: whichever keeps shared memberships between neighbours, so a shared
  //    person's spokes span a short arc rather than the whole field. Brute force — at most 720 orders.
  let order = cols.map((_, i) => i);
  if (k >= 3 && k <= 7) {
    const shared = people.map((p) => memberCols.get(p.id)!).filter((s) => s.length > 1);
    const cost = (perm: number[]) => {
      const slot: number[] = [];
      perm.forEach((ci, s) => (slot[ci] = s));
      let t = 0;
      for (const s of shared) for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) t += circ(slot[s[i]], slot[s[j]], k);
      return t;
    };
    let best = Infinity;
    const rec = (perm: number[], rest: number[]) => {
      if (!rest.length) {
        const c = cost(perm);
        if (c < best) {
          best = c;
          order = perm;
        }
        return;
      }
      rest.forEach((r, i) => rec([...perm, r], rest.filter((_, j) => j !== i)));
    };
    rec([0], order.slice(1));
  }
  const slotOf: number[] = [];
  order.forEach((ci, s) => (slotOf[ci] = s)); // input index → ring slot
  const singles = order.map((ci) => people.filter((p) => memberCols.get(p.id)!.length === 1 && memberCols.get(p.id)![0] === ci).length);

  // 2. Each person's seat on the ring, in slot units: on their collection, or — for shared people — wherever
  //    the longest spoke is shortest: midway between two neighbours, on the middle one of a cluster, or on
  //    the emptiest collection when they belong to all of them (that collection then gets a sector of its own).
  const seatOf = (p: GraphNode): number | null => {
    const s = [...new Set(memberCols.get(p.id)!.map((ci) => slotOf[ci]))].sort((a, b) => a - b);
    if (s.length < 2) return s.length ? s[0] : null;
    const cands = s.flatMap((v, i) => [v, (v + (i + 1 < s.length ? s[i + 1] : s[0] + k)) / 2]);
    let best: number | null = null;
    let bestKey = Infinity;
    for (const u of cands) {
      const key = Math.max(...s.map((v) => circ(u, v, k))) * 1e4 + s.reduce((t, v) => t + circ(u, v, k), 0) * 100 + (Number.isInteger(u) ? singles[u % k] : 0);
      if (key < bestKey) {
        bestKey = key;
        best = u % k;
      }
    }
    return best;
  };
  let seq: Seat[] = people
    .map((p, i) => ({ p, i, u: seatOf(p) }))
    .filter((e): e is Seat => e.u !== null)
    .sort((a, b) => a.u - b.u || a.i - b.i);
  const widestGap = (list: Seat[]) => {
    let bi = 0;
    let bg = -1;
    list.forEach((e, i) => {
      const g = (i + 1 < list.length ? list[i + 1].u : list[0].u + k) - e.u;
      if (g > bg + 1e-9) {
        bg = g;
        bi = i;
      }
    });
    return { i: bi, g: bg };
  };
  // people with no collection are parked together in the widest hole of the ring — present, but in no one's sector
  const parked: Seat[] = people.map((p, i) => ({ p, i, u: 0 })).filter((e) => !memberCols.get(e.p.id)!.length);
  if (parked.length && seq.length) {
    const { i, g } = widestGap(seq);
    parked.forEach((e) => (e.u = (seq[i].u + g / 2) % k));
  }
  seq = [...seq, ...parked].sort((a, b) => a.u - b.u || a.i - b.i);
  if (seq.length) {
    const { i } = widestGap(seq);
    seq = [...seq.slice(i + 1), ...seq.slice(0, i + 1)]; // the ring opens at its widest hole
  }

  // 3. Angles. People are evenly spaced (a sector's width is its head-count); fewer than nine close up to a
  //    fan. A collection centres on its sector: people seated in it count in full, those on its edges half.
  const ang = new Map<string, number>();
  const n = seq.length;
  const slot = n ? Math.min(40 * DEG, TAU / n) : 0;
  seq.forEach((e, j) => ang.set(e.p.id, j * slot));
  const seat = new Map<string, number>(seq.map((e) => [e.p.id, e.u]));
  const ringCols = order.map((ci) => cols[ci]);
  ringCols.forEach((c, s) => {
    let x = 0;
    let y = 0;
    let W = 0;
    for (const p of people) {
      if (!memberCols.get(p.id)!.includes(colIndex.get(c.id)!)) continue;
      const off = circ(seat.get(p.id)!, s, k);
      const w = off < 0.25 ? 1 : off < 0.75 ? 0.5 : W ? 0 : 1 / memberCols.get(p.id)!.length;
      x += w * Math.cos(ang.get(p.id)!);
      y += w * Math.sin(ang.get(p.id)!);
      W += w;
    }
    if (Math.hypot(x, y) > 1e-6) ang.set(c.id, Math.atan2(y, x));
  });
  const placed = ringCols.filter((c) => ang.has(c.id));
  ringCols.forEach((c, s) => {
    // an empty collection sits between its placed neighbours in ring order
    if (ang.has(c.id)) return;
    if (!placed.length) return ang.set(c.id, -Math.PI / 2 + (s / k) * TAU);
    let before = s;
    let after = s;
    let runBefore = 0;
    let runAfter = 0;
    while (!ang.has(ringCols[(before = (before + k - 1) % k)].id)) runBefore++;
    while (!ang.has(ringCols[(after = (after + 1) % k)].id)) runAfter++;
    const a0 = ang.get(ringCols[before].id)!;
    const span = placed.length === 1 ? TAU : wrap(ang.get(ringCols[after].id)! - a0);
    ang.set(c.id, a0 + (span * (runBefore + 1)) / (runBefore + runAfter + 2));
  });
  const GAP = 21 * DEG; // a degree over the 20° the rings promise
  // Collections fed by the same people land on the same angle (a founder in all five puts two marks on one
  // pixel). Push angular neighbours apart — neighbours by ANGLE, not by ring order, or a coincident pair that
  // is not adjacent in ring order is never compared. Ties break by ring order so the result stays deterministic.
  const colGap = Math.min(45 * DEG, k > 1 ? TAU / k : TAU); // coincident marks spread to a readable arc
  for (let it = 0; it < 60 && k > 1; it++) {
    let moved = false;
    const byAngle = [...ringCols].sort((a, b) => ang.get(a.id)! - ang.get(b.id)! || ringCols.indexOf(a) - ringCols.indexOf(b));
    byAngle.forEach((c, i) => {
      const j = byAngle[(i + 1) % k];
      const d = i + 1 < k ? ang.get(j.id)! - ang.get(c.id)! : ang.get(j.id)! + TAU - ang.get(c.id)!;
      if (d < colGap - 1e-9) {
        const push = (colGap - d) / 2;
        ang.set(c.id, ang.get(c.id)! - push);
        ang.set(j.id, ang.get(j.id)! + push);
        moved = true;
      }
    });
    for (const [id, a] of ang) ang.set(id, wrap(a));
    if (!moved) break;
  }
  // turn the whole field: a fan opens downward so names hang outward; a full ring puts the first collection on top
  const turn = n && n * slot < TAU - 1e-9 ? Math.PI / 2 - ((n - 1) * slot) / 2 : k ? -Math.PI / 2 - ang.get(cols[0].id)! : 0;
  for (const [id, a] of ang) ang.set(id, wrap(a + turn));

  // 4. Settle. Same measures as the field's own review: a spoke against every mark and name it does not end
  //    at, and each collection against its person's line to the centre.
  const radius = (nd: GraphNode) => geom.radius?.(nd) ?? (nd.depth === 0 ? 8.5 : nd.depth === 2 ? 4 : 6);
  const pos = new Map<string, Placed>();
  const space = nodes.find((nd) => nd.depth === 0);
  let home = new Map(ang);
  const place = (nd: GraphNode, a?: number): Placed => {
    // a placed node carries the box its name occupies (the name hangs under the mark)
    const r = nd.kind === "collection" ? geom.INNER : geom.OUTER;
    const p: Placed = a === undefined ? { ...centre } : { x: cx + r.rx * Math.cos(a), y: cy + r.ry * Math.sin(a), box: null };
    const fs = nd.depth === 0 ? 12 : 10.5;
    // the box the settle keeps spokes off: under the mark, or (names: "beside") on the mark's outer side —
    // the seat the page gives it, so what is measured here is what is drawn there
    // under "outward" the settle models a PERSON's name outward — the seat the page's widest-gap rule gives a
    // mark whose lines all go inward (gapSides) — and a collection's beside its mark on its own half, as
    // "beside" did: a collection's outward side faces its own people's spokes and cannot be cleared, and
    // the seat the page's rule most often finds for it is a flank, which the side box stands in for. The
    // centre's name reads to the right of its mark.
    const inner = nd.depth !== 0 && nd.kind === "collection";
    p.box = !nd.label
      ? null
      : geom.names === "outward"
        ? labelBoxAt(a === undefined ? "right" : inner ? (p.x >= cx ? "right" : "left") : outwardSides(p.x - cx, p.y - cy)[0], p.x, p.y, radius(nd), clip(nd.label), fs)
        : geom.names === "beside"
          ? labelBoxAt(p.x >= cx ? "right" : "left", p.x, p.y, radius(nd), clip(nd.label), fs)
          : labelBox(p.x, p.y, radius(nd), nd.label, fs);
    return p;
  };
  if (space) pos.set(space.id, place(space));
  for (const nd of [...cols, ...people]) pos.set(nd.id, place(nd, ang.get(nd.id)!));
  const E: Spoke[] = edges
    .filter((e) => pos.has(e.from) && pos.has(e.to))
    .map((e) => {
      const f = nodes.find((x) => x.id === e.from)!;
      const t = nodes.find((x) => x.id === e.to)!;
      const isCol = (x: GraphNode) => x.depth !== 0 && x.kind === "collection";
      const isPerson = (x: GraphNode) => x.depth !== 0 && x.kind !== "collection";
      const person = isPerson(f) ? e.from : isPerson(t) ? e.to : null;
      const col = isCol(f) ? e.from : isCol(t) ? e.to : null;
      return { a: e.from, b: e.to, person: person && col ? person : null, col };
    });
  const segT = (px: number, py: number, a: Pt, b: Pt) => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    return l2 ? Math.max(0, Math.min(1, ((px - a.x) * dx + (py - a.y) * dy) / l2)) : 0;
  };
  const segD = (px: number, py: number, a: Pt, b: Pt, t: number) => Math.hypot(px - (a.x + t * (b.x - a.x)), py - (a.y + t * (b.y - a.y)));
  const markD = (p: Pt, a: Pt, b: Pt) => {
    const t = segT(p.x, p.y, a, b);
    return t > 0.02 && t < 0.98 ? segD(p.x, p.y, a, b, t) : Infinity; // the ends of a spoke do not count
  };
  const side = (px: number, py: number, a: Pt, b: Pt) => Math.sign((b.x - a.x) * (py - a.y) - (b.y - a.y) * (px - a.x));
  const nameD = (r: Box, a: Pt, b: Pt) => {
    // exact segment↔box distance: zero when they meet, else attained at a corner or an end
    const xs = [r.x, r.x + r.w, r.x + r.w, r.x];
    const ys = [r.y, r.y, r.y + r.h, r.y + r.h];
    const inside = (p: Pt) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
    if (inside(a) || inside(b)) return 0;
    let min = Infinity;
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      const c1 = { x: xs[i], y: ys[i] };
      const c2 = { x: xs[j], y: ys[j] };
      if (side(xs[i], ys[i], a, b) !== side(xs[j], ys[j], a, b) && side(a.x, a.y, c1, c2) !== side(b.x, b.y, c1, c2)) return 0;
      min = Math.min(min, segD(xs[i], ys[i], a, b, segT(xs[i], ys[i], a, b)));
    }
    for (const p of [a, b]) min = Math.min(min, Math.hypot(Math.max(r.x - p.x, 0, p.x - r.x - r.w), Math.max(r.y - p.y, 0, p.y - r.y - r.h)));
    return min;
  };
  const beadD = (e: Spoke) => markD(pos.get(e.col!)!, pos.get(e.person!)!, centre);
  // penalty: a soft target well above the threshold, and a steep wall at the threshold itself
  const pen = (d: number, hard: number, soft: number) => (d < soft ? (soft - d) ** 2 : 0) + (d < hard ? 30 * (hard - d) ** 2 : 0);
  const passes = (m: Placed, a: Pt, b: Pt) => pen(markD(m, a, b), 15, 36) + (m.box ? pen(nameD(m.box, a, b), 4, 22) : 0);
  const own = (nd: GraphNode, a: number) => {
    // this node's share of the penalty: the spokes it ends, the spokes passing it, its beads, its reach
    let s = 0;
    for (const e of E) {
      const pa = pos.get(e.a)!;
      const pb = pos.get(e.b)!;
      if (e.a !== nd.id && e.b !== nd.id) {
        s += passes(pos.get(nd.id)!, pa, pb);
        continue;
      }
      for (const m of nodes) if (m.id !== e.a && m.id !== e.b && pos.has(m.id)) s += passes(pos.get(m.id)!, pa, pb);
      if (e.person) s += pen(beadD(e), 15, 36) + 0.005 * Math.hypot(pa.x - pb.x, pa.y - pb.y);
    }
    return s + 0.002 * (signed(a - home.get(nd.id)!) / DEG) ** 2;
  };
  const worst = () => {
    // the field's single worst clearance, ranked the way a reader ranks it: a name is 12px stricter than a mark
    let min = Infinity;
    for (const e of E) {
      const pa = pos.get(e.a)!;
      const pb = pos.get(e.b)!;
      for (const m of nodes) {
        if (m.id === e.a || m.id === e.b || !pos.has(m.id)) continue;
        const p = pos.get(m.id)!;
        min = Math.min(min, markD(p, pa, pb), p.box ? nameD(p.box, pa, pb) + 12 : Infinity);
      }
      if (e.person) min = Math.min(min, beadD(e));
    }
    return Math.min(min, 44); // 44px of air is enough; past that a move is only drift
  };
  // pass 1: each node lowers its own penalty (fast, local). pass 2: nudges that lift the field's worst clearance.
  for (let sweep = 0, polish = false; sweep < 12; sweep++) {
    let moved = false;
    for (const ring of [cols, people]) {
      for (const nd of ring) {
        const cur = ang.get(nd.id)!;
        const p0 = pos.get(nd.id)!;
        const reach = polish ? 15 * DEG : ring === cols ? 0 : 60 * DEG; // the inner ring is the sectors; only people roam, only the polish nudges a collection
        const around = home.get(nd.id)!;
        let lo = around - reach;
        let hi = around + reach; // within reach of its seat, and never within GAP of a ring neighbour
        if (ring.length > 1) {
          const others = ring.filter((m) => m !== nd).map((m) => wrap(ang.get(m.id)! - cur));
          lo = Math.max(lo, cur - (TAU - Math.max(...others)) + GAP);
          hi = Math.min(hi, cur + Math.min(...others) - GAP);
        }
        if (hi - lo < 1e-6) continue;
        const steps = polish ? 12 : 16;
        const evalAt = (a: number) => {
          pos.set(nd.id, place(nd, a));
          const s = polish ? -worst() : own(nd, a);
          pos.set(nd.id, p0);
          return s;
        };
        let bestA = cur;
        let best = evalAt(cur);
        if (polish && best <= -44) break;
        for (let i = 0; i <= steps; i++) {
          const a = lo + ((hi - lo) * i) / steps;
          const s = evalAt(a);
          if (s < best - 1e-9) {
            best = s;
            bestA = a;
          }
        }
        if (bestA !== cur) {
          ang.set(nd.id, bestA);
          pos.set(nd.id, place(nd, bestA));
          moved = true;
        }
      }
    }
    if (!moved && polish) break;
    if ((!moved || sweep >= 7) && !polish) {
      polish = true;
      sweep = 8;
      home = new Map(ang); // the polish nudges about the settled seat
    }
  }
  // Rounded to 1/100 px: the server's and the browser's V8 disagree in the 14th digit of a cosine, and React
  // reports the difference as a hydration mismatch on every path and transform. Two decimals is finer than
  // any pixel and identical on both sides.
  const hundredth = (v: number) => Math.round(v * 100) / 100;
  return new Map([...pos].map(([id, p]) => [id, { x: hundredth(p.x), y: hundredth(p.y) }]));
}


// ── Names choose a side ───────────────────────────────────────────────────────────────────────────────────
// A name used to hang under its mark, always. In the space field a collection's own spokes leave downward
// to its people, so the name sat on its own lines; in an ego map the centre's ties do the same to the centre's
// name; and a line crossing the field ran through whatever names were in its path. The layout can keep marks clear of lines; names it cannot, so each name picks the side —
// below, above, right, left, in that order of preference — where its box crosses no line, no mark and no name
// already placed. Greedy in the caller's order (centre, collections, people), deterministic. The bench scores
// the page through the same function, so "no spoke through a name" is measured where it is decided.
// Eight seats: the four sides, then the four corners — a hub with ties in every direction has no free side,
// but ties 45° apart leave a corner open. Corners come last in preference so a quiet field keeps names below.
export type LabelSide = "below" | "above" | "right" | "left" | "below-right" | "below-left" | "above-right" | "above-left";
export const SIDES: LabelSide[] = ["below", "above", "right", "left", "below-right", "below-left", "above-right", "above-left"];
// air between a side-set name and its mark: 4.8 units, 6px at the explorer's unit (round 4 — it was 4, a 5px
// gap that the eye read as the name touching its mark on the 20px hub; 6 is the gap the list keeps between
// its 12px mark and its row title, so the field's names sit off their marks the way the list's do)
export const SIDE_GAP = 4.8;
// the seat that points AWAY from a centre, and the rest in order of how far they turn from it: the eight
// seats are the eight compass points (right 0°, below-right 45°, below 90° … clockwise on screen, y down),
// and a mark at direction (dx, dy) from the centre wants the one nearest that direction. Ties (a mark at
// exactly 12 o'clock: above-left and above-right turn 45° either way) break in SIDES' order.
const SEAT_ANGLE: Record<LabelSide, number> = {
  right: 0,
  "below-right": 45,
  below: 90,
  "below-left": 135,
  left: 180,
  "above-left": 225,
  above: 270,
  "above-right": 315,
};
const turnFrom = (a: number) => (s: LabelSide) => {
  const d = Math.abs(SEAT_ANGLE[s] - a) % 360;
  return Math.min(d, 360 - d);
};
export function outwardSides(dx: number, dy: number): LabelSide[] {
  if (Math.hypot(dx, dy) < 1e-6) return SIDES;
  const turn = turnFrom(((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360);
  return [...SIDES].sort((p, q) => turn(p) - turn(q) || SIDES.indexOf(p) - SIDES.indexOf(q));
}
// THE FIELD'S ONE SEAT RULE (round 4): a name sits on the side of its mark FURTHEST FROM ITS OWN LINES.
// `angles` are the directions the mark's lines leave it in (degrees, screen angles as above); each of the
// eight seats is scored by how far it turns from the nearest line, and the seats come back best first. A
// person on the outer ring, whose lines all go inward, gets the outward seat; a subject's ring node the
// same; a collection on the inner ring, whose people's lines come from OUTWARD and the space's from
// inward, gets the flank beside the space's spoke — the outward seat there faces its own fan by
// construction and no settle can clear it ("Q4 Roadmap" under a plain outward rule sat on Sara's line).
// Two seats as clear as each other (within 3°) break toward `outward` (dx, dy from the field's centre: the
// seat that also points away is the one a reader expects), and a mark with no lines takes the outward order.
export function gapSides(angles: number[], dx: number, dy: number): LabelSide[] {
  if (!angles.length) return outwardSides(dx, dy);
  const lines = angles.map((a) => ((a % 360) + 360) % 360);
  const out = Math.hypot(dx, dy) < 1e-6 ? null : ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
  const clear = (s: LabelSide) => Math.min(...lines.map((a) => angDist(SEAT_ANGLE[s], a)));
  const away = out === null ? () => 0 : (s: LabelSide) => angDist(SEAT_ANGLE[s], out);
  return [...SIDES].sort((p, q) => {
    const d = clear(q) - clear(p);
    if (Math.abs(d) > 3) return d;
    return away(p) - away(q) || SIDES.indexOf(p) - SIDES.indexOf(q);
  });
}
const angDist = (a: number, b: number) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};
// `trail`: room reserved AFTER the name in reading order — the fold chip a hub wears ("+N") and the gap before
// it. The chip always follows the name (round 1 of the graph loop: "+15 Notification strategy v3" read the
// count first on one node and last on the next), so for a name seated LEFT of its mark the chip sits between
// the name and the mark, and the name gives way by the chip's width; for every other seat the box grows by it.
export function labelBoxAt(side: LabelSide, x: number, y: number, r: number, text: string, fs: number, baseline = LABEL.baseline, trail = 0): Box {
  return boxAt(side, x, y, r, text.length * fs * LABEL.glyph + 2 + trail, fs, baseline);
}
// the same box for a name of a GIVEN width — the expected one (fitWidth) where a name is fitted to an edge
export function boxAt(side: LabelSide, x: number, y: number, r: number, w: number, fs: number, baseline = LABEL.baseline): Box {
  const h = fs * LABEL.height;
  if (side === "below") return { x: x - w / 2, y: y + r + baseline - fs * LABEL.ascent, w, h };
  if (side === "above") return { x: x - w / 2, y: y - (r + SIDE_GAP + 1) - fs * LABEL.ascent, w, h };
  if (side === "right" || side === "left") {
    const top = y + fs * 0.36 - fs * LABEL.ascent; // baseline vertically centred on the mark
    return side === "right" ? { x: x + r + SIDE_GAP, y: top, w, h } : { x: x - (r + SIDE_GAP) - w, y: top, w, h };
  }
  // corners: the name starts (or ends) off the mark's corner, the same air from it as a side seat keeps
  // (round 4 — it started at r × 0.72 + gap − 1, a round mark's diagonal, and on a square mark the cap line
  // ran 1 unit under the edge and the first glyph 2.5 from it: "Growth below-left touching its edge")
  const dx = r * 0.9 + SIDE_GAP;
  const right = side.endsWith("right");
  const below = side.startsWith("below");
  const baselineY = cornerBaseline(y, r, fs, below);
  return { x: right ? x + dx : x - dx - w, y: baselineY - fs * LABEL.ascent, w, h };
}
// a corner seat's baseline: the cap line half a gap under the mark's bottom edge, or the baseline half a gap
// over its top edge (a descender may reach the edge's height; the letters do not)
const cornerBaseline = (y: number, r: number, fs: number, below: boolean) =>
  below ? y + r + SIDE_GAP * 0.5 + fs * 0.75 : y - r - SIDE_GAP * 0.5 - fs * 0.2;
// where the <text> goes for a side: x/y offsets from the mark's centre and the anchor
// `trail` as in labelBoxAt: an end-anchored name ends one trail earlier, so its chip fits before the mark
export function labelAnchor(side: LabelSide, r: number, fs: number, baseline = LABEL.baseline, trail = 0): { x: number; y: number; anchor: "middle" | "start" | "end" } {
  if (side === "below") return { x: -trail / 2, y: r + baseline, anchor: "middle" };
  if (side === "above") return { x: -trail / 2, y: -(r + SIDE_GAP + 1), anchor: "middle" };
  if (side === "right") return { x: r + SIDE_GAP, y: fs * 0.36, anchor: "start" };
  if (side === "left") return { x: -(r + SIDE_GAP) - trail, y: fs * 0.36, anchor: "end" };
  const dx = r * 0.9 + SIDE_GAP;
  const right = side.endsWith("right");
  const below = side.startsWith("below");
  return { x: right ? dx : -dx - trail, y: cornerBaseline(0, r, fs, below), anchor: right ? "start" : "end" };
}
export const overlaps = (a: Box, b: Box) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
// the least distance from a box to a segment, sampled along it (0 inside). Shared with the graph's fold
// chips, which keep off the ties the same way the names do.
export const segBoxDist = (r: Box, a: Pt, b: Pt) => {
  let min = Infinity;
  for (let k = 0; k <= 24; k++) {
    const t = k / 24;
    const px = a.x + (b.x - a.x) * t;
    const py = a.y + (b.y - a.y) * t;
    min = Math.min(min, Math.hypot(Math.max(r.x - px, 0, px - (r.x + r.w)), Math.max(r.y - py, 0, py - (r.y + r.h))));
  }
  return min;
};
// `prefer`: the seats to try for a name, most wanted first — the field's names sit BESIDE their marks (right
// on the right half, left on the left: the outer side, where no spoke goes), so the field asks for that order
// and the bench keeps the default. `edges` may carry `soft`: the ids of the ENDS at which the tie costs the
// name nothing — a subject's spokes pass behind the subject's own name by design (the knockout takes them),
// so they are soft at the subject's end. Per end, not per tie (round 2): soft at both ends, a spoke also cost
// the neighbour nothing, and a neighbour's name sat on its own line to the hub; and a column's lead, soft at
// its hub's end, emerged from under the hub's name — a hub with a list hanging off it now seats its name
// where nothing leaves the mark. `trail`: room after a name for its chip, see labelBoxAt.
export function chooseLabelSides(
  order: { id: string; text: string; fs: number; baseline?: number; trail?: number }[], // the names to place, most important first
  pos: Map<string, Pt>,
  radius: (id: string) => number,
  edges: { from: string; to: string; soft?: string[] }[],
  bounds?: { W: number; H: number },
  prefer?: (id: string) => LabelSide[],
): Map<string, LabelSide> {
  const sides = new Map<string, LabelSide>();
  const placed: Box[] = [];
  const marks: Box[] = [...pos].map(([id, p]) => {
    const r = radius(id) + 1;
    return { x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r };
  });
  const segs = edges
    .map((e) => ({ a: pos.get(e.from), b: pos.get(e.to), ends: e.soft ?? [] }))
    .filter((s): s is { a: Pt; b: Pt; ends: string[] } => !!s.a && !!s.b);
  for (const n of order) {
    const p = pos.get(n.id);
    if (!p) continue;
    const r = radius(n.id);
    const seats = prefer?.(n.id) ?? SIDES;
    let best: LabelSide = seats[0] ?? "below";
    let bestCost = Infinity;
    seats.forEach((side, i) => {
      const box = labelBoxAt(side, p.x, p.y, r, n.text, n.fs, n.baseline, n.trail);
      let cost = i * 0.5; // the preference order breaks ties
      for (const { a, b, ends } of segs) if (!ends.includes(n.id) && segBoxDist(box, a, b) < 3) cost += 12; // a line through, or grazing, the name (the bench's limit is 2)
      for (const m of marks) if (overlaps(box, m) && !(Math.abs(m.x + m.w / 2 - p.x) < 1e-6 && Math.abs(m.y + m.h / 2 - p.y) < 1e-6)) cost += 12; // on someone's mark
      for (const q of placed) if (overlaps(box, q)) cost += 8; // on a name already set
      // off the frame — judged on the name's EXPECTED extent, not the upper bound: the box is `glyph` em per
      // character and the ring is fitted with `fit` em (LABEL), so a name fitted to end exactly on the
      // frame's edge models as a box running past it by the difference, and judged on the box it flipped to
      // the next seat (round 3: a ring fitted tighter seated its names above their marks). The slack is
      // that difference, sideways only; a name over the top or bottom edge is what it is.
      const slack = n.text.length * n.fs * LABEL.glyph - fitWidth(n.text, n.fs);
      if (bounds && (box.x + slack < 0 || box.y < 2 || box.x + box.w - slack > bounds.W || box.y + box.h > bounds.H - 2)) cost += 6;
      if (cost < bestCost - 1e-9) {
        bestCost = cost;
        best = side;
      }
    });
    sides.set(n.id, best);
    placed.push(labelBoxAt(best, p.x, p.y, r, n.text, n.fs, n.baseline, n.trail));
  }
  return sides;
}
