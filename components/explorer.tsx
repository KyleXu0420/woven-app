"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocalGraph, GraphLegend } from "./local-graph";
import { TimelineView } from "./timeline-view";
import { useSearch } from "./search";
import { EntityProfile } from "./entity-profile";
import { PageBreadcrumb } from "./page-heading";
import { FeedHead } from "./inbox-agent-band";
import { ViewTabs, SegToggle, DIVIDED_FLUSH, FOCUS_RING } from "./controls";
import { MENU_SURFACE } from "./classes";
import { NodeMark } from "./entity-profile";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CONFIDENCE_COPY, confidenceLevel } from "./confidence";
import { getNeighborhood, verifyEdge, restoreEdge, listPending, getArtifact, getArtifactEvidence, getBlocks, sourceById } from "@/lib/api";
import { bumpGraph } from "@/lib/store";
import { toasts } from "@/lib/notifications";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { EdgeType, GraphEdge, GraphNode, Neighborhood, RefKind } from "@/lib/types";

// SubjectSwitcher — WHICH topic (or person) the explorer is centred on, and it IS the page's h1: the
// subject's kind-mark, its name and a chevron at the title rung, under a small muted eyebrow that names the
// section ("Topics"). For six rounds the h1 was the section ("Topics", with a hint glyph) and the subject
// stood beside it at the same size, and six blind verdicts in a row ranked the same defect first: two titles
// on one line, the label and the control undifferentiated, the ⓘ a stock tell beside a heading. The
// product already answers this on the collection page — the eyebrow "Collections" over the collection's own
// name as the h1 — so the explorer takes the same shape: the section is the crumb (PageBreadcrumb, the
// detail page's one line), the subject is the only large thing on the page. No hint: the empty state
// explains the page the one time it needs explaining.
//
// The mark leads the title in the graph's own alphabet (shape = kind, hue = identity — the hexagon the
// subject wears on the canvas) at the title's CAP HEIGHT, 20 (Geist's cap is 0.71 of the 28): at 16 it sat
// under the capitals and read as a bullet in front of the name, not as the subject's own letter. The
// chevron is 20, muted (the nearest rung under the title's ink), tight to the name's last glyph (ml-0.5;
// the glyph's inner padding does the rest) — the only hint the title is a picker — and it flips when the
// menu is open. The whole title is the trigger, and the hover ground is on the NAME alone (tint-1,
// rounded-md, -mx-1 / px-1 so the glyphs stay on the text edge and the ground bleeds 4px past them): a
// title that reads as pressable, not a button holding a title.
//
// Open, the title BECOMES the input: the name gives way to a field of the same size and weight carrying
// the name as its placeholder, and typing filters the list at once. There is no search row inside the
// popup — a search field on top of a five-item menu was a command palette wearing a picker's clothes.
// The list drops from under the NAME, its left edge on the title's text edge (left-7.5: the mark and its
// gap), so the menu is the name opening and not a card hung from the mark — with the edge on the mark two
// verdicts in a row read it as hanging under the hexagon. It is a BARE list, a menu and not a table: each
// row its name and, at the trailing edge, its count and the slot for the tick. NO mark on the rows: the
// five topics' hues (rose, plum, slate, ocean, gold) sit close enough on the warm wheel that a row of five
// marks could not be told apart, and a mark that cannot be told from its neighbour says nothing a name
// does not; the title carries the one mark that matters. The count is the same figure on every row —
// the subject's DIRECT ties, the number the depth switch's "Direct" reads for the current one, so
// "Activation 4" in the menu and "Direct 4" on the tab row are visibly one number — and the current row
// keeps it (the tick took its place for a round, and the one row without a figure was the one the reader
// was on). Rows are in MUTED ink; the current subject alone is in full ink at the row's weight and carries
// the tick after its count. The highlight (pointer or arrows) lifts a row to full ink on a tint-1 wash;
// NO wash at open — nothing is highlighted until one of them moves. On the menu material (one rung
// lighter than a popover's shadow). Arrow keys move the highlight (starting from the current subject),
// Enter picks, Escape puts the name back. Sorted by that count so the busiest subjects lead. Not the
// Popover primitive: its anchor must be a trigger it owns, and the anchor here is an input that replaces
// the trigger, so the popup is drawn by hand.
function SubjectSwitcher({
  entities,
  kind,
  currentId,
  onSelect,
  noun,
  nounPlural,
}: {
  entities: { id: string; name: string }[];
  kind: RefKind;
  currentId: string;
  onSelect: (id: string) => void;
  noun: string;
  nounPlural: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  // -1 = no row highlighted (the state the menu opens in); the pointer or the arrows set it
  const [active, setActive] = React.useState(-1);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const refocus = React.useRef(false);
  const listId = React.useId();
  const current = entities.find((e) => e.id === currentId);
  const ql = q.trim().toLowerCase();
  // the row's figure is the subject's direct neighbours — what "Direct N" on the tab row reads once it is
  // the subject — not its tie count (a neighbour tied twice is one neighbour, and the two figures differed)
  const directOf = React.useMemo(() => new Map(entities.map((e) => [e.id, getNeighborhood(e.id, 1).nodes.length - 1])), [entities]);
  const shown = entities
    .filter((e) => e.name.toLowerCase().includes(ql))
    .sort((a, b) => (directOf.get(b.id) ?? 0) - (directOf.get(a.id) ?? 0));
  const currentIx = shown.findIndex((e) => e.id === currentId);

  function close(back: boolean) {
    refocus.current = back;
    setOpen(false);
    setQ("");
    setActive(-1);
  }
  function pick(id: string) {
    onSelect(id);
    close(true);
  }

  // the trigger unmounts while the field is up; hand focus back to it once it is there again
  React.useEffect(() => {
    if (!open && refocus.current) {
      refocus.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  // a press anywhere outside the title and its list puts the name back
  React.useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // the highlighted row stays in view as the arrow keys move it
  React.useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>("[data-active]")?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      // the first arrow lands on the current subject (where the reader is), the next ones walk from there
      setActive((i) => (shown.length ? (i < 0 ? Math.max(currentIx, 0) : (i + 1) % shown.length) : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (shown.length ? (i < 0 ? Math.max(currentIx, 0) : (i - 1 + shown.length) % shown.length) : -1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      // Enter with nothing highlighted takes the first match — what typing a name and pressing Enter means
      const target = shown[active] ?? (ql ? shown[0] : undefined);
      if (target) pick(target.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close(true);
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  // one box for both states, so nothing on the line moves when the name becomes a field. No padding of its
  // own: the mark sits on the text edge (the crumb's), and the hover ground belongs to the name. The mark
  // carries its own gap (mr-2.5) and the chevron its own (ml-0.5) — two different distances; the menu's
  // left-7.5 below is the mark and its gap, so the menu's edge is the name's.
  const box = "inline-flex min-w-0 max-w-full items-center text-left";
  const mark = current ? <NodeMark node={{ id: current.id, kind }} className="mr-2.5 size-5" /> : null;
  // the chevron flips when the menu is open — the one moving part of the title, and the reader's proof
  // that the field under the pointer is the same control they pressed
  const chevron = (
    <ChevronDown className={cn("ml-0.5 size-5 shrink-0 text-muted-foreground", open && "rotate-180")} aria-hidden="true" />
  );
  return (
    // `relative`: the list positions against this box, whose left edge is the title's text edge
    <div
      ref={rootRef}
      className="relative"
      onBlur={(e) => {
        // focus leaving the title AND its list (a Tab away) puts the name back; a click on a row keeps
        // focus in the field (the row's pointerdown is prevented), so it never fires for a pick
        if (open && !rootRef.current?.contains(e.relatedTarget as Node)) close(false);
      }}
    >
      {/* the h1 is the subject — one title on the page, at the title rung (28/500), and it is the switcher */}
      <h1 className="text-2xl font-medium">
        {open ? (
          <span className={box}>
            {mark}
            {/* the field and a sizer share one grid cell, so the field is exactly as wide as the name it
                stands in for (and grows with what is typed) — the chevron holds its place. size={1}: a
                field's own intrinsic width is twenty characters, and the grid track took it over the sizer. */}
            <span className="inline-grid min-w-0">
              <span aria-hidden="true" className="invisible col-start-1 row-start-1 whitespace-pre">
                {q || current?.name || `Pick a ${noun}`}
              </span>
              <input
                autoFocus
                size={1}
                role="combobox"
                aria-expanded="true"
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={shown[active] ? `${listId}-${shown[active].id}` : undefined}
                aria-label={`Search ${nounPlural}`}
                value={q}
                placeholder={current?.name ?? `Pick a ${noun}`}
                onChange={(e) => {
                  setQ(e.target.value);
                  setActive(-1);
                }}
                onKeyDown={onKey}
                className="col-start-1 row-start-1 w-full min-w-0 bg-transparent p-0 text-2xl font-medium text-foreground outline-none placeholder:text-muted-foreground"
              />
            </span>
            {chevron}
          </span>
        ) : (
          <button
            ref={triggerRef}
            type="button"
            data-subject-switcher=""
            aria-haspopup="listbox"
            aria-expanded="false"
            aria-label={`Change ${noun}`}
            onClick={() => setOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
              }
            }}
            className={cn(box, "group rounded-md text-foreground", FOCUS_RING)}
          >
            {mark}
            {/* the ground on the name only: -mx-1 / px-1 keep the first glyph on the text edge and let the
                tint bleed 4px past the word on either side; the mark and the chevron stay on the page */}
            <span className="-mx-1 min-w-0 truncate rounded-md px-1 transition-colors group-hover:bg-tint-1">
              {current?.name ?? `Pick a ${noun}`}
            </span>
            {chevron}
          </button>
        )}
      </h1>
      {open ? (
        // under the name, its left edge on the title's text edge (left-7.5 = the 20px mark + its 10px gap);
        // w-64: five names and their counts — a menu is as wide as its rows
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={nounPlural}
          className={cn(MENU_SURFACE, "scrollbar-subtle absolute top-full left-7.5 z-50 mt-1 flex max-h-72 w-64 flex-col overflow-y-auto")}
        >
          {shown.length ? (
            shown.map((e, i) => {
              const sel = e.id === currentId;
              return (
                <div
                  key={e.id}
                  id={`${listId}-${e.id}`}
                  role="option"
                  aria-selected={sel}
                  data-active={i === active ? "" : undefined}
                  onPointerMove={() => setActive(i)}
                  onPointerDown={(e) => e.preventDefault()}
                  onClick={() => pick(e.id)}
                  // one highlight for pointer and keyboard (the row the arrows are on IS the hovered row), and
                  // none until one of them moves. Muted rows, the current subject in full ink and the row's
                  // weight — the tab strip's "the one you are on" — and the highlight lifts a row to full ink
                  // on the wash.
                  className={cn(
                    "flex cursor-default items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors data-active:bg-tint-1 data-active:text-foreground",
                    sel ? "font-medium text-foreground" : "text-muted-foreground",
                  )}
                >
                  <span className="min-w-0 flex-1 truncate">{e.name}</span>
                  {/* the count is inventory: muted, tabular, on every row — the current one too, so the
                      column has one meaning down its length; then the tick's slot, filled only on the
                      current row — a bare tick is the house's "this one", in the row's own ink */}
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{directOf.get(e.id) ?? 0}</span>
                  <span className="flex size-4 shrink-0 items-center justify-center">
                    {sel ? <Check className="size-4" aria-hidden="true" /> : null}
                  </span>
                </div>
              );
            })
          ) : (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No matches.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

// The tie read from the ROW's side with the other end left unsaid, because something on screen already names
// it — [row is `from`, row is `to`]. On a direct row the other end is the page's subject; on a second-hop row it
// is the hub the group's band names. "Ana: authored" under an artifact on Ana's page is "Ana authored this";
// "Q4 launch plan: linked from" under the band "Through Notification strategy v3" is "linked from it".
const AS_ROW: Record<EdgeType, [string, string]> = {
  links_to: ["links to", "linked from"],
  sourced_from: ["sourced from", "source for"],
  mentions: ["mentions", "mentioned in"],
  in_collection: ["in", "contains"],
  authored_by: ["by", "authored"],
  decided: ["decided", "decided in"],
  supersedes: ["supersedes", "superseded by"],
};

// a tie's relation word — the tie's KIND from the row's side ("mentions", "linked from", "source for").
function relationWord(rowId: string, e: GraphEdge): string {
  return e.from === rowId ? AS_ROW[e.type][0] : AS_ROW[e.type][1];
}

// WHERE the tie lives, for a tie with an anchor: the section of the artifact the mention sits in ("in
// Goals"). Only an artifact row has evidence to read; a mention with no anchor stays silent, and the cell is
// simply empty — a muted qualifier or nothing, the same slot on every row. A proposed tie's rationale is NOT
// here any more: the agent's sentence sat in this slot on one row beside "in Goals" on another, a paragraph
// at a phrase's rhythm, and the row broke the list's meter. The sentence is in the peek on the status word
// (ProposedPeek), one hover away, where a reason belongs.
function detailFor(row: GraphNode, e: GraphEdge): string | null {
  if (row.kind === "artifact") {
    const blockId = getArtifactEvidence(row.id).find((ev) => ev.edge_id === e.id)?.block_id;
    const heading = blockId ? getBlocks(row.id).find((b) => b.id === blockId)?.heading : undefined;
    if (heading) return `in ${heading}`;
  }
  return null;
}

// when the thing at the row's end was last touched: an artifact's own age, or when a source was captured.
// A source had no age here and the second hop (mostly sources and people) lost the column, so the list
// broke into a half with ages and a half without. A person or a collection has no "when"; its cell holds
// a deliberate dash (see RelationRow) — a row with an empty kind cell and an empty age cell ("Maya Chen",
// a person mentioned by a hub) read as a row that had lost its columns, not as a row with nothing to say.
function ageOf(node: GraphNode): string | undefined {
  if (node.kind === "artifact") return getArtifact(node.id)?.updated;
  if (node.kind === "source") return sourceById(node.id)?.at;
  return undefined;
}

// ProposedPeek — a proposed tie's status on the row, and its REASON one hover away. At rest the row says
// "proposed" in muted ink, and the confidence word only when it earns its ink (settled 2026-09-12: high
// silent, likely muted, unsure full ink — a demand on the reviewer; it is the one weighted word in the
// row's secondaries, and that is the rule's point). The word "proposed" stays because the row's mark cannot
// say it: the mark is the NODE — its kind, its hue, dashed only while the node itself is still being woven —
// and the tie's provenance is a fact about the tie, which the list does not draw (the canvas dashes the
// line). The peek carries what the row no longer does: the agent's rationale as prose, and the confidence
// in the Inbox card's own words with its figure — the house's hover-peek (a Popover that opens on hover),
// the same one the confidence word wears in Inbox.
function ProposedPeek({ edge }: { edge: GraphEdge }) {
  const level = edge.confidence != null ? confidenceLevel(edge.confidence) : "high";
  const rationale = listPending().find((p) => p.edge_id === edge.id)?.rationale;
  const { word, guidance } = CONFIDENCE_COPY[level];
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        openOnHover
        delay={120}
        // `relative`: above the name's stretched hit area, so the hover lands on the word and not the row
        render={<span className="relative shrink-0 cursor-help whitespace-nowrap text-sm text-muted-foreground outline-none" />}
      >
        proposed
        {level === "likely" ? ", likely" : null}
        {level === "unsure" ? (
          <>
            {", "}
            <span className="font-medium text-foreground">unsure</span>
          </>
        ) : null}
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-72 p-3">
        {rationale ? <p className="text-sm text-foreground-prose">{rationale}</p> : null}
        <p className={cn("flex items-baseline gap-2 text-sm", rationale && "mt-2")}>
          <span className="font-medium">{word}</span>
          <span className="text-muted-foreground">{guidance}</span>
          {edge.confidence != null ? (
            <span className="ml-auto text-xs tabular-nums text-muted-foreground">{Math.round(edge.confidence * 100)}%</span>
          ) : null}
        </p>
      </PopoverContent>
    </Popover>
  );
}

// one neighbour, ONE line, in the same slots on every row: the kind-mark, the name, then (muted, or nothing)
// where the tie lives, then at the trailing end a proposed tie's status word, the tie's KIND — only when the
// rows differ in it — and the age. Where and what-state are two kinds of fact, and they were two muted
// phrases side by side after the name ("in Goals", "proposed, unsure"), read as one kind: the qualifier
// stays with the name (it is about the name), the status is a trailing word (the review panel's rule — a
// row's state is its trailing word), and the two registers are told apart by where they sit, not by ink.
// The kind column ("mentions", "linked from", "source for", "authored";
// see relationWord) is drawn only when the list has more than one word in it: under Direct on a topic every
// row was a mention, and "mentions" four times down a column was the page's premise restated on every line
// (a topic is in the graph because artifacts mention it). When the rows DO differ (the second hop: "linked
// from", "source for", "decided in") the word is a fact the row needs, and then every row carries one so the
// column holds. Decided once for the whole list (ListView), never per group — a column that appeared in one
// group and not the next was the round-5 defect. The age (12 tabular, muted): the collection list's own
// trailing column, on every row — a person has no "when", and its cell says so with a dash in the glyph ink,
// where an empty cell beside another empty cell was a row with no columns at all. The name gives way first
// (it has a fuller form one click away); the detail truncates after it; the kind and the age never do. A node
// the graph draws dashed (still being processed) is dashed here too — the provenance vocabulary holds between
// the views.
//
// The row is a div and the NAME is the button, stretched over the whole row (after:absolute inset-0) so the
// row is one hit area and one focus stop: the row was a button, and a button may not hold the status word's
// peek (a popover trigger is interactive content). The ring is the row's, summoned by the button's focus.
function RelationRow({
  node,
  edge,
  detail,
  kind,
  onSelect,
}: {
  node: GraphNode;
  edge: GraphEdge;
  detail: string | null;
  kind: string | null; // the tie's word, or null when the list has one word only (see above)
  onSelect: (id: string) => void;
}) {
  const proposed = edge.prov === "ai_generated";
  const age = ageOf(node);
  return (
    <div className="relative flex items-center gap-3 py-2.5 transition-colors hover:bg-tint-1 has-[>button:focus-visible]:ring-2 has-[>button:focus-visible]:ring-inset has-[>button:focus-visible]:ring-focus">
      {/* the graph's letter at 12px — the same size the picker's rows use, one alphabet at one size across
          the page. At 14 the filled square outweighed the 15px title beside it; at 10 the topic's hexagon
          had collapsed into a dot and the shape stopped saying the kind. */}
      <NodeMark node={{ id: node.id, kind: node.kind }} className="size-3" pending={node.state === "processing"} />
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        className="min-w-0 truncate text-left text-base font-medium outline-none after:absolute after:inset-0 after:content-['']"
      >
        {node.label}
      </button>
      {detail ? <span className="min-w-0 truncate text-sm text-muted-foreground">{detail}</span> : null}
      {/* the trailing cluster: status (only a proposed tie has one), kind (only when the list has more than
          one word), age (always). ml-auto on the first of them that is drawn. */}
      {proposed ? (
        <span className="ml-auto flex shrink-0 justify-end">
          <ProposedPeek edge={edge} />
        </span>
      ) : null}
      {/* w-28 holds the longest kind ("superseded by") without a jog; w-14 the longest age ("17m", "3d") */}
      {kind ? <span className={cn("w-28 shrink-0 truncate text-sm text-muted-foreground", !proposed && "ml-auto")}>{kind}</span> : null}
      <span className={cn("flex w-14 shrink-0 justify-end text-xs tabular-nums text-muted-foreground", !kind && !proposed && "ml-auto")}>
        {age ?? (
          <span aria-label="no date" className="text-foreground-hint">
            —
          </span>
        )}
      </span>
    </div>
  );
}

// ListView — the focus's neighbourhood AS A LIST, as far out as the depth setting reaches. The setting is
// the page's — it sits on the tab row, one control for every view — and the list honours it: at Direct it is
// the direct ties and nothing else; at the wider reach the direct ties come first under a band that says
// which they are ("Direct 4" — the switch's own word and figure) and then, a step further, each first-ring
// neighbour's own ties under a band that names the hop ("Through Notification strategy v3 15", its mark
// leading, its count as inventory). One group is not headed (the switch above it already says "Direct 4",
// and a band saying it again would be the setting stated twice); groups are headed when there is more than
// one, and then every group is, so the first "Through …" band never arrives after four bare rows looking
// like a row that was selected. The rows start IMMEDIATELY under the tab row's hairline — that rule is the
// list's first rule; the list had a control row of its own under the tabs (the depth switch, seated in the
// view's corner) and started a full row late under it. "The list is the truth; the graph is the show me"
// — same data, listed instead of drawn. Click a row to re-focus there.
function ListView({
  nb,
  wide,
  deep,
  onSelect,
}: {
  nb: Neighborhood; // the direct neighbourhood
  wide: Neighborhood; // the two-hop one
  deep: boolean; // the depth setting: false = Direct, true = the wider reach
  onSelect: (id: string) => void;
}) {
  const byId = new Map(wide.nodes.map((n) => [n.id, n]));
  // one row per direct tie (a neighbour tied twice is listed twice — each tie is its own fact)
  const direct = nb.edges
    .filter((e) => e.from === nb.centerId || e.to === nb.centerId)
    .map((e) => ({ edge: e, node: byId.get(e.from === nb.centerId ? e.to : e.from) }))
    .filter((r): r is { edge: GraphEdge; node: GraphNode } => !!r.node);
  // the second hop, grouped by the first-ring neighbour it hangs off: each node a step further listed once,
  // under the first hub (in the direct rows' order) that reaches it, with that tie. Hubs by their reach,
  // the busiest first — the order the picker and the graph's sectors already use.
  const hubs = new Map<string, { hub: GraphNode; rows: { edge: GraphEdge; node: GraphNode }[] }>();
  for (const r of direct) if (!hubs.has(r.node.id)) hubs.set(r.node.id, { hub: r.node, rows: [] });
  for (const n of wide.nodes) {
    if (n.depth !== 2) continue;
    for (const [hubId, g] of hubs) {
      const edge = wide.edges.find((e) => (e.from === n.id && e.to === hubId) || (e.to === n.id && e.from === hubId));
      if (edge) {
        g.rows.push({ edge, node: n });
        break;
      }
    }
  }
  const groups = deep ? [...hubs.values()].filter((g) => g.rows.length).sort((a, b) => b.rows.length - a.rows.length) : [];
  const headed = groups.length > 0;
  // the kind column is drawn only when the rows shown do not all say the same word (see RelationRow) —
  // decided over every row on the page at once, so the column is there on all of them or on none
  const words = new Set([...direct, ...groups.flatMap((g) => g.rows)].map((r) => relationWord(r.node.id, r.edge)));
  const kindOf = (r: { edge: GraphEdge; node: GraphNode }) => (words.size > 1 ? relationWord(r.node.id, r.edge) : null);

  return (
    <div>
      {direct.length ? (
        <>
          {/* the first group's band, only when there is a second group: the switch's word for this
              reach, its count as inventory */}
          {headed ? (
            <FeedHead count={direct.length} kind="inventory">
              Direct
            </FeedHead>
          ) : null}
          <div className={cn(DIVIDED_FLUSH, "border-b border-border")}>
            {direct.map((r) => (
              <RelationRow key={r.edge.id} node={r.node} edge={r.edge} detail={detailFor(r.node, r.edge)} kind={kindOf(r)} onSelect={onSelect} />
            ))}
          </div>
        </>
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">No relations yet.</p>
      )}
      {groups.map((g) => (
        <React.Fragment key={g.hub.id}>
          {/* the hop's band: the hub's own mark leads (the band's identity slot), the count is inventory */}
          <FeedHead lead={<NodeMark node={{ id: g.hub.id, kind: g.hub.kind }} className="size-3" />} count={g.rows.length} kind="inventory">
            <span className="flex min-w-0 items-baseline gap-1">
              <span className="shrink-0">Through</span>
              <span className="min-w-0 truncate text-foreground">{g.hub.label}</span>
            </span>
          </FeedHead>
          <div className={cn(DIVIDED_FLUSH, "border-b border-border")}>
            {g.rows.map((r) => (
              // the hub is unsaid in the row: the band names it; the row keeps where its tie lives and,
              // when the list has more than one word, what kind of tie it is
              <RelationRow key={r.node.id} node={r.node} edge={r.edge} detail={detailFor(r.node, r.edge)} kind={kindOf(r)} onSelect={onSelect} />
            ))}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// GraphView — the relationship view: the field straight on the page ground (no card, no border), starting
// directly under the tab row's hairline. The depth switch is not in here any more — it sat in the field's
// top-right corner, and a setting that governs every view drawn as a canvas-corner control said "a knob of
// this drawing"; it is on the tab row now, with the view it belongs beside. The KEY is here: the house's
// hover ⓘ in the field's corner (GraphLegend, the collection map's and the team field's), because the
// drawing speaks in six shapes, a dash and a dozen hues, and a reader who does not know the alphabet had
// no way to learn it on the page — the one thing a legend is for, and the reason it is a hover and not a
// row of chrome.
function GraphView({
  nb,
  wide,
  centerId,
  previewIds,
  onSelect,
  onVerifyEdge,
}: {
  nb: Neighborhood;
  wide: Neighborhood;
  centerId: string;
  previewIds?: string[];
  onSelect: (id: string) => void;
  onVerifyEdge?: (edgeId: string, action: "confirm" | "discard") => void;
}) {
  return (
    // the names' knockout paints in the ground colour; this field is the page, not a card
    <div className="relative" style={{ "--graph-ground": "var(--background)" } as React.CSSProperties}>
      {/* click a node → peek it in a popover anchored AT the node (no card docked below the canvas, which
          would just re-list the graph); re-centering the explorer is the peek's deliberate "Focus here"
          action, and a proposed (dashed) edge is confirmable in place via onVerifyEdge.
          radial, laid out on the WIDE neighbourhood at every reach: the inner ring's sectors are sized by
          each neighbour's second-hop weight, and they hold still when the outer ring appears, so the hover
          preview adds nodes without moving the ones already there. fullLabels + namedDepth=2: every name
          written out in full where it fits — the subject's in full ink, the first ring's muted, the second
          ring's one step lighter (and culled where the fan is too tight for a name) — so the wider reach,
          previewed or chosen, says what is there and not only that there is a lot. outerRing="full": a ring
          the reader asked for is drawn in full ink. labelRule="below": one placement for every name. The
          svg is capped at 650, which at the 520-unit box is a 1.25 scale: the subject's 12-unit name lands
          on the 15 rung and a neighbour's 10.5 on 13 — the two rungs the page's rows use, not a size of the
          canvas's own. */}
      <LocalGraph
        data={nb}
        layoutData={wide}
        layout="radial"
        fullLabels
        namedDepth={2}
        outerRing="full"
        labelRule="below"
        previewIds={previewIds}
        className="max-w-[650px]"
        onSelect={() => {}}
        onVerifyEdge={onVerifyEdge}
        renderPopover={(id, api) => {
          const n = nb.nodes.find((x) => x.id === id);
          if (!n) return null;
          return (
            <EntityProfile
              node={n}
              placement="popover"
              onSelect={(relId) => {
                onSelect(relId);
                api.close();
              }}
              primaryAction={
                id === centerId
                  ? undefined
                  : { label: "Focus here", onClick: () => { onSelect(id); api.close(); }, icon: Crosshair }
              }
            />
          );
        }}
      />
      {/* the key, in the field's corner as on the collection map: hue is a collection's or the thing's own */}
      <GraphLegend colorLabel="Its collection's, or its own" colorDot={false} className="absolute top-3 left-0" />
    </div>
  );
}

// Explorer — the shell. Three choices of three kinds, each in its own material so the reader can tell
// at a glance which changes WHAT they look at, which changes HOW it is shown, and which is a setting:
//   the subject  — the page's h1: its mark (at cap height) and name at the title rung under the section's
//                  eyebrow (a crumb, linking back to the section), a switcher (name + chevron) — the
//                  loudest, it carries the one colour
//   the view     — ViewTabs, the page-level control (underline, forest) — the middle weight
//   the depth    — a SegToggle at its small size on the tab row's trailing end, ONE state the list and
//                  the graph both honour — the quietest; the timeline is the subject's own history and
//                  has no reach to set, so the slot is empty there
// Two lines of chrome over one hairline: the title, then the row that chooses the view and the reach;
// the content starts under the hairline. (See woven/product/explorer-framework.md.)
export function Explorer({
  entities,
  entityKind,
  section,
  entityNoun = "entity",
  entityNounPlural = "entities",
}: {
  entities: { id: string; name: string }[];
  // the kind every entity here is (a topic, a person) — the switcher's menu draws each row's kind-mark
  entityKind: RefKind;
  // the section this explorer is one page of ("Topics", "People") — the eyebrow over the subject's name,
  // linking back to the section's own route (/topics, /people), the way the collection page's eyebrow
  // "Collections" links to the library
  section: string;
  entityNoun?: string;
  entityNounPlural?: string;
}) {
  useGraphVersion(); // re-render after an in-graph verify/undo so the field reflects it
  // a ?focus=<id> deep-link (from ⌘K opening a person/topic while NOT already on this page) seeds the center;
  // without this the Explorer hard-centered on entities[0], landing on the wrong entity. Re-centers if it changes.
  const params = useSearchParams();
  const focusParam = params.get("focus");
  const [centerId, setCenterId] = React.useState(() =>
    focusParam && entities.some((e) => e.id === focusParam) ? focusParam : entities[0]?.id ?? "",
  );
  const [view, setView] = React.useState("graph");
  const [depth, setDepth] = React.useState("1");
  // the depth option the pointer rests on — "2" while hovering the wider reach ghosts the outer ring in
  const [peek, setPeek] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (focusParam && entities.some((e) => e.id === focusParam)) setCenterId(focusParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParam]);

  // register this explorer's re-center fn so the global search's "Find → Focus on this" lands here
  const { registerFocus } = useSearch();
  React.useEffect(() => {
    registerFocus(setCenterId);
    return () => registerFocus(null);
  }, [registerFocus]);

  // calm one-line empty state — no broken chrome (garbage center node) when a space has no topics/people
  // yet. With no subject to be the title, the section is: the one h1 the page has.
  if (!entities.length) {
    return (
      <div>
        <h1 className="text-2xl font-medium">{section}</h1>
        <div className="mt-6 rounded-lg bg-card py-16 text-center text-sm text-muted-foreground">
          No {entityNounPlural} yet — they emerge as Woven weaves your artifacts.
        </div>
      </div>
    );
  }

  // both reaches, always: the counts on the depth switch say what each shows before it is chosen
  const nbDirect = getNeighborhood(centerId, 1);
  const nbWide = getNeighborhood(centerId, 2);
  const directCount = nbDirect.nodes.length - 1;
  const wideCount = nbWide.nodes.length - 1;
  const previewing = depth === "1" && peek === "2" && wideCount > directCount;
  const nb = depth === "2" || previewing ? nbWide : nbDirect;
  // the ghost is everything the wider reach ADDS: its ring, and any tie the direct view does not draw
  // (a tie between two direct neighbours is only picked up on the second hop)
  const previewIds = previewing
    ? [
        ...nbWide.nodes.filter((n) => n.depth === 2).map((n) => n.id),
        ...nbWide.edges.filter((e) => !nbDirect.edges.some((d) => d.id === e.id)).map((e) => e.id),
      ]
    : undefined;
  const center = nb.nodes.find((n) => n.depth === 0);

  // a proposed (dashed) edge is confirmable IN the graph — verifyEdge + a toast with Undo, then re-render
  function resolve(edgeId: string, action: "confirm" | "discard") {
    const p = listPending().find((x) => x.edge_id === edgeId);
    const label = p ? `${p.fromLabel} → ${p.toLabel}` : "link";
    const prev = verifyEdge(edgeId, action);
    bumpGraph();
    const undo = prev ? { label: "Undo", onClick: () => { restoreEdge(prev); bumpGraph(); } } : undefined;
    if (action === "confirm") toasts.linkConfirmed(label, undo);
    else toasts.proposalDismissed(label, undo);
  }

  // the depth switch — ONE element, one state, a PAGE setting: it rides the tab row's trailing end, on the
  // tabs' baseline, inside the one row that carries the hairline. For six rounds it sat inside the view
  // it governed (the graph's corner, then the list's too), and the seat said "a knob of this canvas" while
  // the thing it sets applies to every view; it also cost the content a hollow row under the tab hairline
  // to house it. At the SegToggle's small size (12, one rung under the 13 tabs — the house's in-view switch,
  // its track and thumb, never restyled into bare words): the quietest of the page's three choices wears
  // the quietest form the house takes. Its two options are two parallel states of one dial, each with the
  // number it shows — "Direct 4" and "Nearby 28" — in the tab's own label + bare count grammar. "Nearby",
  // not "Within 2 hops": a hop is graph theory, and a setting that needs the reader to know what a hop is
  // has the wrong label; the counts say the second contains the first, and the list's own bands ("Direct
  // 4", then "Through …") say how. Hovering the wider state previews it: the ghost ring shows what it would
  // add (GraphView), the count stays muted until the click commits (SegToggle).
  const depthEl = (
    <SegToggle
      ariaLabel="Reach"
      size="sm"
      options={[
        { id: "1", label: "Direct", count: directCount },
        { id: "2", label: "Nearby", count: wideCount },
      ]}
      value={depth}
      onChange={setDepth}
      onHover={setPeek}
    />
  );
  return (
    <div>
      {/* the eyebrow: the section, in the detail page's crumb register, linking to the section's route —
          the page is one subject of many, and this line is where that hierarchy lives, so the h1 can be
          the subject alone. mb-3: the collection page's distance between its crumb and its name. */}
      <PageBreadcrumb trail={[{ label: section, href: `/${section.toLowerCase()}` }]} className="mb-3" />
      {/* the title: the subject's mark and name, and the switcher (see SubjectSwitcher) */}
      <SubjectSwitcher
        entities={entities}
        kind={entityKind}
        currentId={centerId}
        onSelect={setCenterId}
        noun={entityNoun}
        nounPlural={entityNounPlural}
      />

      {/* the view — the one page-level switch: three lenses on the same subject — with the reach at its
          trailing end. The timeline is the subject's own history (nodeTimeline) and has no reach to set,
          so the slot is empty there: a control that changes nothing is worse than a slot that is empty. */}
      <div className="mt-5">
        <ViewTabs
          ariaLabel="View"
          options={[
            { id: "list", label: "List" },
            { id: "graph", label: "Graph" },
            { id: "timeline", label: "Timeline" },
          ]}
          value={view}
          onChange={setView}
          trailing={view === "timeline" ? undefined : depthEl}
        />
      </div>

      {/* no gap: the header closes with the tab row's hairline and the view starts under it — the list's
          first row, the graph's field, the timeline's own top padding */}
      <div data-explorer-view={view}>
        {view === "timeline" ? (
          center ? (
            <TimelineView center={center} />
          ) : (
            <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
              Select an entity to explore.
            </div>
          )
        ) : view === "list" ? (
          <ListView nb={nbDirect} wide={nbWide} deep={depth === "2"} onSelect={setCenterId} />
        ) : (
          <GraphView nb={nb} wide={nbWide} centerId={centerId} previewIds={previewIds} onSelect={setCenterId} onVerifyEdge={resolve} />
        )}
      </div>
    </div>
  );
}
