"use client";

import * as React from "react";
import { NodeMark } from "@/components/entity-profile";
import { canView, getBlocks, nodeRelations } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { Artifact, RefKind } from "@/lib/types";

// The cover IS the document's neighbourhood. It was a teal→plum blurred gradient with the title in white over
// a black/55 overlay: the only gradient in the product, the largest block on Home, the whole first screen on
// a phone, illegible in dark, and it encoded nothing. Seven blind judges read it first and read it as an AI
// template. What a Woven document has that no other tool's document has is its confirmed links, so that is
// what the cover draws: the doc's own square at the centre in its collection's hue, each confirmed neighbour
// in the mark alphabet (shape = kind, size = depth, hue = identity) on one ring, and the ties as 1.5px lines
// in the hint ink (why, at the ties below). Every cover is true and every cover is different, and the alphabet becomes the
// thing a reader recognises the product by.
//
// What it does not draw: a tie the agent only proposed (prov ai_generated) — a cover is at rest and nothing
// enters it as fact until a person has said so; a neighbour the viewer cannot see (nodeRelations takes no
// viewer, so canView is applied here — a cover would otherwise publish the existence of a restricted doc);
// a name — the card's own text column names the document, and a title set on the drawing is the overlay
// this replaced. No ground of its own, no gradient, no glow, no shadow: it paints on whatever surface holds
// it (both callers hold it on the card, where every identity hue clears 3:1 in both themes — 3.09 for ochre,
// the lowest, in light; the page ground would put ochre at 2.85, so a caller moving it off the card must
// re-measure).
//
// A document with no confirmed links has no structure to draw, and a ring with one square in it says
// "empty". It shows its own first paragraph set in the reading face instead — Are.na's text block, the
// honest cover for a page with no picture. A document with neither shows its square alone.

// The ring's order: the base's own things first (documents, then the collections and decisions they belong
// to), then topics, then people, then the origins outside the base. Grouped so each kind reads as one arc.
const KIND_ORDER: RefKind[] = ["artifact", "collection", "decision", "topic", "person", "source"];

type Mark = { id: string; kind: RefKind };

// The document's OWN confirmed ties, one mark per neighbour. The first build also drew the confirmed ties among
// the neighbours (5 on Notification strategy v3): on one ring those chords cut straight through the middle,
// two of them lay along a pair of spokes and drew a line twice as dark as the rest, which in the alphabet is a
// claim about weight the data never made. A cover draws the document's links, and those are the spokes.
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

// Points on an ellipse at EQUAL ARC LENGTH, not equal angle. The box is anything from 1.5:1 (the hero at
// 1440) to 3:1 (the Library band, the hero on a phone), so the ring is an ellipse fitted to it; spaced by
// angle, an ellipse piles its points at the two ends and two marks there touch. Each kind is one arc, and
// arcs are parted by one empty slot. `offset` turns the whole ring by the document's own seed.
function ringPoints(groupOf: number[], groups: number, rx: number, ry: number, offset: number) {
  const STEPS = 720;
  const cum = [0];
  let px = rx;
  let py = 0;
  for (let k = 1; k <= STEPS; k++) {
    const t = (k / STEPS) * 2 * Math.PI;
    const x = rx * Math.cos(t);
    const y = ry * Math.sin(t);
    cum.push(cum[k - 1] + Math.hypot(x - px, y - py));
    px = x;
    py = y;
  }
  const P = cum[STEPS];
  const GAP = groups > 1 ? 1 : 0;
  const total = groupOf.length + GAP * groups;
  return groupOf.map((g, i) => {
    const s = ((((i + GAP * g) / total + offset) % 1) + 1) % 1 * P;
    let lo = 1;
    let hi = STEPS;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < s) lo = mid + 1;
      else hi = mid;
    }
    const f = (s - cum[lo - 1]) / (cum[lo] - cum[lo - 1] || 1);
    const t = ((lo - 1 + f) / STEPS) * 2 * Math.PI;
    return { x: rx * Math.cos(t), y: ry * Math.sin(t) };
  });
}

const r2 = (n: number) => Math.round(n * 100) / 100;

const KIND_WORD: Record<RefKind, [string, string]> = {
  artifact: ["document", "documents"],
  collection: ["collection", "collections"],
  decision: ["decision", "decisions"],
  topic: ["topic", "topics"],
  person: ["person", "people"],
  source: ["source", "sources"],
};

