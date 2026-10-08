import type { ClothLink, ClothReading } from "./cover-read";

// The cover's cloth, woven: geometry and yarns only (no React, no data access), so the same cloth can be woven
// for any box and checked outside the app. components/neighbourhood-cover.tsx lays it on the card;
// cover-read.ts reads the document it is woven from.
//
// The picture is a swatch of tabby seen from a hand's width away, built in two layers, so that it reads first
// as cloth, then as this document's cloth.
//
// The ground. The warp runs top to bottom: the document's sections in reading order, each as wide as it is long
// (words; none narrower than a twelfth), each a run of ends in the collection's hue (the colour of the card's
// own chip); every other section is dyed a small step deeper, so the sections stand as broad warp stripes and
// their lengths are the cloth's first, largest shape. Once the document is woven into anything, a ground weft of
// the same yarn, a small step toward the card, runs through it pick on pick: plain weave, each pick over one end
// and under the next, the next pick the other way, so the ground is a quiet two-tone tabby in one hue. A
// document woven into nothing is the warp alone, unwoven: a striped field. Every link is woven in the ground
// yarn, so the ground says that the document is linked and leaves how many to the label.
//
// The figure. A link anchored in a section floats over it: its pick lies flat over the whole section, a bar in
// its neighbour's hue laid over that stretch of cloth and ringed by a hairline. The floats are the only colour
// on the cloth besides the ground. Four float at most, the strongest first: the most evidence rows anchoring the
// link, then the cloth's own order (documents, collections, decisions, topics, people, sources, then id). The
// first two neighbour hues keep theirs; a further float, like a neighbour dyed in the cloth's own hue, takes the
// cloth's own tone, a step back toward the card. The links that float take the picks nearest their place down
// the cloth, in kind order, spread from the top (the first at half a pitch, the pitch the height over one more
// than their number).
//
// Nothing is painted between two pieces: a seam between two ends and between two picks, and a hairline either
// side of a crossing (the end stops short of a pick that lies over it, the pick stops short of an end that lies
// over it) and round a float. They show whatever the cloth lies on, the card under the Library band and the mat
// under the hero's swatch, so two hues never touch.
//
// One count. Every box is woven with the Library band's thread count, about 14 ends by 5 picks. The sett is cut
// for a reference cloth 370x284 (an end and a pick of 24px), and the gauge follows the box's height, so a
// bigger card shows the same cloth closer, in bigger threads, and never more of them. The band at 1440 and the
// hero's swatch are the band's own box. The seams do not grow with the threads: 1px, and 1.5 once the box is
// twice the band's height.
//
// Why this cloth (2026-10-07). The cloth shipped in aa76634 at one thread size, the 1440 band's, so a bigger box
// showed more threads: the Notification card was 319 pieces on the band and 626 on a 390 phone, while its
// floats kept their height and their share of the box fell. Kyle found the Library cards too busy at two
// columns and at one ("太 overwhelming"). Five cloths were woven on the same data, each keeping the one before
// it and adding one change: L0 the shipped cloth; L1 the gauge follows the box; L2 a link keeps no pick of its
// own, so the floats carry all the colour; L3 one coarser sett for every document, a quieter ground and a
// narrower seam; L4 one float per section and two neighbour hues. Three judges ranked them blind. The rank sums
// were L3 4, L4 7, L2 7, L1 12, L0 15. This is L3, with the fixes at least two judges asked for: four floats at
// most and two neighbour hues (the Notification card still showed seven bars in six hues), seams of 1px that
// stop at 1.5, and in dark the floats mixed 18% toward the card, so none is lighter than the card's secondary
// text. In light the ground already sat where they asked: the weft 2.3 to 4.1 points of oklab lightness off its
// warp, the deeper stripe 2.7 to 4.2 (in dark both are about 2). The trade is density: a document's link count
// no longer shows in the cloth, only in the label. To bring it back, cut the sett per document,
// clamp(REF.h / (2n + 1), 16, 24) for n links.

