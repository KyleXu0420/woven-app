"use client";

import * as React from "react";
import { NodeMark } from "@/components/entity-profile";
import { canView, getArtifactEvidence, getArtifactGraph, getBlocks, nodeRelations } from "@/lib/api";
import { houseSeparators } from "@/lib/text";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { Artifact, RefKind } from "@/lib/types";

// The cover is the document's own contents page: its section headings in reading order, each with its ordinal
// in grey; after a heading, the marks of what that section is woven into; under one hairline at the foot, what
// the whole document is woven into. One face, flush left, paper and one rule, the way a book sets its contents.
//
// Why. The cover was a blurred two-hue gradient with the title in white over black, and it encoded nothing. It
// then drew the document's confirmed links as a hub and spokes: a ring, and the quieter constellation that
// followed it (c010cd4). Kyle looked at the ring and said it was really ugly (2026-10-03); the constellation is
// the same idea and went with it. Six covers that are not a hub were built on the same data and shot on the
// same five surfaces: the opening set as type, one sentence, a dictionary page, a woven hanging, a loom draft,
// and this contents page. Five judges (three blind, two judging for Kyle's taste) ranked them with the ring as
// the control. This one had the lowest rank sum, 8 (the opening 12, the sentence 13, the dictionary 17, the
// hanging and the draft 28, the ring 34), and every judge put it first or second. It is the one that composes
// with the card's text column instead of sitting beside it: on the Home hero its first heading sits on the text
// column's first baseline (37) and its foot rule runs on in line with the card's footer rule (225).
//
// What it encodes, all of it read from this document:
//   - A heading is a block heading, in order, callouts left out: the reader's outline, so the numerals are the
//     outline's. A heading that only repeats the title is dropped; the card sets the title beside the cover.
//   - A mark after a heading is a confirmed link with an edge out of that section (its evidence anchor; when
//     several edges to one neighbour are anchored, the earliest section wins). A mark on the foot is a confirmed
//     link tied to no section. Shape = kind, hue = identity (NodeMark); kinds in one order: documents,
//     collections, decisions, topics, people, sources.
//   - The hero names its foot "Woven into", the reader's label for the same links. Bare, a row of squares under
//     a rule read as a pager.
//   - In the Library band and the phone strip the headings run in as one line and EVERY mark stands on the
//     foot: at 13px a mark between two words read as an emoji in a sentence.
//   - No sections: the document's opening line in the prose ink, cut on a whole sentence or clause, never with
//     an ellipsis. No text either: a ruled page, a rule on each line it would set, five at most.
// Never drawn: a link the agent only proposed (ai_generated); a neighbour the viewer cannot open (nodeRelations
// takes no viewer, so canView is applied here, or the cover would tell a reader a restricted doc exists);
// versions, scale, `updated`, episodes. No ground, gradient, glow, shadow, filter or hover of its own.
//
// Limits. The band holds two lines of headings; a section that does not fit whole is left out, not cut (the
// aria-label says how many are shown). A foot that runs out of room folds by whole kinds into a +N chip, so a
// rich document shows its documents, collections and decisions first. A heading wears at most four marks
// (three and a chip). Every identity hue clears 3:1 on the card in both themes (ochre the lowest, 3.09 in
// light); the rules are structure, on the card's own line tokens. Off the card, re-measure: the page ground puts
// ochre at 2.85. The name NeighbourhoodCover is kept because AGENTS.md knows it by that name; what it draws is
// still the document's neighbourhood, set on its own contents.

const KIND_ORDER: RefKind[] = ["artifact", "collection", "decision", "topic", "person", "source"];

// one optical size for every kind: a mark's box grows with how much of it its shape leaves empty
const BOX: Record<RefKind, number> = { artifact: 8, collection: 8, person: 8, source: 8, topic: 10, decision: 12 };

const KIND_WORD: Record<RefKind, [string, string]> = {
  artifact: ["document", "documents"],
  collection: ["collection", "collections"],
  decision: ["decision", "decisions"],
  topic: ["topic", "topics"],
  person: ["person", "people"],
  source: ["source", "sources"],
};

