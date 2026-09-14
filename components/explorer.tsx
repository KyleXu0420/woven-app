"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";
import { Check, ChevronDown, Crosshair } from "lucide-react";
import { cn } from "@/lib/utils";
import { LocalGraph } from "./local-graph";
import { TimelineView } from "./timeline-view";
import { useSearch } from "./search";
import { EntityProfile } from "./entity-profile";
import { PageHeading } from "./page-heading";
import { FeedHead } from "./inbox-agent-band";
import { ViewTabs, SegToggle, DIVIDED_FLUSH, FOCUS_RING } from "./controls";
import { MENU_SURFACE } from "./classes";
import { NodeMark } from "./entity-profile";
import { confidenceLevel } from "./confidence";
import { getNeighborhood, relationCount, verifyEdge, restoreEdge, listPending, getArtifact, getArtifactEvidence, getBlocks, sourceById } from "@/lib/api";
import { bumpGraph } from "@/lib/store";
import { toasts } from "@/lib/notifications";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { EdgeType, GraphEdge, GraphNode, Neighborhood, RefKind } from "@/lib/types";

// SubjectSwitcher — WHICH topic (or person) the explorer is centred on: the subject's own kind-mark and name
// at the TITLE rung, on the h1's line, with a chevron. The h1 ("Topics", with its hint) is the page's and stays
// as it is app-wide; the subject is the second half of the title line, parted from the h1 by air alone. It was
// parted by a slash (round 2) and then by a vertical hairline (round 4), and both read as a breadcrumb — a
// glyph between two words on a title line says "path", whatever glyph it is, and a path makes the subject a
// crumb under its container. The h1's hint glyph already ends the h1; the subject starts after a gap.
//
// The mark is what tips the line toward the subject. Both halves sit on the same rung at the same weight (the
// h1's rung is fixed), and the first noun on a line wins by position; the mark is the one colour on the line,
// the hexagon the subject wears on the canvas in its own identity hue, so the eye lands on the subject and the
// title says what the reader is looking at in the graph's own alphabet (shape = kind, hue = identity). The
// same mark leads every row of the menu. The chevron is 20, small against the rung, in muted ink — the only
// hint the name is a picker — and it sits TIGHT to the name's last glyph (ml-0.5, the glyph's own inner
// padding does the rest): at a word-gap's distance it floated between the name and whatever came next and
// belonged to neither. The whole name is the trigger; hover washes it (tint-1, hugging the text — the rail's
// workspace-switcher grammar: name + chevron, no box at rest).
//
// Open, the title BECOMES the input: the name gives way to a field of the same size and weight carrying
// the name as its placeholder, and typing filters the list at once. There is no search row inside the
// popup — a search field on top of a five-item menu was a command palette wearing a picker's clothes.
// The list drops from the TITLE LINE, not from the name: its left edge on the h1's text edge, 4px under the
// line, as wide as the line and never under 320. Hung off the name it started 130px into the column, and
// its left edge fell across the tab row's "Timeline" and cut the word in half; hung off the line it covers
// the whole tab row or none of it, and a menu that opens under a title is the title's column continued.
// The list is a LISTBOX: the current subject carries a tick in a fixed gutter at the LEADING edge and the
// row's weight; the counts stand alone in their column at the trailing edge. The tick used to follow the
// count ("4 ✓"), and a glyph after a numeral reads as part of the numeral — the numbers looked jogged
// though they were not. NO wash at open — the wash is the highlight, and the highlight follows the pointer or
// the arrow keys, so nothing is highlighted until one of them moves. The count column is labelled once, at
// the top, muted ("Direct links"), so a bare 4 is a fact and not a mystery — and it says WHICH count, the
// one the depth switch calls Direct, in a column name's form rather than a lowercase word's; the head also
// says how many rows there are, which is the filter's feedback as you type. On the menu material (one rung
// lighter than a popover's shadow; at title scale the heavier shadow read as a panel dropping out of the
// heading). Arrow keys move the highlight (starting from the current subject), Enter picks, Escape puts the
// name back. Sorted by connection count so the busiest subjects lead. Not the Popover primitive: its anchor
// must be a trigger it owns, and the anchor here is an input that replaces the trigger, so the popup is
// drawn by hand.
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
  const shown = entities
    .filter((e) => e.name.toLowerCase().includes(ql))
    .sort((a, b) => relationCount(b.id) - relationCount(a.id));
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

  // one box for both states: -mx-1.5 / px-1.5 keeps the mark on the title's text edge and lets the hover
  // wash bleed 6px past it; py-0.5 so the field and the button stand the same height and nothing on the
  // line moves when the name becomes a field. The mark carries its own gap (mr-2.5) and the chevron its own
  // (ml-0.5) — two different distances, so the box has no gap of its own.
  // (no max-w-full on the box: with the negative margins it fed the wrapper's width back into the button's
  // limit, and "Activation" truncated to "Activati…" in a column with 800px to spare)
  const box = "-mx-1.5 inline-flex min-w-0 items-center rounded-md px-1.5 py-0.5 text-2xl font-medium";
  // the subject's mark at the title: 16px, the rung's x-height — the canvas draws the centre at 21 and a
  // neighbour at 15, so the title's mark sits between them, a mark and not an icon
  const mark = current ? <NodeMark node={{ id: current.id, kind }} className="mr-2.5 size-4" /> : null;
  const chevron = <ChevronDown className="ml-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />;
  return (
    // not `relative`: the list positions against the title LINE (the parent, which is), see above
    <div
      ref={rootRef}
      className="inline-flex min-w-0 max-w-full"
      onBlur={(e) => {
        // focus leaving the title AND its list (a Tab away) puts the name back; a click on a row keeps
        // focus in the field (the row's pointerdown is prevented), so it never fires for a pick
        if (open && !rootRef.current?.contains(e.relatedTarget as Node)) close(false);
      }}
    >
      {open ? (
        <div className={box}>
          {mark}
          {/* the field and a sizer share one grid cell, so the field is exactly as wide as the name it
              stands in for (and grows with what is typed) — the chevron holds its place. size={1}: a
              field's own intrinsic width is twenty characters, and the grid track took it over the sizer */}
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
        </div>
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
          className={cn(box, "text-left text-foreground transition-colors hover:bg-tint-1", FOCUS_RING)}
        >
          {mark}
          <span className="truncate">{current?.name ?? `Pick a ${noun}`}</span>
          {chevron}
        </button>
      )}
      {open ? (
        // against the title LINE: left-0 is the h1's text edge, top-full the line's bottom, w-full the line's
        // width (the line is w-fit, so that is the width of "Topics ⓘ  ⬢ Activation ⌄" and not the column's);
        // min-w-80 so a short line still gets a menu five names and their counts fit in.
        <div
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label={nounPlural}
          className={cn(MENU_SURFACE, "scrollbar-subtle absolute top-full left-0 z-50 mt-1 flex max-h-72 w-full min-w-80 flex-col overflow-y-auto")}
        >
          {/* the column head — what the rows are and what the number is, said once, in muted 12. The
              spacers hold the tick's gutter and the mark's slot so the words sit over the names. */}
          <div role="presentation" className="flex items-center gap-2 px-2 pt-1 pb-1.5 text-xs text-muted-foreground">
            <span aria-hidden="true" className="size-4 shrink-0" />
            <span aria-hidden="true" className="size-3 shrink-0" />
            <span className="min-w-0 flex-1 truncate tabular-nums">
              {shown.length} {shown.length === 1 ? noun : nounPlural}
            </span>
            <span className="shrink-0">Direct links</span>
          </div>
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
                  // none until one of them moves; the current subject is the row's weight AND the tick in the
                  // leading gutter — a wash is what hover does. The gutter (16, the tick's own box) is held on
                  // every row so the marks and the names stand in one column whichever row is current. The
                  // count is inventory: muted, tabular, alone at the trailing edge in its labelled column.
                  className="flex cursor-default items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors data-active:bg-tint-1"
                >
                  {sel ? (
                    <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <span aria-hidden="true" className="size-4 shrink-0" />
                  )}
                  {/* 12px: the smallest size at which the topic's hexagon is still a hexagon and not a dot —
                      the same letter the list's rows use, one size across the page */}
                  <NodeMark node={{ id: e.id, kind }} className="size-3" />
                  <span className={cn("min-w-0 flex-1 truncate", sel && "font-medium")}>{e.name}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{relationCount(e.id)}</span>
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

// a tie's relation word, or nothing. "mentions Activation" sat under every row: the subject is the page's
// title, so a sentence whose object is the subject restates the page, four times. A topic or a person exists
// in the graph BECAUSE artifacts mention it — "mentions" is the default tie and says nothing. A tie of any
// other kind (Ana AUTHORED this one) is the exception, and the exception earns its word.
function relationWord(rowId: string, e: GraphEdge): string | null {
  if (e.type === "mentions") return null;
  return e.from === rowId ? AS_ROW[e.type][0] : AS_ROW[e.type][1];
}

// WHERE the tie lives, from the store's own provenance: for a proposed tie, the agent's plain-language
// rationale (the reason it proposed it — its trailing full stop dropped so it sits in the row as a phrase);
// for a tie anchored to a section of the artifact, the section ("in Goals" — where the mention lives). Rows
// were name-only on a page whose subject is relationships, and a name alone says that a thing is linked,
// never why or where. Only an artifact row has evidence to read; a mention with no anchor stays silent.
// The tie's KIND is not in here: it is a column of its own (relationWord), because "in Goals" (a place) and
// "linked from" (a kind) shared one slot after the name and read as one fact with two grammars.
function detailFor(row: GraphNode, e: GraphEdge): string | null {
  if (e.prov === "ai_generated") {
    const r = listPending().find((p) => p.edge_id === e.id)?.rationale;
    if (r) return r.replace(/\.$/, "");
  }
  if (row.kind === "artifact") {
    const blockId = getArtifactEvidence(row.id).find((ev) => ev.edge_id === e.id)?.block_id;
    const heading = blockId ? getBlocks(row.id).find((b) => b.id === blockId)?.heading : undefined;
    if (heading) return `in ${heading}`;
  }
  return null;
}

// when the thing at the row's end was last touched: an artifact's own age, or when a source was captured.
// A source had no age here and the second hop (mostly sources and people) lost the column, so the list
// broke into a half with ages and a half without. A person or a collection has no "when"; its cell is empty,
// and an empty cell in a column is not a broken cell.
function ageOf(node: GraphNode): string | undefined {
  if (node.kind === "artifact") return getArtifact(node.id)?.updated;
  if (node.kind === "source") return sourceById(node.id)?.at;
  return undefined;
}

// one neighbour, ONE line, in columns that hold from the first row to the last: the kind-mark, the name,
// after it in muted ink where the tie lives (the section, or the agent's rationale), the status phrase, then
// at the row's trailing end two fixed columns — the tie's KIND ("linked from", "source for", "authored";
// the default "mentions" is silent, see relationWord) and the age (the collection list's own trailing
// column, 12 tabular, muted). The kind sat after the name in the same slot the section used, so "in Goals"
// on one row and "linked from" on the next read as one column saying two different things; in its own
// column an empty cell means "the default tie" and a word means the exception. Provenance and confidence
// are ONE phrase, "proposed, unsure", parted from the detail by a hairline: "proposed" and "Unsure" stood
// as two loose words in two inks and read as a bug rather than as what they are, the tie's status and how
// sure the agent is. The confidence word keeps the ink it earns (settled 2026-09-12: high silent, likely
// muted, unsure full ink) inside the phrase. The name gives way first (it has a fuller form one click
// away); the detail truncates after it; the status phrase, the kind and the age never do. A node the graph
// draws dashed (still being processed) is dashed here too — the provenance vocabulary holds between the views.
function RelationRow({
  node,
  edge,
  detail,
  onSelect,
}: {
  node: GraphNode;
  edge: GraphEdge;
  detail: string | null;
  onSelect: (id: string) => void;
}) {
  const proposed = edge.prov === "ai_generated";
  const level = proposed && edge.confidence != null ? confidenceLevel(edge.confidence) : "high";
  const kind = relationWord(node.id, edge);
  const age = ageOf(node);
  return (
    <button
      type="button"
      onClick={() => onSelect(node.id)}
      className="flex w-full items-center gap-3 py-2.5 text-left transition-colors hover:bg-tint-1 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus outline-none"
    >
      {/* the graph's letter at 12px — the same size the picker's rows use, one alphabet at one size across
          the page. At 14 the filled square outweighed the 15px title beside it; at 10 the topic's hexagon
          had collapsed into a dot and the shape stopped saying the kind. */}
      <NodeMark node={{ id: node.id, kind: node.kind }} className="size-3" pending={node.state === "processing"} />
      <span className="min-w-0 truncate text-base font-medium">{node.label}</span>
      {detail || proposed ? (
        <span className="flex min-w-0 shrink items-center gap-2 text-sm text-muted-foreground">
          {detail ? <span className="min-w-0 truncate">{detail}</span> : null}
          {detail && proposed ? <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" /> : null}
          {proposed ? (
            <span className="shrink-0 whitespace-nowrap">
              proposed
              {level === "likely" ? ", likely" : null}
              {level === "unsure" ? (
                <>
                  {", "}
                  <span className="font-medium text-foreground">unsure</span>
                </>
              ) : null}
            </span>
          ) : null}
        </span>
      ) : null}
      {/* w-28 holds the longest kind ("superseded by") without a jog; w-14 the longest age ("17m", "3d") */}
      <span className="ml-auto w-28 shrink-0 truncate text-sm text-muted-foreground">{kind}</span>
      <span className="flex w-14 shrink-0 justify-end text-xs tabular-nums text-muted-foreground">{age}</span>
    </button>
  );
}

// ListView — the focus's neighbourhood AS A LIST, the whole of it, in named groups: the direct ties under
// a band that says so ("Direct 4" — the depth switch's own word and figure), then, a step further, each
// first-ring neighbour's own ties under a band that names the hop ("Through Notification strategy v3 15",
// its mark leading, its count as inventory). The list carries NO depth control. The depth switch is the
// graph's — a drawing gets crowded, so it needs a dial for how far out to draw; a list does not, it scrolls
// — and the list's "+24 more" fold was the same setting in a second idiom, so a reader met one decision
// dressed two ways and could not tell whether they were the same state. What the list owes the reader
// instead is to SAY how deep it goes, in the switch's words, so that a list of 4 + 15 + 4 + 3 + 2 is
// legibly the "All 28" the graph offers and not eleven rows of unknown reach. The first group used to go
// unheaded, so the first band ("Through …") arrived after four bare rows and read as a selected row rather
// than as the head of the next group; with every group headed, a band is what a band is. Grouping is how a
// list says "a step further": the hop is named where it starts, and a row's detail can leave the hub unsaid
// because the band above it says it. "The list is the truth; the graph is the show me" — same data, listed
// instead of drawn. Click a row to re-focus there.
function ListView({
  nb,
  wide,
  onSelect,
}: {
  nb: Neighborhood; // the direct neighbourhood
  wide: Neighborhood; // the two-hop one
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
  const groups = [...hubs.values()].filter((g) => g.rows.length).sort((a, b) => b.rows.length - a.rows.length);

  return (
    <div>
      {direct.length ? (
        <>
          {/* the first group's band: the switch's word for this reach, its count as inventory */}
          <FeedHead count={direct.length} kind="inventory">
            Direct
          </FeedHead>
          <div className={cn(DIVIDED_FLUSH, "border-b border-border")}>
            {direct.map((r) => (
              <RelationRow key={r.edge.id} node={r.node} edge={r.edge} detail={detailFor(r.node, r.edge)} onSelect={onSelect} />
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
              // in the kind column, what kind of tie it is
              <RelationRow key={r.node.id} node={r.node} edge={r.edge} detail={detailFor(r.node, r.edge)} onSelect={onSelect} />
            ))}
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

// GraphView — the relationship view: the field straight on the page ground (no card, no border, no
// legend), starting directly under the tab row, the depth switch in its top-right corner. The canvas
// used to begin 16px down and the switch sat a further gap below the hairline — 30px of dead air between
// the tab row and the one control under it. Now the field's top IS the row under the hairline.
function GraphView({
  nb,
  wide,
  centerId,
  previewIds,
  onSelect,
  onVerifyEdge,
  controls,
}: {
  nb: Neighborhood;
  wide: Neighborhood;
  centerId: string;
  previewIds?: string[];
  onSelect: (id: string) => void;
  onVerifyEdge?: (edgeId: string, action: "confirm" | "discard") => void;
  controls?: React.ReactNode;
}) {
  return (
    // the names' knockout paints in the ground colour; this field is the page, not a card
    <div className="relative" style={{ "--graph-ground": "var(--background)" } as React.CSSProperties}>
      {/* controls — depth, in the field's own top-right corner: a setting of THIS view, so it lives inside it */}
      {controls ? <div className="absolute top-0 right-0 z-10 flex items-center gap-2">{controls}</div> : null}
      {/* click a node → peek it in a popover anchored AT the node (no card docked below the canvas, which
          would just re-list the graph); re-centering the explorer is the peek's deliberate "Focus here"
          action, and a proposed (dashed) edge is confirmable in place via onVerifyEdge.
          radial, laid out on the WIDE neighbourhood at every reach: the inner ring's sectors are sized by
          each neighbour's second-hop weight, and they hold still when the outer ring appears, so the hover
          preview adds nodes without moving the ones already there. fullLabels + outerRing="full": a subject
          with a handful of neighbours writes every name out, and a ring the reader asked for is drawn in
          full ink. labelRule="below": one placement for every name (five names had four), the subject's in
          full ink, the neighbours' muted. The svg is capped at 650, which at the 520-unit box is a 1.25
          scale: the subject's 12-unit name lands on the 15 rung and a neighbour's 10.5 on 13 — the two
          rungs the page's rows use, not a size of the canvas's own. */}
      <LocalGraph
        data={nb}
        layoutData={wide}
        layout="radial"
        fullLabels
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
    </div>
  );
}

// Explorer — the shell. Three choices of three kinds, each in its own material so the reader can tell
// at a glance which changes WHAT they look at, which changes HOW it is shown, and which is a setting:
//   the subject  — its mark and name at the title rung, on the h1's line after a gap, a switcher
//                  (name + chevron; the rail's workspace grammar) — the loudest, it carries the one colour
//   the view     — ViewTabs, the page-level control (underline, forest) — the middle weight
//   the depth    — a SegToggle at its small size inside the graph it governs — the quietest, and the
//                  only view with a depth: the list names its groups in the switch's words instead
// The Explorer owns the page heading so the subject can share the h1's line: two lines of chrome
// (title, tabs) where there were three of decreasing size. (See woven/product/explorer-framework.md.)
export function Explorer({
  entities,
  entityKind,
  heading,
  entityNoun = "entity",
  entityNounPlural = "entities",
}: {
  entities: { id: string; name: string }[];
  // the kind every entity here is (a topic, a person) — the switcher's menu draws each row's kind-mark
  entityKind: RefKind;
  heading: { title: string; hint: string };
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
  // the depth option the pointer rests on — "2" while hovering "All" ghosts the outer ring in
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

  // calm one-line empty state — no broken chrome (garbage center node) when a space has no topics/people yet
  if (!entities.length) {
    return (
      <div>
        <PageHeading title={heading.title} hint={heading.hint} />
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

  // the depth switch, the graph's own control, in its top-right corner, at the SegToggle's small size: the
  // quietest of the page's three choices wears the quietest form the house's in-view switch takes. Its
  // two options are two parallel states of one dial, each with the number it shows — "Direct 4" and
  // "All 28" — in the tab's own label + bare count grammar. "+24 more" was a fold verb beside a state, so
  // the switch read as a button next to a status rather than as two positions; and the same 24 wore a
  // tint chip in the list, two costumes for one figure. Hovering "All" previews it (see GraphView), and
  // after the pointer has rested a line says in words what each state includes — "All" is a state's name
  // and names nothing; the ghost shows the cost, the line says what it is.
  const subjectName = entities.find((e) => e.id === centerId)?.name ?? `this ${entityNoun}`;
  const depthEl = (
    <SegToggle
      ariaLabel="Reach"
      size="sm"
      options={[
        { id: "1", label: "Direct", count: directCount, hint: `Only what ties to ${subjectName}` },
        { id: "2", label: "All", count: wideCount, hint: "Also what those ties reach, two hops out" },
      ]}
      value={depth}
      onChange={setDepth}
      onHover={setPeek}
    />
  );
  return (
    <div>
      {/* the title line: the kind (the page's h1, with its hint) and the one — the subject's mark and name,
          the trigger — parted by air (gap-x-5): a slash and then a hairline both read as a breadcrumb's
          seam, and a breadcrumb makes the subject a crumb. `relative` and `w-fit`: the subject's menu hangs
          off this LINE (left edge on the h1's, as wide as the line), see SubjectSwitcher. It wraps under
          the h1 only when the column cannot hold both. */}
      <div className="relative flex w-fit max-w-full flex-wrap items-center gap-x-5 gap-y-1">
        <PageHeading title={heading.title} hint={heading.hint} />
        <SubjectSwitcher
          entities={entities}
          kind={entityKind}
          currentId={centerId}
          onSelect={setCenterId}
          noun={entityNoun}
          nounPlural={entityNounPlural}
        />
      </div>

      {/* the view — the one page-level switch: three lenses on the same subject */}
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
        />
      </div>

      {/* mt-3: the view's first row (the graph's depth switch, the list's first row, the timeline's first
          entry) sits one control gap under the hairline, not a section gap */}
      <div className="mt-3" data-explorer-view={view}>
        {view === "timeline" ? (
          center ? (
            <TimelineView center={center} />
          ) : (
            <div className="flex h-80 items-center justify-center text-sm text-muted-foreground">
              Select an entity to explore.
            </div>
          )
        ) : view === "list" ? (
          <ListView nb={nbDirect} wide={nbWide} onSelect={setCenterId} />
        ) : (
          <GraphView nb={nb} wide={nbWide} centerId={centerId} previewIds={previewIds} onSelect={setCenterId} onVerifyEdge={resolve} controls={depthEl} />
        )}
      </div>
    </div>
  );
}
