import type { ClothLink, ClothReading } from "./cover-read";

// The cover's cloth, woven: geometry and yarns only (no React, no data access), so the same cloth can be woven
// for any box and checked outside the app. components/neighbourhood-cover.tsx lays it on the card;
// cover-read.ts reads the document it is woven from.
//
// The picture is a window onto the document's cloth. The sett is fixed in CSS px: an end is 8px wide with a 1px
// seam beside it, and a pick is about 8px tall with a 1px seam under it. A bigger box shows more of the cloth
// and never a bigger thread, the way a cover image is cropped by its frame: the 1440 Library band is about 26
// ends by 8 picks, the 390 band 39 by 13, the phone strip 39 by 12, and the hero's swatch is the 1440 band's own
// box, so on a 1440 screen it is the band's cloth rect for rect.
//
// The ground. The warp runs top to bottom: the document's sections in reading order, each as wide as it is long
// (words; none narrower than a twelfth, none under two ends), each a run of ends in the collection's hue (the
// colour of the card's own chip). Every other section is dyed deeper, so the sections stand as broad warp
// stripes and their lengths are the cloth's largest shape. Once the document is woven into anything, a ground
// weft of the same yarn runs through it in plain weave, each pick over one end and under the next, and the next
// pick the other way. The weft sits a grain step toward the card, under half the stripe's step, so it reads as
// texture and the stripes stay the only shape in the ground. A document woven into nothing is the warp alone:
// a striped field of ribs.
//
// The seams are painted in the cloth's own shadow, never left open to the card: the yarn beside them mixed 15%
// toward the ink in light, 14% toward the card in dark. The seams between ends run the full height; the seams
// between picks are half that step, so the warp gives the cloth its direction.
//
// The figure. The two strongest links float: the most evidence rows anchoring a link, then the cloth's own order
// (documents, collections, decisions, topics, people, sources, then id). Each lies two picks tall over every
// run of sections it is anchored in, in its neighbour's hue, with the warp seams pressed on through it in its
// own shadow. The first lies a quarter of the way down and the second the same distance up from the foot, so
// there is at least a pick of ground between either float and the edge, and between the two. A float sits one
// rung further from the card than the ground: in light the hue mixed 15% toward the ink (deeper), in dark the
// hue at 72% over the card (lighter, and under the card's secondary text). A float in the cloth's own hue has
// only lightness to part it from the ground, so in dark it keeps 86% of its yarn.
//
// The ladder on a plum ground (oklab L x100), measured off the rendered Notification band at 1440. Light: stripe
// 56.8, stripe weft 59.3, warp 61.4, weft 63.6; seams 55.4 and 51.6; floats clay 53.9, gold 56.1. Dark: stripe
// weft 45.7, stripe 46.9, weft 49.9, warp 51.1; seams 47.4 and 43.7; floats clay 58.2, gold 60.6, under the
// secondary text at 71.3. No seeded document floats a link in its own hue; from the tokens, plum on plum would
// be 47.6 in light and 60.1 in dark. In both themes the seam is the quietest mark on the cloth and a float the
// loudest.
//
// Why this cloth (2026-10-07). L3, the cloth before this one, read as a mosaic. Its seams showed the card, so
// about 140 lines of grout were the highest-contrast mark on the card (oklab distance 38.6 from the ground in
// light, against 15.8 for a float) and in dark they became black leading. Ends and picks were the same square, so
// nothing had a direction. The stripe step and the weft step were equal moves on one axis and collided (in dark
// they were the same colour string). The thread grew with the box, so the cloth that was fine on the band turned
// to bricks on a phone. Three reviewers read the shipped cloth; four directions were woven on the same data behind
// a switch (M1 rep, M2 ticking, M3 window, M4 sample card) with L3 as the control, and three judges ranked the
// five rows of a shuffled board blind. The rank sums were M3 3, M1 7, M4 9, M2 11, L3 15: every judge put M3
// first. Kyle picked it ("A 窗口，首页仍是布样"): the window cloth on every surface, with the Continue hero kept a swatch
// on its mat. It carries the fixes at least two judges asked for: dark seams and grain softer than light's (dark
// read as outlined tiles; light's seam is 26% off its warp in luminance, dark's 20%), dark floats dimmer (the gold
// float glowed brighter than anything on the dark card), and both floats two picks tall with ground between them
// and the edges (the second was one pick and sat a pick off the foot, which read as a tear).
//
// Limits. Two floats at most, so the cloth no longer shows how many links are anchored; the label says. Two links
// anchored in the same section float one above the other, since a float's place across the cloth is its section's.
// A box under 63px tall has room for one float (every surface today is at least 75px tall). A section shorter than
// a twelfth of the document is widened to a twelfth. The yarns are mixed over the card token and measured there:
// on another ground, re-measure.