export type Rect = { x: number; y: number; w: number; h: number; fill: string };

// the reference cloth the sett is cut for, CSS px (V1's hero panel at 1440)
const REF = { w: 370, h: 284 };
// The Library band on a 1440 card: the card's 230 inner width, a 3:1 box less its 1px foot rule, as Chrome lays
// it out (in 1/64 px). Its thread count is every cover's, and the hero's swatch is this box, so its cloth is the
// band's rect for rect.
export const BAND = { w: 230, h: 75.65625 };
// the band's scale of the reference, as V1 wove it on a 1440 Library card
const GAUGE = BAND.w / REF.w;

const CELL = 24; // the sett on the reference cloth: an end's width and a pick's pitch
const HAIR = 0.5; // either side of a crossing, and round a float: a device pixel at DPR 2
const FLOAT = 1.6; // a float, of a pick
const FLOATS = 4; // floats drawn at most; the label names every anchored link
const HUES = 2; // neighbour hues kept on the floats
// A piece of cloth that ends a hairline short of a float shares an edge with the float's ring, but the two are
// summed differently and can miss by a rounding error: the ring would then cut a strip off the piece too thin to
// keep, and a notch of card would show. An edge within this much is shared.
const EDGE = 1e-6;

// The cloth sits back toward the card in both themes, so the floats' hues are the strongest colour on it and the
// cover does not outweigh the title beside it: in light the warp is the hue at LIGHT% over the card, in dark at DARK%.
const LIGHT = 88;
const DARK = 64;
const STRIPE = 8; // every other section, deeper (oklab %)
const SHADE = 8; // the ground weft, toward the card from the warp it crosses (oklab %)
// A float in dark, its hue over the card. At full strength the lifted hues sit 15 to 20 points of lightness over
// the warp, against 0 to 10 under it in light, and ochre and gold outshine the card's secondary text. At 82% the
// median step from the ground matches light's and the lightest float is under that text.
const DIM = 82;

// half a CSS px: a whole device pixel at DPR 2, so every edge is crisp
const snap = (v: number) => Math.round(v * 2) / 2;
// between two ends, and between two picks: wide enough that a crossing shows which way it lies
const seamOf = (h: number) => (h < 2 * BAND.h ? 1 : 1.5);

// ——— yarns
// The undyed warp of an unfiled document: the warm charcoal of the house's second ink.
export const UNDYED = "var(--muted-foreground)";
const lightOf = (G: string, deeper: number) => `color-mix(in oklab, ${G} ${Math.min(100, LIGHT + deeper)}%, var(--card))`;
const darkOf = (G: string, deeper: number) => `color-mix(in oklab, ${G} ${Math.round(DARK * (1 - deeper * 0.009))}%, var(--card))`;
const warpOf = (G: string, sec: number) => {
  const d = sec % 2 ? STRIPE : 0;
  return `light-dark(${lightOf(G, d)}, ${darkOf(G, d)})`;
};
// The ground weft sits back toward the card from the warp it crosses: paler in light, deeper in dark.
const groundOf = (G: string, sec: number) => {
  const d = sec % 2 ? STRIPE : 0;
  return `light-dark(color-mix(in oklab, ${lightOf(G, d)} ${100 - SHADE}%, var(--card)), ${darkOf(G, d + SHADE)})`;
};
// A float wears its neighbour's identity hue (ochre 3.09:1 on the card in light is the floor), toned down in dark.
const hueOf = (hue: string) => `light-dark(${hue}, color-mix(in oklab, ${hue} ${DIM}%, var(--card)))`;
// The cloth's own tone, a float that sits back: its hue further toward the card than the ground, paler in light
// and deeper in dark, about as far from the ground as a neighbour's hue sits (oklab 10 to 15). A neighbour of the
// cloth's own hue would vanish into the ground, so it wears this, and so does a float past the second neighbour
// hue. Mixed toward the ink, as a first pass had it, it was the heaviest block on the card.
const ownOf = (G: string) => `light-dark(color-mix(in oklab, ${G} 60%, var(--card)), color-mix(in oklab, ${G} 40%, var(--card)))`;

