"use client";

import * as React from "react";
import { BAND, CAP, UNDYED, clothFor, type Cloth } from "@/components/cover-cloth";
import { KIND_ORDER, readCloth, type ClothReading } from "@/components/cover-read";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { Artifact, RefKind } from "@/lib/types";

// The document's cover is a swatch of its own cloth: cover-read.ts reads the document, cover-cloth.ts weaves
// it, and this file lays it on the card. Every surface shows the same cloth at one gauge.
//
// What drives it, all of it read from this document:
//   - The warp is its sections in reading order, each a stripe of ends as wide as the section is long in words
//     (none narrower than a twelfth), every other one dyed a step deeper. No sections, one unbroken warp.
//   - The yarn is the hue of the collection the card's own chip leads with, so the cloth and the chip are one
//     colour. An unfiled document is undyed: the house's second ink.
//   - The weft. Once the document is woven into anything, a ground weft of the same yarn runs through it in
//     plain weave, and each confirmed link is one fine pick in its neighbour's identity hue, in kind order
//     (documents, collections, decisions, topics, people, sources). More links, a finer sett.
//   - The floats. A link with an edge anchored in a section floats over that whole section, a bar of its hue.
//     They are the cloth's figure and its only broad colour.
// Never drawn: a proposed link (ai_generated); a neighbour the viewer cannot open (canView, applied in
// cover-read.ts, or the cover would tell a reader a restricted document exists); the title, the type, any
// words. The same document weaves the same cloth on every load.
//
// Where it lies:
//   - The Library card: the band. The cloth fills the card's 3:1 head, flush to its edges; the card's radius
//     rounds its top corners and its foot rule is the band's lower edge.
//   - The Continue hero from sm: the panel is a mat one rung off the card (tint-1, in both themes) and the
//     swatch lies on it, centred. The swatch is the Library band's own box, 230 by 75.66, so on a 1440 screen
//     its cloth is the band's rect for rect. A narrower panel (the 768 portrait) cuts it narrower, 24 in from
//     either side, at the same gauge and height. A taller hero gets more air round it; the swatch keeps its
//     size. No border, radius, shadow or frame: the card's own hairline divides the mat from the text.
//   - The Continue hero on a phone: the band across the card's head, the whole strip, as the Library card
//     sets it (more cloth at the same gauge).
// The gaps between threads are left unpainted, so they show the card under the band and the mat under the
// swatch: in dark the grain sinks into its ground and only the threads and floats carry colour.
//
// Why. The cover was a blurred two-hue gradient with the title in white over black, and it encoded nothing. It
// then drew the document's confirmed links as a hub and spokes, a ring and then a constellation; Kyle called
// the ring really ugly (2026-10-03). The document's contents page replaced it (2d4b869), and Kyle asked for a
// cover with more presence as an image. The visual study (2026-10-04) built six image-first directions on the
// same data (the plain weave, two flat forms, a sliced initial, concentric arcs, a jacquard card, a patchwork)
// and ran ten rounds on the two leaders. The absolute judge loop scored every direction and every round 3 to 5,
// the contents page 4, so it never separated them, and Kyle's own eye decided: he approved the plain weave's
// Library band (V1, round 10) and called the same cloth filling the hero panel too much. Four calmer heroes
// were built on that band (a band on paper, a mounted swatch, a quiet cloth, a hem and a line) and a judge
// panel picked the mounted swatch. The fixes the judges agreed on are in it: the swatch is the band's own cut
// at the band's gauge, with the band's floats and no more; it rests on a tint-1 mat in both themes, centred
// with even air; its gaps are the mat's colour; on a phone it spans the card the way the Library band does.
//
// Limits. Twelve links are drawn at most; the label names the rest. A section shorter than a twelfth of the
// document is widened to a twelfth, so lengths below that do not read. The yarns are mixed over the card token
// and their contrast measured there (ochre the lowest, 3.09:1 on the light card): on another ground, re-measure.
// CoverArt's excerpt is not drawn, since the cloth has no words. The name NeighbourhoodCover is kept because
// AGENTS.md knows it by that name; the cloth is still the document's neighbourhood.
//
// A cold load is never blank. The server renders the cloth woven for the box each caller usually gives it: the
// band at 1440 for the Library card; for the hero both the phone strip and the swatch, each shown only at its
// own widths. After hydration the measured box re-weaves it before the first paint.

type Box = { w: number; h: number };

// the hero's strip on a 390 phone (the card's 112px head less its 1px foot rule)
const STRIP_GUESS: Box = { w: 350, h: 111 };

// The hero's piece, placed by CSS so it sits right before anything is measured. Below sm it is the whole strip.
// From sm it is the band's box, narrower only when the panel leaves less than 24 either side, centred on whole
// px so the cloth's half-pixel snap lands on device pixels and every gap stays crisp. No radius: the ladder has
// no rung for a 230px image (sm 4 is for marks of 8 to 20px; lg 16 would make it a card inside the card).
const PIECE =
  "absolute max-sm:inset-0 sm:h-(--piece-h) sm:w-(--piece-w) sm:top-[round((100%_-_var(--piece-h))/2,1px)] sm:left-[round((100%_-_var(--piece-w))/2,1px)]";