export type Rect = { x: number; y: number; w: number; h: number; fill: string };

// The Library band on a 1440 card: the card's 230 inner width, a 3:1 box less its 1px foot rule, as Chrome lays
// it out (in 1/64 px). The hero's swatch is this box, and the server weaves it before any box is measured.
export const BAND = { w: 230, h: 75.65625 };

const PITCH = 9; // an end of 8 CSS px and its 1px seam; a pick and its seam, about the same
const FLOATS = 2; // links floated; the label names every anchored link

// ——— yarns
// The undyed warp of an unfiled document: the warm charcoal of the house's second ink.
export const UNDYED = "var(--muted-foreground)";

// A yarn in both themes, so a shadow or a step is taken from each theme's own colour.
type Yarn = { l: string; d: string };
const ink = (y: Yarn) => `light-dark(${y.l}, ${y.d})`;
const overCard = (x: string, p: number) => (p >= 100 ? x : `color-mix(in oklab, ${x} ${p}%, var(--card))`);
const dyed = (G: string, l: number, d: number): Yarn => ({ l: overCard(G, l), d: overCard(G, d) });

// The ground's yarns by section: the warp at 80% over the card in light (64% in dark), every other section 10
// deeper; the weft a grain step toward the card from the warp it crosses.
const warpOf = (G: string, sec: number): Yarn => dyed(G, sec % 2 ? 90 : 80, sec % 2 ? 54 : 64);
const weftOf = (G: string, sec: number): Yarn => ({ l: overCard(warpOf(G, sec).l, 94), d: overCard(G, sec % 2 ? 51 : 61) });
// The shade between two yarns, about 6 points of oklab lightness in light and 4 in dark (k 1, a seam between
// ends), or half that (k 0.5, a seam between picks).
const shadowOf = (y: Yarn, k = 1): Yarn => ({
  l: `color-mix(in oklab, ${y.l} ${100 - 15 * k}%, var(--foreground))`,
  d: `color-mix(in oklab, ${y.d} ${100 - 14 * k}%, var(--card))`,
});
// A float, one rung further from the card than the ground.
const figureOf = (H: string, G: string): Yarn => ({
  l: `color-mix(in oklab, ${H} 85%, var(--foreground))`,
  d: overCard(H, H === G ? 86 : 72),
});

// ——— the figure
// A float: one link over a run of its anchored sections, [from, to] inclusive.
export type Float = { link: number; from: number; to: number; fill: string };

// The floats a reading shows, in any box: every run of the two strongest links, the strongest first.
export function floatsOf(reading: ClothReading): Float[] {
  return figuresOf(reading).map((f) => ({ link: f.link, from: f.from, to: f.to, fill: ink(f.yarn) }));
}

type Figure = { link: number; from: number; to: number; yarn: Yarn };
function figuresOf(reading: ClothReading): Figure[] {
  const G = reading.ground ?? UNDYED;
  const runs = rankRuns(reading);
  const shown = [...new Set(runs.map((r) => r.link))].slice(0, FLOATS);
  return runs
    .filter((r) => shown.includes(r.link))
    .map((r) => ({ link: r.link, from: r.from, to: r.to, yarn: figureOf(reading.links[r.link].hue, G) }));
}

// Every run of anchored sections, the strongest link's first (its evidence rows anchoring it, summed; a tie keeps
// the links' own order), then its heaviest run, then the first.
type RankedRun = { link: number; strength: number; weight: number; from: number; to: number };
function rankRuns(reading: ClothReading): RankedRun[] {
  const sections = Math.max(1, reading.words.length);
  const runs: RankedRun[] = [];
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
  return runs;
}

// The rows each floated link lies in, among R picks: two each, the first a quarter down, the second mirrored a
// quarter up from the foot. Under 7 picks there is room for the first only; under 4, for one pick of it.
function floatRows(links: number, R: number): number[][] {
  if (!links || !R) return [];
  if (R < 4) return [[Math.floor((R - 1) / 2)]];
  const a = Math.max(1, Math.round(R / 4 - 1));
  if (R < 7 || links < 2) return [[a, a + 1]];
  return [
    [a, a + 1],
    [R - 2 - a, R - 1 - a],
  ];
}

// ——— the warp and the weft, at whole px
type End = { x0: number; x1: number; sec: number; e: number };