// ——— the figure
// A float: one link over a run of its anchored sections, [from, to] inclusive.
export type Float = { link: number; from: number; to: number; fill: string };

// The floats a reading shows, in any box: every run of anchored sections is a candidate, the strongest link's
// first (its evidence rows anchoring it, summed; a tie keeps the links' own order), then its heaviest run, then
// the first; FLOATS are kept. Down that order the first HUES neighbour hues keep theirs, and every other float,
// like a neighbour of the cloth's own hue, takes the cloth's own tone.
export function floatsOf(reading: ClothReading): Float[] {
  const G = reading.ground ?? UNDYED;
  const sections = Math.max(1, reading.words.length);
  const runs: { link: number; strength: number; weight: number; from: number; to: number }[] = [];
  reading.links.forEach((l: ClothLink, i) => {
    const at = new Map<number, number>();
    l.anchors.forEach((s, j) => {
      if (s >= 0 && s < sections) at.set(s, (at.get(s) ?? 0) + (l.weights[j] ?? 1));
    });
    const anchored = [...at.keys()].sort((a, b) => a - b);
    const strength = [...at.values()].reduce((a, b) => a + b, 0);
    let a = 0;
    while (a < anchored.length) {
      let b = a;
      while (b + 1 < anchored.length && anchored[b + 1] === anchored[b] + 1) b++;
      let weight = 0;
      for (let s = anchored[a]; s <= anchored[b]; s++) weight += at.get(s) ?? 0;
      runs.push({ link: i, strength, weight, from: anchored[a], to: anchored[b] });
      a = b + 1;
    }
  });
  runs.sort((x, y) => y.strength - x.strength || x.link - y.link || y.weight - x.weight || x.from - y.from);
  const kept: string[] = [];
  return runs.slice(0, FLOATS).map((r) => {
    const hue = reading.links[r.link].hue;
    let fill = ownOf(G);
    if (hue !== G && (kept.includes(hue) || kept.length < HUES)) {
      if (!kept.includes(hue)) kept.push(hue);
      fill = hueOf(hue);
    }
    return { link: r.link, from: r.from, to: r.to, fill };
  });
}

type End = { x0: number; x1: number; sec: number; e: number };
// a pick in the ground yarn; a link's pick floats over its runs
type Pick = { yc: number; r: number; t: number; tf: number; runs: Float[]; anchors: number[] };

// ——— the warp
// A section's ends are counted at the band's scale, its width over the box's scale against the band's sett and
// seam, so a box of the band's shape has the band's count at any size: a seam that stops growing would otherwise
// tip a section sitting near a half end over to one more.
function endsOf(W: number, words: number[], cell: number, gap: number, scale: number): { ends: End[]; secs: [number, number][] } {
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
    const n = Math.max(1, Math.round((bw / scale + seamOf(BAND.h)) / (cell / scale + seamOf(BAND.h))));
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
  if (c.x1 <= r.x + EDGE || c.x0 >= rx1 - EDGE || c.y1 <= r.y + EDGE || c.y0 >= ry1 - EDGE) return [r];
  const out: Rect[] = [];
  if (c.y0 > r.y) out.push({ ...r, h: c.y0 - r.y });
  if (c.y1 < ry1) out.push({ ...r, y: c.y1, h: ry1 - c.y1 });
  const y0 = Math.max(r.y, c.y0);
  const y1 = Math.min(ry1, c.y1);
  if (c.x0 > r.x) out.push({ ...r, y: y0, h: y1 - y0, w: c.x0 - r.x });
  if (c.x1 < rx1) out.push({ ...r, x: c.x1, y: y0, h: y1 - y0, w: rx1 - c.x1 });
  return out;
}

export type Cloth = { rects: Rect[]; floats: Float[] };

