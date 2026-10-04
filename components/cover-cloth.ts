import type { ClothReading } from "./cover-read";

// The cover's cloth, woven: geometry and yarns only (no React, no data access), so the same cloth can be woven
// for any box and checked outside the app. components/neighbourhood-cover.tsx lays it on the card;
// cover-read.ts reads the document it is woven from.
//
// The picture is a swatch of tabby seen from a hand's width away, built in three layers, so that it reads first
// as cloth, then as this document's cloth.
//
// The ground. The warp runs top to bottom: the document's sections in reading order, each as wide as it is long
// (words; none narrower than a twelfth), each a run of ends in the collection's hue (the colour of the card's
// own chip); every other section is dyed a step deeper, so the sections stand as broad warp stripes and their
// lengths are the cloth's first, largest shape. Once the document is woven into anything, the cloth is woven
// through with a ground weft of the same yarn, a shade off its warp, packed pick on pick: plain weave, each
// pick over one end and under the next, the next pick the other way, so the ground is a fine two-tone tabby in
// one hue. A document woven into nothing is the warp alone, unwoven: a striped field.
//
// The threads. Each confirmed link is one pick of its neighbour's identity hue, shot through the ground in kind
// order (documents, collections, decisions, topics, people, sources, then id), spread down the cloth from the
// top (the first at half a pitch, the pitch the height over one more than their number). Woven plain, a pick
// is gripped by the warp and shows as a fine bright thread between ends, over one, under the next.
//
// The figure. Where a link is anchored in a section its pick floats over the whole section: it lies flat and
// spreads, a full bar in its own hue laid over that stretch of cloth. The floats are the cloth's figure, and
// the only broad marks of colour on it.
//
// Nothing is painted between two hues: a gap between two ends and between two picks, and a hairline either
// side of a crossing (the end stops short of a pick that lies over it, the pick stops short of an end that
// lies over it); a float is ringed by a hairline. The gaps show whatever the cloth lies on, the card under the
// Library band and the mat under the hero's swatch, so two hues never touch and the grain recedes into the
// ground in both themes.
//
// One gauge. The sett is cut for a reference cloth 370x284 (an 18px end and pick at the coarsest, finer as it
// must be for every link to have a ground pick either side, so a document with two links is a coarse basket
// and a richly linked one a dense cloth), and every cover is woven at the Library band's gauge: that reference
// scaled to the band's 230 of 370, the scale V1 wove the band at on a 1440 Library card, the band the owner
// approved. A bigger box shows more ends and more ground picks at the same thread size; it never shows bigger
// threads. A box too short for the ground keeps every thread and lets ground picks go.

export type Rect = { x: number; y: number; w: number; h: number; fill: string };

// the reference cloth the sett is cut for, CSS px (V1's hero panel at 1440)
const REF = { w: 370, h: 284 };
// The Library band on a 1440 card: the card's 230 inner width, a 3:1 box less its 1px foot rule, as Chrome lays
// it out (in 1/64 px). Its gauge is every cover's, and the hero's swatch is this box, so its cloth is the band's
// rect for rect.
export const BAND = { w: 230, h: 75.65625 };
// The gauge, of the reference. Written as V1 computed it for that card (w / 370), so the band's arithmetic,
// and its pixels, are unchanged.
const GAUGE = BAND.w / REF.w;
// links drawn at most; the rest are named by the cover's label
export const CAP = 12;

// the reference sett, CSS px
const CELL = 18; // an end's width and a pick's pitch, at the coarsest
const GAP = 3; // between two ends, and between two picks: wide enough that a crossing shows which way it lies
const HAIR = 0.5; // either side of a crossing, and round a float
const FINE = 0.36; // a link woven plain, of a pick
const FLOAT = 1.6; // a float, of a pick
// dye, oklab %
const STRIPE = 18; // every other section, deeper
const SHADE = 18; // the ground weft, toward the card from the warp it crosses
// The cloth sits back toward the card in both themes, so the links' full hues are the brightest thing on it and
// the cover does not outweigh the title beside it: in light the warp is the hue at LIGHT% over the card (a deeper
// stripe full), in dark at DARK% (a deeper stripe further down into the room).
const LIGHT = 88;
const DARK = 64;

// half a CSS px: a whole device pixel at DPR 2, so every edge is crisp
const snap = (v: number) => Math.round(v * 2) / 2;