// The foot's grid: mark centres 14 apart, 6 more between kinds; a fold keeps room for the gap and a "+NN" chip.
const PITCH = 14;
const KIND_GAP = 6;
const CHIP_ROOM = 36;
// a heading's marks: up to four, else three and a chip
const INLINE_CAP = 4;
// The run-in foot is never wider than the narrowest Library band's measure (216 wide at 1024, less its two
// 16px gutters), so a document wears the same foot on every card and on a phone. Uncapped, the phone strip
// set all sixteen of a rich document's marks in one row: the ring's confetti laid flat.
const RUN_IN_FOOT = 184;

type Link = { id: string; kind: RefKind; anchor?: string };
type Section = { id: string; heading: string; marks: Link[] };

const byKind = (x: Link, y: Link) =>
  KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0);

// the house's separators in a heading: the middle dot, and a dash with its spaces, become a comma
const houseText = (s: string) => houseSeparators(s).replace(/\s+[—–]\s+/g, ", ").trim();

// ── what the document says ─────────────────────────────────────────────────────────────────────────────

function readDoc(a: Artifact) {
  const blocks = getBlocks(a.id);
  const name = houseText(a.title).toLowerCase();
  const heads = blocks.filter((b) => !b.callout && b.heading?.trim() && houseText(b.heading).toLowerCase() !== name);
  const order = new Map(heads.map((b, i) => [b.id, i]));

  // one link per neighbour the viewer can open, confirmed only; anchored to the earliest section any of its
  // outgoing edges is anchored to (a neighbour can be named twice, once as author and once in a section)
  const anchorOf = new Map<string, string | undefined>();
  for (const ev of getArtifactEvidence(a.id)) anchorOf.set(ev.edge_id, ev.block_id);
  const seen = new Map<string, Link>();
  for (const r of nodeRelations(a.id)) {
    if (r.prov !== "human_verified" || r.target_id === a.id || !canView(r.target_id)) continue;
    const link = seen.get(r.target_id) ?? { id: r.target_id, kind: r.kind };
    const b = r.dir === "out" ? anchorOf.get(r.edge_id) : undefined;
    if (b !== undefined && order.has(b) && (link.anchor === undefined || order.get(b)! < order.get(link.anchor)!)) {
      link.anchor = b;
    }
    seen.set(r.target_id, link);
  }
  const links = [...seen.values()].sort(byKind);
  const sections: Section[] = heads.map((b) => ({
    id: b.id,
    heading: houseText(b.heading),
    marks: links.filter((l) => l.anchor === b.id),
  }));
  // the opening line: the first hard line of the first block that has words (a callout is a template's box,
  // not the document speaking)
  const opening = blocks
    .find((b) => !b.callout && b.text?.trim())
    ?.text.trim()
    .split("\n")[0]
    .trim();
  return { links, sections, opening };
}

// ── the opening, cut whole ─────────────────────────────────────────────────────────────────────────────

// words a cut line may not end on: it would read as a sentence stopped mid-breath
const LEAD_ON = new Set(
  "a an the and or but nor of to in on at by for from with into onto than that as via per each every its their our your".split(" "),
);