// The cloth for a w x h box, at the gauge the box's height sets.
export function clothFor(reading: ClothReading, w: number, h: number): Cloth {
  const G = reading.ground ?? UNDYED;
  const scale = h / BAND.h;
  const k = scale * GAUGE;
  const cell = CELL * k;
  const gap = seamOf(h);
  const hair = HAIR;
  const { ends, secs } = endsOf(w, reading.words, cell, gap, scale);
  const floats = floatsOf(reading);

  // ——— the weft: as many picks as the sett lays in the box (never fewer than the links that float), those links
  // in the picks nearest their spread, the rest ground. No links, no weft.
  const shown = [...new Set(floats.map((f) => f.link))].sort((a, b) => a - b);
  const m = shown.length;
  const picks: Pick[] = [];
  if (reading.links.length) {
    const R = Math.max(m || 1, Math.floor(h / cell));
    const P = h / R;
    const T = P - gap;
    const pitch = h / (m + 1);
    const slot = new Map<number, number>();
    shown.forEach((_, j) => {
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
      const runs = j === undefined ? [] : floats.filter((f) => f.link === shown[j]);
      const room = runs.length && near(r) >= 2 ? 2 * P - 2 * hair : T * FLOAT;
      const anchors: number[] = [];
      for (const f of runs) for (let s = f.from; s <= f.to; s++) anchors.push(s);
      picks.push({ yc: P * (r + 0.5), r, t: T, tf: Math.min(room, Math.max(T * FLOAT, 24 * k)), runs, anchors });
    }
  }

  // plain weave: a pick over an end where end + pick is odd; a float over every end of its runs
  const floatsOver = (e: End, p: Pick) => p.anchors.includes(e.sec);
  const over = (e: End, p: Pick) => floatsOver(e, p) || (e.e + p.r) % 2 === 1;

  const rects: Rect[] = [];
  // the ends, top to bottom, less a hairline either side of every pick that lies over them
  for (const e of ends) {
    const fill = warpOf(G, e.sec);
    const cuts = picks
      .filter((p) => over(e, p) && !floatsOver(e, p))
      .map((p) => [p.yc - p.t / 2 - hair, p.yc + p.t / 2 + hair] as [number, number]);
    let from = 0;
    for (const [a, b] of cuts) {
      if (a - from > 0.25) rects.push({ x: e.x0, y: from, w: e.x1 - e.x0, h: a - from, fill });
      from = Math.max(from, b);
    }
    if (h - from > 0.25) rects.push({ x: e.x0, y: from, w: e.x1 - e.x0, h: h - from, fill });
  }
  // A pick, crossing by crossing, in each section's shade of the ground yarn: over an end it runs on across the
  // seams either side, to a hairline short of an end that lies over it or of the next section's end, or to the
  // middle of a seam it shares with the next end of its section it lies over.
  for (const p of picks) {
    ends.forEach((e, i) => {
      if (!over(e, p) || floatsOver(e, p)) return;
      const L = ends[i - 1];
      const R = ends[i + 1];
      const x0 = !L ? 0 : over(L, p) && !floatsOver(L, p) && L.sec === e.sec ? (L.x1 + e.x0) / 2 : L.x1 + hair;
      const x1 = !R ? w : over(R, p) && !floatsOver(R, p) && R.sec === e.sec ? (e.x1 + R.x0) / 2 : R.x0 - hair;
      rects.push({ x: x0, y: p.yc - p.t / 2, w: x1 - x0, h: p.t, fill: groundOf(G, e.sec) });
    });
  }

  // ——— the floats, laid over the cloth: one bar per run, ringed by a hairline; what of the cloth they cover is
  // cut away, and a sliver left beside a float too thin to read as thread goes.
  const bars: Rect[] = [];
  for (const p of picks) {
    for (const f of p.runs) {
      const x0 = secs[f.from][0];
      const x1 = secs[f.to][1];
      bars.push({ x: x0, y: p.yc - p.tf / 2, w: x1 - x0, h: p.tf, fill: f.fill });
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
  return { rects: out, floats };
}