export function NeighbourhoodCover({
  a,
  seed,
  large = false,
  excerpt,
}: {
  a: Artifact;
  seed: number;
  large?: boolean; // the hero cover — bigger marks, more air
  excerpt?: string; // the words to set when there is nothing to draw; the doc's first paragraph by default
}) {
  // subscribed, so a confirm in the Inbox or an unlink redraws the cover; read on every render rather than
  // memoised on the version — a filter over the edge list, cheaper than the memo's own bookkeeping
  useGraphVersion();
  const marks = confirmedNeighbourhood(a.id);
  const text = marks.length ? undefined : (excerpt ?? firstParagraph(a.id));

  // The box, measured. The ring is fitted to the box's own aspect, so the drawing mounts once the box is
  // known (the explorer's pattern): the server and the first client render paint the ground and nothing else,
  // and nothing is laid out twice.
  const ref = React.useRef<HTMLDivElement>(null);
  const [box, setBox] = React.useState<{ w: number; h: number } | null>(null);
  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!(width > 0 && height > 0)) return;
      setBox({ w: Math.round(width), h: Math.round(height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // size = depth: the document is one step up from its neighbours, at the alphabet's own ratio
  const centrePx = large ? 20 : 14;
  const markPx = large ? 12 : 10;
  const centreCls = large ? "size-5" : "size-3.5";
  const markCls = large ? "size-3" : "size-2.5";
  const pad = large ? 20 : 10;

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
    const cx = box.w / 2;
    const cy = box.h / 2;
    const n = marks.length;
    // A ring of one or two marks stretched to the box's edge is a long stray line to a corner, so the ring
    // grows with what it holds and fills the box from eight up. It never comes closer to the centre than the
    // two marks' half-sides and a gap, or a flat band would set a neighbour on top of the document.
    const k = Math.min(1, 0.5 + 0.07 * n);
    const near = centrePx / 2 + markPx / 2 + (large ? 14 : 8);
    const rxMax = Math.max(box.w / 2 - markPx / 2 - pad, 0);
    const ryMax = Math.max(box.h / 2 - markPx / 2 - pad, 0);
    const rx = Math.min(Math.max(rxMax * k, near), Math.max(rxMax, near));
    const ry = Math.min(Math.max(ryMax * k, Math.min(near, ryMax)), ryMax);
    const kinds = [...new Set(marks.map((m) => m.kind))];
    const pts = ringPoints(
      marks.map((m) => kinds.indexOf(m.kind)),
      kinds.length,
      rx,
      ry,
      (seed % 1000) / 1000,
    );
    const at = new Map(marks.map((m, i) => [m.id, { x: r2(cx + pts[i].x), y: r2(cy + pts[i].y) }]));
    drawing = (
      <>
        <svg
          width={box.w}
          height={box.h}
          viewBox={`0 0 ${box.w} ${box.h}`}
          className="absolute inset-0"
          aria-hidden="true"
        >
          {/* The document's own ties; the marks sit on their ends and cover them. They were line-stroke (30% of
              the ink): 1.94:1 on the card in light and 2.48 in dark, under the 3:1 a non-text graphic needs. On
              a cover the ties are the content (the doc's links), not the ground of a field. They are the hint
              ink now, the graph's glyph rung: 3.49:1 light, 3.85 dark on the card. In dark that is the tie ink
              the field already draws (--graph-ink in local-graph.tsx). In light the field keeps line-stroke:
              its ties run under names and many marks, and the marks carry it. A cover has no names and few
              marks, so its lines have to read on their own. At 1.5px a hint line still weighs less than the
              lightest 10px mark (ochre, 3.09:1), so the marks stay the first read. */}
          {marks.map((m) => {
            const p = at.get(m.id)!;
            return (
              <line key={m.id} x1={r2(cx)} y1={r2(cy)} x2={p.x} y2={p.y} strokeWidth={1.5} strokeLinecap="round" className="stroke-foreground-hint" />
            );
          })}
        </svg>
        <span className="absolute flex -translate-x-1/2 -translate-y-1/2" style={{ left: r2(cx), top: r2(cy) }}>
          <NodeMark node={{ id: a.id, kind: "artifact" }} className={centreCls} />
        </span>
        {marks.map((m) => {
          const p = at.get(m.id)!;
          return (
            <span key={m.id} className="absolute flex -translate-x-1/2 -translate-y-1/2" style={{ left: p.x, top: p.y }}>
              <NodeMark node={m} className={markCls} />
            </span>
          );
        })}
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
  return (
    <div
      ref={ref}
      data-cover={text ? "first-lines" : marks.length ? "neighbourhood" : "alone"}
      role={text ? undefined : "img"}
      aria-label={text ? undefined : said}
      aria-hidden={text ? true : undefined}
      className={`relative h-full w-full overflow-hidden ${text ? `flex items-center ${large ? "px-6" : "px-4"}` : ""}`}
    >
      {drawing}
    </div>
  );
}