// ——— yarns
// The undyed warp of an unfiled document: the warm charcoal of the house's second ink.
export const UNDYED = "var(--muted-foreground)";
const lightOf = (G: string, deeper: number) => `color-mix(in oklab, ${G} ${Math.min(100, LIGHT + deeper)}%, var(--card))`;
const darkOf = (G: string, deeper: number) => `color-mix(in oklab, ${G} ${Math.round(DARK * (1 - deeper * 0.009))}%, var(--card))`;
const warpOf = (G: string, sec: number) => {
  const d = sec % 2 ? STRIPE : 0;
  return `light-dark(${lightOf(G, d)}, ${darkOf(G, d)})`;
};
// The ground weft sits back toward the card from the warp it crosses: paler in light, deeper in dark. So the
// ground is a quiet two-tone tabby and the colour on it is the links'.
// A finer cloth blends its two yarns more, as fine cloth does seen from the same distance: the shade is taken
// down with the sett.
const groundOf = (G: string, sec: number, fine: number) => {
  const d = sec % 2 ? STRIPE : 0;
  const s = Math.round(SHADE * fine);
  return `light-dark(color-mix(in oklab, ${lightOf(G, d)} ${100 - s}%, var(--card)), ${darkOf(G, d + s)})`;
};
// A link wears its neighbour's identity hue (ochre 3.09:1 on the card in light is the floor; every lifted hue
// is over 5:1 in dark). A neighbour of the cloth's own hue would vanish into it, so it is spun a step off:
// deeper in light, lighter in dark.
const threadOf = (hue: string, G: string) =>
  hue === G
    ? `light-dark(color-mix(in oklab, ${G} 55%, var(--foreground)), color-mix(in oklab, ${G} 60%, var(--foreground)))`
    : hue;

type End = { x0: number; x1: number; sec: number; e: number };
type Pick = { yc: number; r: number; t: number; tf: number; fill?: string; anchors: number[] };

// ——— the warp
function endsOf(W: number, words: number[], cell: number, gap: number): { ends: End[]; secs: [number, number][] } {
  const k = Math.max(1, words.length);
  const inner = W - (k - 1) * gap;
  const floor = inner / 12;
  const rest = inner - floor * k;
  const total = words.reduce((a, b) => a + Math.max(0, b), 0);
  const widths = (words.length ? words : [1]).map((x) => floor + (total > 0 ? (Math.max(0, x) / total) * rest : rest / k));
  const ends: End[] = [];
  const secs: [number, number][] = [];
  let x = 0;
  let e = 0;
  widths.forEach((bw, sec) => {
    const n = Math.max(1, Math.round((bw + gap) / (cell + gap)));
    const ew = (bw - (n - 1) * gap) / n;
    for (let i = 0; i < n; i++) ends.push({ x0: x + i * (ew + gap), x1: x + i * (ew + gap) + ew, sec, e: e++ });
    secs.push([x, sec === widths.length - 1 ? W : x + bw]);
    x += bw + gap;
  });
  ends[ends.length - 1].x1 = W;
  return { ends, secs };
}

// ——— rect arithmetic, for laying a float over the cloth
function subtract(r: Rect, c: { x0: number; y0: number; x1: number; y1: number }): Rect[] {
  const rx1 = r.x + r.w;
  const ry1 = r.y + r.h;
  if (c.x1 <= r.x || c.x0 >= rx1 || c.y1 <= r.y || c.y0 >= ry1) return [r];
  const out: Rect[] = [];
  if (c.y0 > r.y) out.push({ ...r, h: c.y0 - r.y });
  if (c.y1 < ry1) out.push({ ...r, y: c.y1, h: ry1 - c.y1 });
  const y0 = Math.max(r.y, c.y0);
  const y1 = Math.min(ry1, c.y1);
  if (c.x0 > r.x) out.push({ ...r, y: y0, h: y1 - y0, w: c.x0 - r.x });
  if (c.x1 < rx1) out.push({ ...r, x: c.x1, y: y0, h: y1 - y0, w: rx1 - c.x1 });
  return out;
}

export type Cloth = { rects: Rect[]; drawn: number };