// Each section's ends at the sett, from its width (none narrower than a twelfth, none under two ends), every end
// parted from the next by a 1px seam; an end's edges are rounded, so ends differ by a pixel at most.
function endsOf(W: number, words: number[]): { ends: End[]; secs: [number, number][] } {
  const k = Math.max(1, words.length);
  const inner = W - (k - 1);
  const floor = inner / 12;
  const rest = inner - floor * k;
  const total = words.reduce((a, b) => a + Math.max(0, b), 0);
  const widths = (words.length ? words : [1]).map((x) => floor + (total > 0 ? (Math.max(0, x) / total) * rest : rest / k));
  const starts: { x: number; sec: number }[] = [];
  let x = 0;
  widths.forEach((bw, sec) => {
    const n = Math.max(2, Math.round((bw + 1) / PITCH));
    const ew = (bw - (n - 1)) / n;
    for (let i = 0; i < n; i++) starts.push({ x: x + i * (ew + 1), sec });
    x += bw + 1;
  });
  const ends: End[] = starts.map((s, e) => ({ x0: Math.round(s.x), x1: 0, sec: s.sec, e }));
  ends.forEach((end, i) => (end.x1 = i + 1 < ends.length ? ends[i + 1].x0 - 1 : W));
  const secs = widths.map((_, sec) => {
    const own = ends.filter((e) => e.sec === sec);
    return [own[0].x0, own[own.length - 1].x1] as [number, number];
  });
  return { ends, secs };
}

// R picks at whole px, parted by 1px seams.
function picksOf(H: number, R: number): { y0: number; y1: number }[] {
  const P = (H + 1) / R;
  return Array.from({ length: R }, (_, r) => ({ y0: Math.round(r * P), y1: r === R - 1 ? H : Math.round((r + 1) * P) - 1 }));
}

// w x h: the cloth's own size in whole CSS px, the box rounded up; the box clips the fraction.
export type Cloth = { rects: Rect[]; floats: Float[]; w: number; h: number };

// The cloth for a w x h box.
export function clothFor(reading: ClothReading, w: number, h: number): Cloth {
  const W = Math.max(1, Math.ceil(w - 0.01));
  const H = Math.max(1, Math.ceil(h - 0.01));
  const G = reading.ground ?? UNDYED;
  const figs = figuresOf(reading);
  const { ends, secs } = endsOf(W, reading.words);
  const last = ends.length - 1;
  const R = reading.links.length ? Math.max(1, Math.round(H / PITCH)) : 0;
  const rows = picksOf(H, R);

  const shown = [...new Set(figs.map((f) => f.link))];
  const placed = floatRows(shown.length, R);
  const rowsOf = new Map<number, number[]>();
  shown.forEach((link, j) => {
    if (placed[j]) rowsOf.set(link, placed[j]);
  });
  const floatedAt = (r: number, sec: number) => figs.some((f) => (rowsOf.get(f.link) ?? []).includes(r) && sec >= f.from && sec <= f.to);

  const rects: Rect[] = [];
  const paint = (x: number, y: number, rw: number, rh: number, yarn: Yarn) => {
    if (rw > 0 && rh > 0) rects.push({ x, y, w: rw, h: rh, fill: ink(yarn) });
  };
  // the seams between ends over [y0, y1), in the shade of the yarn on their left, or of a float lying over them
  const grooves = (y0: number, y1: number, x0 = 0, x1 = W, yarn?: Yarn) => {
    for (let i = 0; i < last; i++) {
      const gx = ends[i].x1;
      if (gx <= x0 || gx >= x1) continue;
      paint(gx, y0, ends[i + 1].x0 - gx, y1 - y0, shadowOf(yarn ?? warpOf(G, ends[i].sec)));
    }
  };

  // the ends, full height
  for (const e of ends) paint(e.x0, 0, e.x1 - e.x0, H, warpOf(G, e.sec));
  // plain weave: the weft lies over an end where end + pick is odd
  for (let r = 0; r < R; r++)
    for (const e of ends)
      if ((e.e + r) % 2 === 1 && !floatedAt(r, e.sec)) paint(e.x0, rows[r].y0, e.x1 - e.x0, rows[r].y1 - rows[r].y0, weftOf(G, e.sec));
  // the seams between picks, section by section at half the shade, then the seams between ends over them
  for (let r = 0; r + 1 < R; r++) {
    const y = rows[r].y1;
    for (let s = 0; s < secs.length; s++) paint(secs[s][0], y, secs[s][1] - secs[s][0], rows[r + 1].y0 - y, shadowOf(warpOf(G, s), 0.5));
  }
  grooves(0, H);
  // the floats: one block per run over its rows, no pick seam inside, the warp seams pressed on through it
  for (const f of figs) {
    const rs = rowsOf.get(f.link);
    if (!rs) continue;
    const x0 = secs[f.from][0];
    const x1 = secs[f.to][1];
    const y0 = rows[rs[0]].y0;
    const y1 = rows[rs[rs.length - 1]].y1;
    paint(x0, y0, x1 - x0, y1 - y0, f.yarn);
    grooves(y0, y1, x0, x1, f.yarn);
  }

  return { rects, floats: figs.map((f) => ({ link: f.link, from: f.from, to: f.to, fill: ink(f.yarn) })), w: W, h: H };
}
