"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ArrowUpRight, FolderMinus, Globe, GripVertical, Link2, MoreHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { DIVIDED_FLUSH } from "@/components/controls";
import { StatusPill, TypeBadge, PeopleStack } from "@/components/artifact-ui";
import { assignLanes, buildTrunks, countLanes, RailCell, type WeaveEdge } from "@/components/collection-weave";
import { getArtifactGraph, getFreshness } from "@/lib/api";
import { notify } from "@/lib/notifications";
import type { Artifact } from "@/lib/types";

// members drag to curate their order — a dedicated MIME type so the page's file/artifact drop
// (useCollectionDrop) ignores the reorder drag entirely (it only reacts to x-woven-artifacts / Files).
const REORDER_TYPE = "application/x-woven-member-reorder";

// The collection's Contents list: a row per member, the rail in the first cell.
//
// Its own component so a hover re-renders THIS list and nothing else. The lit row used to live in
// page state beside six measured row centres, so every pointer crossing and every resize re-rendered
// the whole page — KPIs, chart, dialogs — for a number the row's index already knows.
export function MemberRows({
  contents,
  chords,
  color,
  publicHub,
  onMove,
  onRemove,
}: {
  contents: { artifact: Artifact; pub: boolean }[];
  // member ↔ member ties only; the caller filters. Spokes from the collection are not drawn — the
  // list IS the spoke.
  chords: WeaveEdge[];
  // the collection's hue, for the lit row and its ties
  color: string;
  // whether this collection has a hub at all — the Public column exists only then
  publicHub: boolean;
  // `to` is the slot the member lands BEFORE (the drop indicator's row); see moveMember
  onMove: (from: number, to: number) => void;
  onRemove: (id: string, title: string) => void;
}) {
  const [lit, setLit] = React.useState<string | null>(null); // hovered or focused member → its node + ties
  const [dragIdx, setDragIdx] = React.useState<number | null>(null);
  const [overIdx, setOverIdx] = React.useState<number | null>(null);

  // the weave, once per list: trunks and lanes are keyed by row index, so every cell can draw itself
  // from these and its own index — nothing is measured
  const { trunks, lanes, laneCount, hubIndexOf } = React.useMemo(() => {
    const order = contents.map(({ artifact }) => artifact.id);
    const trunks = buildTrunks(chords, order);
    const lanes = assignLanes(trunks);
    const hubIndexOf = new Map(trunks.map((t) => [t.hub, order.indexOf(t.hub)]));
    return { trunks, lanes, laneCount: countLanes(lanes), hubIndexOf };
  }, [chords, contents]);
  const litIndex = lit ? contents.findIndex(({ artifact }) => artifact.id === lit) : -1;

  return (
    <div className={`${DIVIDED_FLUSH} border-b border-border md:[&>*+*]:before:left-10`}>
      {/* The hairlines start at the text column, not the rail's edge (Kyle, 2026-09-14): drawn across
          the rail's cell they crossed the spine at every row, a horizontal rule through a vertical
          line. Inset by the cell's 40px they part the rows and leave the drawing whole; the list's
          closing rule stays full width, and below md there is no cell to clear. */}
      {/* No header row (Kyle, 2026-09-14). The four values to the right of every title are the same
          four on every row — a stack of faces, a globe, a relative time — and each names itself: the
          faces are people, the globe carries "Public in this hub" on hover, "17m" is a time. The
          header's cell-width comments live on the row below; the rail's cell, the ⋯ slot and the
          fitted widths are the rows' own. Without it the list is the house's open list: rows on
          hairlines, the first flush under the tabs. */}
      {contents.map(({ artifact, pub }, i) => {
        const fresh = getFreshness(artifact.id);
        const people = getArtifactGraph(artifact.id).people;
        return (
          <div
            key={artifact.id}
            data-member={artifact.id}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(REORDER_TYPE, String(i));
              e.dataTransfer.effectAllowed = "move";
              setDragIdx(i);
            }}
            onDragOver={(e) => {
              if (!e.dataTransfer.types.includes(REORDER_TYPE)) return;
              e.preventDefault();
              e.stopPropagation(); // the reorder drag is ours — keep the page's file/artifact drop out
              e.dataTransfer.dropEffect = "move";
              if (overIdx !== i) setOverIdx(i);
            }}
            onDrop={(e) => {
              if (!e.dataTransfer.types.includes(REORDER_TYPE)) return;
              e.preventDefault();
              e.stopPropagation();
              if (dragIdx !== null) onMove(dragIdx, i);
              setDragIdx(null);
              setOverIdx(null);
            }}
            onDragEnd={() => {
              setDragIdx(null);
              setOverIdx(null);
            }}
            onMouseEnter={() => setLit(artifact.id)}
            onMouseLeave={() => setLit(null)}
            // focus lights the same drawing the pointer does: the rail's second claim used to exist
            // only for a mouse. The lit state holds while focus moves between the row's Link and its ⋯
            // (relatedTarget is still inside the row) and clears when it leaves.
            onFocus={() => setLit(artifact.id)}
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setLit(null);
            }}
            // items-stretch: the rail cell takes the row's full height, so its `100%` verticals meet
            // the hairlines above and below
            // The focus ring is the ROW's, drawn inset when the row's own link holds focus: on the link it enclosed
            // the text column only and ran through the rail's node, so a focused row had two left edges.
            className={`group/mem relative flex items-stretch transition-colors hover:bg-tint-1 has-[>a:focus-visible]:ring-2 has-[>a:focus-visible]:ring-inset has-[>a:focus-visible]:ring-focus ${dragIdx === i ? "opacity-40" : ""}`}
          >
            {/* drop indicator — where the dragged member will land */}
            {overIdx === i && dragIdx !== null && dragIdx !== i ? (
              <span className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0.5 bg-primary" />
            ) : null}
            {/* out of flow. It is invisible until hover but used to hold 28px in the row, and
                that 28px is the whole reason the badge column could never sit on the divider's
                left edge — an element nobody can see was setting the page's first indent.
                A slot one body line tall at the Link's top padding, so the grip centres on line 1
                (top-3.5 with no slot put it 1px under); md only — it drives a DnD that never fires
                on touch. */}
            <span
              aria-hidden
              className="absolute top-2.5 -left-6 hidden h-(--text-base--line-height) w-6 cursor-grab items-center justify-center text-foreground-hint opacity-0 transition-opacity group-hover/mem:opacity-100 active:cursor-grabbing md:flex"
            >
              <GripVertical className="size-4" />
            </span>
            {/* the rail: the row's first cell, inside its dividers and under its hover wash. It was
                one absolutely positioned SVG over the whole list, fed by measured row centres.
                relative: the svg inside is out of the cell's flow (absolute, inset-0), because an svg
                with no height of its own is 150px tall before the stretch resolves, and that 150
                became the row's height — the cell must take the row's height, never set it. */}
            <span aria-hidden className="relative hidden w-10 shrink-0 md:block">
              <RailCell
                index={i}
                id={artifact.id}
                trunks={trunks}
                lanes={lanes}
                laneCount={laneCount}
                lit={lit}
                litIndex={litIndex}
                hubIndexOf={hubIndexOf}
                color={color}
              />
            </span>
            {/* Line 1 = title · trailing cluster (type, state) · People · Public · Edited; line 2 = the
                gist. The type trails the title here (held); Library leads with it — the two rows share
                TypeBadge, PeopleStack and StatusPill, not a layout. */}
            <Link
              href={`/artifact/${artifact.id}`}
              draggable={false}
              className="block min-w-0 flex-1 py-2.5 outline-none md:pl-2"
            >
              {/* items-start: the trailing cells are slots one body line tall, so a marker sits on
                  the first line rather than the row's centre; below sm the trailing cluster drops
                  under the title instead of squeezing it */}
              <div className="flex items-start gap-4">
                <div className="flex min-w-0 flex-1 items-center gap-x-1.5 gap-y-1 max-sm:flex-wrap">
                  <span className="truncate text-base font-medium">{artifact.title}</span>
                  {/* ONE trailing cluster, one gap: title→type was 10px and type→mark 6px from two
                      stacked gaps. TypeBadge is its first child, so its own `:not(:first-child) ml-1`
                      never applies. */}
                  <span className="inline-flex shrink-0 items-center gap-1.5">
                    {/* the type trails the title, so titles land on the column's spine */}
                    <TypeBadge type={artifact.type} />
                    {/* the house form for this fact: the warn dot and the sentence, as on /home. A
                        hollow orange ring with no word read as a radio or a recording dot. */}
                    {fresh.state === "stale" ? <StatusPill state="stale" stale={{ since: fresh.since }} /> : null}
                    {fresh.state === "superseded" ? (
                      <span className="shrink-0 rounded-full bg-tint-1 px-1.5 py-px text-xs font-medium text-muted-foreground">
                        Superseded
                      </span>
                    ) : null}
                  </span>
                </div>
                {/* ONE rail. People, links, visibility and time used to sit in two zones — half
                    of them bottom-left under the gist, half top-right — which left the middle of
                    every row empty and gave the list two competing metadata columns. */}
                {/* anchored LEFT. A stack of one, two or three avatars has no fixed width,
                    and right-aligning it made the column's optical centre wander row to row. */}
                <span className="hidden h-(--text-base--line-height) w-24 shrink-0 items-center justify-start sm:flex">
                  {/* nothing for nobody. A dash is 13px wide in a column of 20px discs and stepped the
                      column's left edge; an empty cell under a header row is not a broken cell. */}
                  {/* the row knows its artifact, so the stack's card can say what each person did here */}
                  {people.length ? <PeopleStack people={people} artifactId={artifact.id} /> : null}
                </span>
                {/* A globe means "this one is on the web". It appears only where that is true,
                    and the column only exists on a collection that has a hub at all. The comment
                    here used to claim only the exception was marked; the code drew a glyph on all
                    six rows of the published collection and four identical locks on the private
                    one, which is a column that says the same word four times. The blank cell keeps
                    its name in the title, so blank reads as no rather than as nothing. */}
                {publicHub ? (
                  <span
                    className="hidden h-(--text-base--line-height) w-16 shrink-0 items-center justify-center text-muted-foreground sm:flex"
                    title={pub ? "Public in this hub" : "Not public in this hub"}
                  >
                    {/* the cell's own muted ink, no opacity: a hand-written 60% on it landed at
                        2.65:1, under every glyph rung */}
                    {pub ? <Globe className="size-3.5" /> : null}
                  </span>
                ) : null}
                <span className="flex h-(--text-base--line-height) w-20 shrink-0 items-center justify-end text-xs tabular-nums text-muted-foreground">
                  {artifact.updated}
                </span>
              </div>
              {/* text-sm: the sub half of an Interface row is 13/18, the same the Library gist wears;
                  the list had no 13 at all */}
              {artifact.gist ? (
                <p className="mt-0.5 truncate text-sm text-muted-foreground">{artifact.gist}</p>
              ) : null}
            </Link>
            {/* row actions in a hover ⋯ menu (matches the Library row) — a destructive un-file
                belongs behind a deliberate menu choice, not a bare one-click button.
                The slot is one body line tall at the Link's top padding, so the button centres on
                line 1 (a hand offset had it 3px under). At md+ it hangs in the right margin (hover
                grammar: margin = singular + transient) and is revealed by hover, by focus within the
                row and while its menu is open; below md it sits in flow at the row's trailing edge,
                visible at rest, because there is no hover on a phone and it used to be 16px off the
                viewport. */}
            <span className="flex h-(--text-base--line-height) shrink-0 items-center max-md:mt-2.5 max-md:ml-2 md:absolute md:top-2.5 md:-right-9">
              <DropdownMenu>
                {/* the shared icon-sm button, not a hand-rolled copy of it: this page's header
                    ⋯ is size="icon-sm" (28px, round) and the row's was 28px and 10px-cornered,
                    so one page carried two shapes of the same glyph doing the same job. */}
                <DropdownMenuTrigger
                  render={<Button variant="ghost" size="icon-sm" aria-label="More" />}
                  className="md:opacity-0 md:transition-opacity md:group-hover/mem:opacity-100 md:group-focus-within/mem:opacity-100 md:data-[popup-open]:opacity-100"
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={4} className="w-56">
                  <DropdownMenuItem render={<Link href={`/artifact/${artifact.id}`} />} className="gap-2">
                    <ArrowUpRight className="size-4 text-muted-foreground" /> Open artifact
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2"
                    onClick={() => {
                      navigator.clipboard
                        ?.writeText(
                          artifact.public
                            ? `woven.dev/a/${artifact.hub_slug ?? artifact.id}`
                            : `woven.dev/artifact/${artifact.id}`,
                        )
                        .catch(() => {});
                      notify.success("Link copied", { description: artifact.title });
                    }}
                  >
                    <Link2 className="size-4 text-muted-foreground" /> Copy link
                  </DropdownMenuItem>
                  {/* reorder without a pointer: the drag is HTML5 DnD, which has no touch and no
                      keyboard path. `to` is the slot the row lands BEFORE, the same contract the drop
                      uses — so down one is "before i + 2" (before i + 1 is where it already is). */}
                  <DropdownMenuItem className="gap-2" disabled={i === 0} onClick={() => onMove(i, i - 1)}>
                    <ArrowUp className="size-4 text-muted-foreground" /> Move up
                  </DropdownMenuItem>
                  <DropdownMenuItem className="gap-2" disabled={i === contents.length - 1} onClick={() => onMove(i, i + 2)}>
                    <ArrowDown className="size-4 text-muted-foreground" /> Move down
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="gap-2" onClick={() => onRemove(artifact.id, artifact.title)}>
                    <FolderMinus className="size-4 text-muted-foreground" /> Remove from collection
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </div>
        );
      })}
    </div>
  );
}