const PIECE_BOX = {
  "--piece-w": `min(${BAND.w}px, 100% - 48px)`,
  "--piece-h": `${BAND.h}px`,
} as React.CSSProperties;

const KIND_WORD: Record<RefKind, [string, string]> = {
  artifact: ["document", "documents"],
  collection: ["collection", "collections"],
  decision: ["decision", "decisions"],
  topic: ["topic", "topics"],
  person: ["person", "people"],
  source: ["source", "sources"],
};

// what the cloth says, in words
function said({ words, links }: ClothReading, drawn: number): string {
  const counts = KIND_ORDER.map((k) => [k, links.filter((l) => l.kind === k).length] as const).filter(([, c]) => c);
  const anchored = links.filter((l) => l.anchors.length).length;
  const warp = words.length
    ? `${words.length} ${words.length === 1 ? "section" : "sections"} as the warp`
    : "one unbroken warp, no sections";
  let weft = "unwoven: no confirmed links";
  if (links.length) {
    weft = `woven with ${counts.map(([k, c]) => `${c} ${KIND_WORD[k][c === 1 ? 0 : 1]}`).join(", ")}`;
    if (anchored) weft += `, ${anchored} of them anchored in a section and floating over it`;
    if (drawn < links.length) weft += `; ${drawn} of the ${links.length} drawn`;
  }
  return `The document as cloth: ${warp}, ${weft}.`;
}

// The box an element is laid out at, measured before the first paint (a layout effect), then followed.
function useBox() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState<Box | null>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const take = (w: number, h: number) => {
      if (!(w > 0 && h > 0)) return;
      setBox((b) => (b && Math.abs(b.w - w) < 0.01 && Math.abs(b.h - h) < 0.01 ? b : { w, h }));
    };
    const r = el.getBoundingClientRect();
    take(r.width, r.height);
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => take(entry.contentRect.width, entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box] as const;
}

// The cloth, drawn for its box. Until the box is measured it is woven for a guess and laid over the real box
// (slice), so a wrong guess crops the cloth and never leaves the box empty.
function ClothSvg({ cloth, size, measured, className }: { cloth: Cloth; size: Box; measured: boolean; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className ? `absolute inset-0 block ${className}` : "absolute inset-0 block"}
      width="100%"
      height="100%"
      viewBox={`0 0 ${size.w} ${size.h}`}
      preserveAspectRatio={measured ? undefined : "xMidYMid slice"}
    >
      {cloth.rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} fill={r.fill} />
      ))}
    </svg>
  );
}

export function NeighbourhoodCover({
  a,
  large = false,
  title,
}: {
  a: Artifact;
  large?: boolean; // the Continue hero: a swatch on a mat from sm, the band across the card below it
  title?: string; // the document's name, when the cover is the card's only place for it (CoverArt label)
}) {
  // subscribed, so a confirm in the Inbox or an unlink reweaves the cloth
  useGraphVersion();
  const reading = readCloth(a.id, a.title, UNDYED);
  // the Library band's own box, or the hero's piece
  const [ref, box] = useBox();
  const label = said(reading, Math.min(reading.links.length, CAP));
  const state = reading.links.length ? "woven" : "unwoven";
  const cloth = `${reading.words.length}s-${reading.links.length}l`;

  const root = large ? (
    <div data-cover={state} data-cloth={cloth} role="img" aria-label={label} className="relative h-full w-full overflow-hidden sm:bg-tint-1">
      <div ref={ref} className={PIECE} style={PIECE_BOX}>
        {box ? (
          <ClothSvg cloth={clothFor(reading, box.w, box.h)} size={box} measured />
        ) : (
          <>
            <ClothSvg cloth={clothFor(reading, STRIP_GUESS.w, STRIP_GUESS.h)} size={STRIP_GUESS} measured={false} className="sm:hidden" />
            <ClothSvg cloth={clothFor(reading, BAND.w, BAND.h)} size={BAND} measured={false} className="max-sm:hidden" />
          </>
        )}
      </div>
    </div>
  ) : (
    <div ref={ref} data-cover={state} data-cloth={cloth} role="img" aria-label={label} className="relative h-full w-full overflow-hidden">
      <ClothSvg cloth={clothFor(reading, (box ?? BAND).w, (box ?? BAND).h)} size={box ?? BAND} measured={box !== null} />
    </div>
  );

  // The name, where the card has no other place for it: a caption under the cloth on the body rung, on the
  // card's own gutter, the way Are.na captions a block. No caller passes it today.
  if (!title) return root;
  return (
    <div className="flex h-full w-full flex-col">
      <div className="min-h-0 flex-1">{root}</div>
      <p className={`line-clamp-2 text-base font-medium text-foreground ${large ? "px-6 pb-5" : "px-4 pb-3"}`}>{title}</p>
    </div>
  );
}