// The cloth for a w x h box, at the one gauge.
export function clothFor(reading: ClothReading, w: number, h: number): Cloth {
  const G = reading.ground ?? UNDYED;
  const k = GAUGE;
  const links = reading.links.slice(0, CAP);
  const n = links.length;
  // The sett is the document's: as coarse as CELL, and as fine as it must be for every link to have a ground
  // pick either side of it on the reference cloth, so a richly linked document is a denser cloth. At the gauge.
  const sett = n ? Math.min(CELL, REF.h / (2 * n + 1)) : CELL;
  const cell = sett * k;
  const gap = Math.max(0.5, GAP * (sett / CELL) * k);
  const hair = Math.max(0.5, HAIR * k);
  const { ends, secs } = endsOf(w, reading.words, cell, gap);

  // ——— the weft: as many picks as the sett lays in the box (never fewer than the links), the links in the
  // picks nearest their spread, the rest ground. No links, no weft.
  const picks: Pick[] = [];
  if (n) {
    const R = Math.max(n, Math.floor(h / cell));
    const P = h / R;
    const T = P - gap;
    const pitch = h / (n + 1);
    const slot = new Map<number, number>();
    links.forEach((_, j) => {
      const want = Math.min(R - 1, Math.max(0, Math.round((pitch / 2 + j * pitch) / P - 0.5)));
      let s = want;
      for (let d = 1; slot.has(s); d++) {
        if (want + d < R && !slot.has(want + d)) s = want + d;
        else if (want - d >= 0 && !slot.has(want - d)) s = want - d;
      }
      slot.set(s, j);
    });
    // A float lies as wide as a full bar (24px on the reference cloth), short of the next link's pick: with
    // ground picks either side it spreads over them (two floats a pick apart then meet at a hairline, one block
    // of figure); packed between links it keeps to its own pick and a little more.
    const near = (r: number) => {
      let d = Infinity;
      for (const s of slot.keys()) if (s !== r) d = Math.min(d, Math.abs(s - r));
      return d;
    };
    for (let r = 0; r < R; r++) {
      const j = slot.get(r);
      const l = j === undefined ? undefined : links[j];
      const room = l && near(r) >= 2 ? 2 * P - 2 * hair : T * FLOAT;
      picks.push({
        yc: P * (r + 0.5),
        r,
        t: l ? Math.max(1, T * FINE) : T,
        tf: Math.min(room, Math.max(T * FLOAT, 24 * k)),
        fill: l ? threadOf(l.hue, G) : undefined,
        anchors: l ? l.anchors : [],
      });
    }
  }

  // plain weave: a pick over an end where end + pick is odd; a float over every end of its section
  const floats = (e: End, p: Pick) => p.anchors.includes(e.sec);
  const over = (e: End, p: Pick) => floats(e, p) || (e.e + p.r) % 2 === 1;

  const rects: Rect[] = [];
  // the ends, top to bottom, less a hairline either side of every pick that lies over them
  for (const e of ends) {
    const fill = warpOf(G, e.sec);
    const cuts = picks
      .filter((p) => over(e, p) && !floats(e, p))
      .map((p) => [p.yc - p.t / 2 - hair, p.yc + p.t / 2 + hair] as [number, number]);
    let from = 0;
    for (const [a, b] of cuts) {
      if (a - from > 0.25) rects.push({ x: e.x0, y: from, w: e.x1 - e.x0, h: a - from, fill });
      from = Math.max(from, b);
    }
    if (h - from > 0.25) rects.push({ x: e.x0, y: from, w: e.x1 - e.x0, h: h - from, fill });
  }
  // A pick, crossing by crossing: over an end it runs on across the gaps either side, to a hairline short of an
  // end that lies over it, or to the middle of a gap it shares with the next end it lies over.
  for (const p of picks) {
    ends.forEach((e, i) => {
      if (!over(e, p) || floats(e, p)) return;
      const L = ends[i - 1];
      const R = ends[i + 1];
      const x0 = !L ? 0 : over(L, p) && !floats(L, p) && (p.fill || L.sec === e.sec) ? (L.x1 + e.x0) / 2 : L.x1 + hair;
      const x1 = !R ? w : over(R, p) && !floats(R, p) && (p.fill || R.sec === e.sec) ? (e.x1 + R.x0) / 2 : R.x0 - hair;
      rects.push({ x: x0, y: p.yc - p.t / 2, w: x1 - x0, h: p.t, fill: p.fill ?? groundOf(G, e.sec, sett / CELL) });
    });
  }

  // ——— the floats, laid over the cloth: one bar per run of anchored sections, ringed by a hairline; what of
  // the cloth they cover is cut away, and a sliver left beside a float too thin to read as thread goes
  const bars: Rect[] = [];
  for (const p of picks) {
    if (!p.fill || !p.anchors.length) continue;
    const anchored = [...new Set(p.anchors)].filter((s) => s < secs.length).sort((a, b) => a - b);
    let i = 0;
    while (i < anchored.length) {
      let j = i;
      while (j + 1 < anchored.length && anchored[j + 1] === anchored[j] + 1) j++;
      const x0 = secs[anchored[i]][0];
      const x1 = secs[anchored[j]][1];
      bars.push({ x: x0, y: p.yc - p.tf / 2, w: x1 - x0, h: p.tf, fill: p.fill });
      i = j + 1;
    }
  }
  // two floats in neighbouring picks over the same stretch meet at a hairline, halfway between
  for (const a of bars) {
    for (const b of bars) {
      if (a === b || b.y <= a.y || b.x >= a.x + a.w || a.x >= b.x + b.w || a.y + a.h + hair <= b.y) continue;
      const mid = (a.y + a.h / 2 + b.y + b.h / 2) / 2;
      const bEnd = b.y + b.h;
      a.h = Math.min(a.h, mid - hair / 2 - a.y);
      b.y = Math.max(b.y, mid + hair / 2);
      b.h = bEnd - b.y;
    }
  }
  let cloth = rects;
  const sliver = Math.max(1, 2 * k);
  for (const b of bars) {
    const ring = { x0: b.x - hair, y0: b.y - hair, x1: b.x + b.w + hair, y1: b.y + b.h + hair };
    cloth = cloth.flatMap((r) => {
      const parts = subtract(r, ring);
      return parts.length === 1 && parts[0] === r ? parts : parts.filter((q) => q.w >= sliver && q.h >= sliver);
    });
  }

  const out: Rect[] = [];
  for (const r of [...cloth, ...bars]) {
    const x0 = Math.max(0, snap(r.x));
    const y0 = Math.max(0, snap(r.y));
    const x1 = Math.min(w, snap(r.x + r.w));
    const y1 = Math.min(h, snap(r.y + r.h));
    if (x1 > x0 && y1 > y0) out.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, fill: r.fill });
  }
  return { rects: out, drawn: n };
}