// Where the opening may stop, best first: the whole line; then after a sentence, longest first; then at a
// clause (its comma, semicolon, colon or spaced dash dropped); then after a word, never on a lead-on word.
function cuts(text: string): string[] {
  const sentence: string[] = [];
  const clause: string[] = [];
  const word: string[] = [];
  for (const m of text.matchAll(/\s+/g)) {
    const head = text.slice(0, m.index).trimEnd();
    if (!head) continue;
    if (/[.!?]["”’)]?$/.test(head)) sentence.push(head);
    else if (/[,;:]$/.test(head)) clause.push(head.slice(0, -1));
    else if (/\s[—–]$/.test(head)) clause.push(head.replace(/\s+[—–]$/, ""));
    else {
      const words = head.split(/\s+/);
      while (words.length > 1 && LEAD_ON.has(words[words.length - 1].toLowerCase())) words.pop();
      word.push(words.join(" ").replace(/[,;:—–-]+$/, ""));
    }
  }
  const all = [text, ...sentence.reverse(), ...clause.reverse(), ...word.reverse()].filter(Boolean);
  return [...new Set(all)];
}

// The longest cut that fits the paragraph's own box, set in a hidden copy of it so the browser breaks the
// lines exactly as it will on the page.
function fitOpening(p: HTMLElement, text: string): string {
  const max = p.clientHeight;
  const probe = p.cloneNode(false) as HTMLElement;
  probe.removeAttribute("data-opening");
  probe.style.height = "auto";
  probe.style.visibility = "hidden";
  p.parentElement?.appendChild(probe);
  try {
    const all = cuts(text);
    for (const c of all) {
      probe.textContent = c;
      if (probe.getBoundingClientRect().height <= max + 0.5) return c;
    }
    return all[all.length - 1];
  } finally {
    probe.remove();
  }
}

// ── the foot ───────────────────────────────────────────────────────────────────────────────────────────

const gapBefore = (ms: Link[], i: number) =>
  PITCH - (BOX[ms[i - 1].kind] + BOX[ms[i].kind]) / 2 + (ms[i].kind !== ms[i - 1].kind ? KIND_GAP : 0);

function rowWidth(ms: Link[]) {
  let x = 0;
  ms.forEach((m, i) => {
    x += (i ? gapBefore(ms, i) : 0) + BOX[m.kind];
  });
  return x;
}

// All of them when they fit; else as many WHOLE kinds as fit beside a chip; else as many marks as fit.
function foldFoot(ms: Link[], room: number) {
  if (rowWidth(ms) <= room) return { shown: ms, rest: 0 };
  let best = 0;
  for (let k = 1; k <= ms.length; k++) {
    const whole = k === ms.length || ms[k].kind !== ms[k - 1].kind;
    if (whole && rowWidth(ms.slice(0, k)) + CHIP_ROOM <= room) best = k;
  }
  if (!best) for (let k = 1; k <= ms.length; k++) if (rowWidth(ms.slice(0, k)) + CHIP_ROOM <= room) best = k;
  return { shown: ms.slice(0, best), rest: ms.length - best };
}

// ── the type ───────────────────────────────────────────────────────────────────────────────────────────

type Mode = "hero" | "portrait" | "run-in";
// the boxes the callers give the cover at 1440: Home's Continue hero, the Library grid card's 3:1 band; and the
// hero's strip on a phone
const HERO_GUESS = { w: 370, h: 284 };
const BAND_GUESS = { w: 230, h: 77 };
const STRIP_GUESS = { w: 350, h: 111 }; // the hero below sm, at 390

const modeOf = (w: number, h: number): Mode => (h >= 200 ? (w >= 240 ? "hero" : "portrait") : "run-in");

// a mark at its optical box, drawn by the alphabet's own renderer
function Mark({ m, ml }: { m: Link; ml?: number }) {
  const s = BOX[m.kind];
  return (
    <span data-m={m.id} className="flex shrink-0" style={{ width: s, height: s, marginLeft: ml || undefined }}>
      <NodeMark node={m} className="size-full" />
    </span>
  );
}

function Chip({ n }: { n: number }) {
  return (
    <span className="inline-flex h-4 shrink-0 items-center rounded-sm bg-tint-1 px-1 text-xs font-medium tabular-nums text-muted-foreground">
      +{n}
    </span>
  );
}

function capInline(marks: Link[]) {
  if (marks.length <= INLINE_CAP) return { shown: marks, folded: 0 };
  return { shown: marks.slice(0, INLINE_CAP - 1), folded: marks.length - (INLINE_CAP - 1) };
}

function MarkRun({ marks, className }: { marks: Link[]; className?: string }) {
  const { shown, folded } = capInline(marks);
  return (
    <span data-run="" className={`flex shrink-0 items-center gap-1 ${className ?? ""}`}>
      {shown.map((m) => (
        <Mark key={m.id} m={m} />
      ))}
      {folded ? <Chip n={folded} /> : null}
    </span>
  );
}

// A heading set so its last word and its marks never part: the words before it wrap as text, the last word
// and the marks ride as one unbreakable unit on the rung's own line height (centred on it, which on 17/24 is
// the capitals' centre: baseline 18, cap height 12).
function Heading({ s }: { s: Section }) {
  const words = s.heading.split(/\s+/);
  const last = words.pop() ?? "";
  const lead = words.length ? words.join(" ") + " " : "";
  return (
    <>
      {lead}
      <span className="inline-flex items-center whitespace-nowrap" style={{ height: "var(--text-lg--line-height)" }}>
        {last}
        {s.marks.length ? <MarkRun marks={s.marks} className="ml-2.5" /> : null}
      </span>
    </>
  );
}

// ── the cover ──────────────────────────────────────────────────────────────────────────────────────────

type Fit = { key: string; n: number; labelW: number; text?: string };

export function NeighbourhoodCover({
  a,
  large = false,
  excerpt,
  title,
}: {
  a: Artifact;
  large?: boolean; // the Continue hero: its foot is set on that card's footer rule and faces line
  excerpt?: string; // the words to set for a document with no sections; its own opening line by default
  title?: string; // the document's name, when the cover is the card's only place for it (CoverArt label)
}) {
  // subscribed, so a confirm in the Inbox or an unlink resets the page
  const version = useGraphVersion();
  const { links, sections, opening: own } = readDoc(a);
  const opening = sections.length ? undefined : excerpt?.trim() || own;

  // the box, measured. Until it is (the server's render, and the client's until hydration, which on a cold load
  // of the deployed site is about two seconds), the page is set for the box this caller usually gives it, so the
  // card is never blank: the hero's 370x284 from lg and its phone strip below sm (between them the hero is a
  // portrait whose size varies, and a wrong mode would jump, so it waits), the Library's 3:1 band everywhere
  // (always run-in, only its line breaks move)
  const [el, setEl] = React.useState<HTMLDivElement | null>(null);
  const [box, setBox] = React.useState<{ w: number; h: number } | null>(null);
  React.useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (!(width > 0 && height > 0)) return;
      setBox((b) => {
        const w = Math.round(width);
        const h = Math.round(height);
        return b && b.w === w && b.h === h ? b : { w, h };
      });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  // the face changes the measure once it has loaded, so the fit is taken again then
  const [fontTick, setFontTick] = React.useState(0);
  React.useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => live && setFontTick((t) => t + 1));
    return () => {
      live = false;
    };
  }, []);

  // The fit, taken before paint. The first pass sets every section, the foot's label and the whole opening;
  // this counts the sections whose row ends inside the clip, reads the label's width and finds the longest
  // cut of the opening that fits; the second pass draws only that. A section is whole or absent.
  const key = box ? `${a.id}|${version}|${box.w}x${box.h}|${fontTick}|${opening ?? ""}` : "";
  const [fit, setFit] = React.useState<Fit | null>(null);
  const fitted = fit && fit.key === key ? fit : null;
  React.useLayoutEffect(() => {
    if (!el || !box || fitted) return;
    let n = sections.length;
    const clip = el.querySelector<HTMLElement>("[data-clip]");
    if (clip) {
      const limit = clip.getBoundingClientRect().bottom + 0.5;
      n = 0;
      for (const r of clip.querySelectorAll<HTMLElement>("[data-row]")) {
        if (r.getBoundingClientRect().bottom <= limit) n++;
        else break;
      }
    }
    const label = el.querySelector<HTMLElement>("[data-foot-label]");
    const p = el.querySelector<HTMLElement>("[data-opening]");
    // A measurement of the committed DOM, set before the browser paints: the layout effect's own job, and the
    // only way to know what the face's real line breaks leave room for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFit({
      key,
      n,
      labelW: label ? Math.ceil(label.getBoundingClientRect().width) : 0,
      text: p && opening ? fitOpening(p, opening) : undefined,
    });
  }, [el, box, fitted, key, sections.length, opening]);

  // Pixel discipline. The caller's box can sit between pixels (the Library's 3:1 band is 76.67 tall, so its
  // second row of cards starts a third of a pixel down): the drawing is set on a layer pushed right and down by
  // the fraction. A run of marks after a word or a label starts at a fractional x: it is pushed right by the
  // fraction, under a pixel. Measured after every commit, so every mark's edge lands on a whole pixel.
  React.useLayoutEffect(() => {
    if (!el) return;
    const layer = el.querySelector<HTMLElement>("[data-layer]");
    if (layer) {
      layer.style.left = "";
      layer.style.top = "";
      const b = layer.getBoundingClientRect();
      const dx = Math.ceil(b.left - 0.01) - b.left;
      const dy = Math.ceil(b.top - 0.01) - b.top;
      if (dx > 0.01) layer.style.left = `${dx}px`;
      if (dy > 0.01) layer.style.top = `${dy}px`;
    }
    for (const r of el.querySelectorAll<HTMLElement>("[data-run]")) {
      r.style.marginLeft = "";
      const x = r.getBoundingClientRect().left;
      const shift = Math.ceil(x - 0.01) - x;
      if (shift > 0.01) r.style.marginLeft = `${parseFloat(getComputedStyle(r).marginLeft) + shift}px`;
    }
  });

  // One page, set for one box: the measured one, or until it is known the box its caller usually gives it
  const setPage = (geo: { w: number; h: number }, layerClass: string) => {
    let drawing: React.ReactNode = null;
    let drawn: Section[] = [];
    let inline: Link[] = [];
    let foot: Link[] = [];
    let folded = 0;
    let openingShown: string | undefined;
    if (geo.w > 64) {
      const { w: W, h: H } = geo;
      const mode = modeOf(W, H);
      const runIn = mode === "run-in";
      const padX = mode === "hero" ? 24 : 16;
      // stacked, the list hangs from the gutter: the first heading's capitals start on the 24px line, so on the
      // hero its baseline lands on the text column's first baseline (37)
      const padTop = runIn ? 8 : 19;
      const cw = W - 2 * padX;

      // The foot. Stacked, it keeps the hero card's own footer rhythm: p-6 (24), the faces row (20, or the 16
      // of the time alone when the doc has no people), pt-3.5 (14), the rule. Side by side with the text column,
      // the rule runs on in line with the card's footer rule and the marks sit on the faces' centre line.
      // Run-in, the cover's own bottom edge is the card's border-b: that hairline is the foot, so the cover
      // draws no second rule above it and the marks stand 14 over it.
      const facesRow = !runIn && large && !getArtifactGraph(a.id).people.length ? 16 : 20;
      const ruleY = runIn ? null : H - 24 - facesRow - 14 - 1;
      const footMid = runIn ? H - 14 : H - 24 - facesRow / 2;
      const listH = ruleY === null ? 0 : ruleY - padTop - 16;
      const numW = mode === "hero" ? 28 : 24;

      const shownN = fitted ? fitted.n : sections.length;
      drawn = sections.slice(0, shownN);
      const cutMarks = runIn ? 0 : sections.slice(shownN).reduce((n, s) => n + s.marks.length, 0);
      inline = runIn ? [] : drawn.flatMap((s) => capInline(s.marks).shown);
      // run-in, every link is on the foot; stacked, the ones tied to no section, and a chip for a cut section's
      const footAll = runIn ? links : links.filter((l) => !l.anchor);
      // On the hero the foot is named, "Woven into", the reader's own label for a document's confirmed links:
      // bare, a row of squares under a rule read as a pager or a legend without a key. Set only when the whole
      // foot fits beside it, so the marks win the room. (The first pass sets it whenever there is a foot, so the
      // fit can measure it.) The portrait and the band have no room for a word and stay bare.
      const labelRoom = fitted ? fitted.labelW + 8 : 0;
      const label =
        mode === "hero" &&
        footAll.length > 0 &&
        (!fitted || rowWidth(footAll) + (cutMarks ? CHIP_ROOM : 0) + labelRoom <= cw);
      const room = runIn ? Math.min(cw, RUN_IN_FOOT) : cw - (label ? labelRoom : 0);
      const fold = foldFoot(footAll, room);
      foot = fold.shown;
      folded = fold.rest + cutMarks;

      // whole lines of run-in text: what the band holds above the foot's row (12 tall and 2 of air), or down to
      // the bottom gutter when the document has no link to stand there
      const runLines = Math.max(1, Math.floor(((links.length ? H - 22 : H - 8) - padTop) / 18));

      // the ordinal, right-aligned on the widest one, so a tenth section does not move the headings' edge
      const digits = String(Math.max(1, sections.length)).length;
      const numeral = (i: number) => (
        <span className="inline-block text-right" style={{ minWidth: `${digits}ch` }}>
          {i + 1}
        </span>
      );

      let page: React.ReactNode = null;
      const rows = fitted ? drawn : sections;
      if (sections.length && mode === "hero") {
        page = (
          <div data-clip="" className="absolute overflow-hidden" style={{ left: padX, top: padTop, width: cw, height: listH }}>
            {rows.map((s, i) => (
              <div key={s.id} data-row="" className="flex items-baseline pb-2">
                <span className="w-7 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {numeral(i)}
                </span>
                <span className="min-w-0 flex-1 text-lg text-foreground">
                  <Heading s={s} />
                </span>
              </div>
            ))}
          </div>
        );
      } else if (sections.length && mode === "portrait") {
        page = (
          <div data-clip="" className="absolute overflow-hidden" style={{ left: padX, top: padTop, width: cw, height: listH }}>
            {rows.map((s, i) => (
              <div key={s.id} data-row="" className="flex items-baseline pb-2">
                <span className="w-6 shrink-0 text-xs tabular-nums text-muted-foreground">
                  {numeral(i)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="overflow-hidden text-base text-foreground" style={{ maxHeight: 44 }}>
                    {s.heading}
                  </p>
                  {s.marks.length ? <MarkRun marks={s.marks} className="h-4" /> : null}
                </div>
              </div>
            ))}
          </div>
        );
      } else if (sections.length) {
        // the headings as one paragraph, joined by commas, a heading never split across lines
        page = (
          <p
            data-clip=""
            className="absolute overflow-hidden text-sm text-foreground"
            style={{ left: padX, top: padTop, width: cw, height: runLines * 18 }}
          >
            {rows.map((s, i) => (
              <React.Fragment key={s.id}>
                <span data-row="" className="inline-block max-w-full">
                  {s.heading}
                  {i < rows.length - 1 ? "," : null}
                </span>
                {i < rows.length - 1 ? " " : null}
              </React.Fragment>
            ))}
          </p>
        );
      } else if (opening) {
        // no sections: the document's opening line, in the prose ink, cut on a whole sentence or clause
        const lh = mode === "hero" ? 24 : mode === "portrait" ? 22 : 18;
        const lines = runIn ? runLines : Math.max(1, Math.floor(listH / lh));
        openingShown = fitted?.text ?? opening;
        page = (
          <p
            data-opening=""
            className={`absolute overflow-hidden text-pretty text-foreground-prose ${
              mode === "hero" ? "text-lg" : mode === "portrait" ? "text-base" : "text-sm"
            }`}
            style={{ left: padX, top: padTop, width: cw, height: lines * lh }}
          >
            {openingShown}
          </p>
        );
      } else {
        // no text at all: a ruled page, one rule on the baseline of each line it would set (the stacked rules
        // start at the headings' edge, leaving the numerals' column empty), on the card's own line token so it
        // holds in dark (line-edge 1.22 light, 1.29 dark; border is 1.14 in dark)
        const ys: number[] = [];
        if (runIn) for (let k = 0; k < runLines; k++) ys.push(padTop + 13 + 18 * k);
        else {
          // as many rows as the list holds (a row is its line and pb-2), so the last rule keeps a row's air above
          // the foot rule rather than a near miss; at most the hero's five, or the tall portrait is a notepad
          const pitch = mode === "hero" ? 32 : 30;
          const base = padTop + (mode === "hero" ? 18 : 16);
          for (let k = 0; k < Math.min(5, Math.floor(listH / pitch)); k++) ys.push(base + pitch * k);
        }
        const x0 = runIn ? padX : padX + numW;
        page = ys.map((y) => (
          <div key={y} className="absolute bg-line-edge" style={{ left: x0, top: y, width: W - padX - x0, height: 1 }} />
        ));
      }

      drawing = (
        <div data-layer="" aria-hidden="true" className={layerClass}>
          {page}
          {ruleY !== null ? (
            <div className="absolute bg-border" style={{ left: padX, top: ruleY, width: cw, height: 1 }} />
          ) : null}
          {foot.length || folded ? (
            <div className="absolute flex h-4 items-center" style={{ left: padX, top: footMid - 8 }}>
              {/* the reader's own name for a document's confirmed links: it makes the row read as links rather
                  than a pager or window controls */}
              {label ? (
                <span data-foot-label="" className="mr-2 whitespace-nowrap text-xs font-medium text-muted-foreground">
                  Woven into
                </span>
              ) : null}
              <span data-run="" className="flex items-center">
                {foot.map((m, i) => (
                  <Mark key={m.id} m={m} ml={i ? gapBefore(foot, i) : 0} />
                ))}
              </span>
              {folded ? (
                <span className={foot.length ? "ml-1.5 flex" : "flex"}>
                  <Chip n={folded} />
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      );
    }
    return { drawing, drawn, inline, foot, openingShown };
  };
  const { drawing, drawn, inline, foot, openingShown } = setPage(
    box ?? (large ? HERO_GUESS : BAND_GUESS),
    !box && large ? "absolute inset-0 hidden lg:block" : "absolute inset-0",
  );
  // and on a phone, where the hero is a strip under the card's text, the strip, until the box is known
  const strip = !box && large ? setPage(STRIP_GUESS, "absolute inset-0 sm:hidden").drawing : null;


  // what is drawn, said: the headings or the opening, and the links by kind, counting only marks on the paper
  const drawnLinks = [...inline, ...foot].sort(byKind);
  const counts = KIND_ORDER.map((k) => [k, drawnLinks.filter((m) => m.kind === k).length] as const).filter(([, c]) => c);
  const hiddenLinks = links.length - drawnLinks.length;
  const parts: string[] = [];
  const names = drawn.map((s) => s.heading).join(", ");
  if (drawn.length && drawn.length < sections.length) {
    parts.push(`Contents, the first ${drawn.length} of ${sections.length} sections: ${names}.`);
  } else if (drawn.length) parts.push(`Contents: ${names}.`);
  else if (openingShown) parts.push(`The opening line: ${openingShown}${/[.!?]$/.test(openingShown) ? "" : "."}`);
  else if (box && !sections.length) parts.push("An empty page.");
  if (counts.length) {
    let woven = `Woven into ${counts.map(([k, c]) => `${c} ${KIND_WORD[k][c === 1 ? 0 : 1]}`).join(", ")}`;
    if (inline.length) woven += `, ${inline.length} of them through a section`;
    if (hiddenLinks > 0) woven += `, and ${hiddenLinks} more`;
    parts.push(`${woven}.`);
  }
  const empty = !sections.length && !opening && !links.length;
  const said = empty ? "An empty page: no text and no confirmed links yet" : parts.join(" ") || "The document's contents";
  const state = drawnLinks.length ? "neighbourhood" : drawn.length || openingShown ? "first-lines" : "alone";

  const root = (
    <div ref={setEl} data-cover={state} role="img" aria-label={said} className="relative h-full w-full overflow-hidden">
      {drawing}
      {strip}
    </div>
  );

  // The name, where the card has no other place for it: a caption under the page on the body rung, on the
  // card's own gutter, the way Are.na captions a block. No caller passes it today.
  if (!title) return root;
  return (
    <div className="flex h-full w-full flex-col">
      <div className="min-h-0 flex-1">{root}</div>
      <p className={`line-clamp-2 text-base font-medium text-foreground ${large ? "px-6 pb-5" : "px-4 pb-3"}`}>{title}</p>
    </div>
  );
}
