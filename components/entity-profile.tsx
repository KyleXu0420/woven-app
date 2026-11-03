"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight, type LucideIcon } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { tintVar } from "@/lib/identity";
import {
  collectionById,
  nodeConnections,
  nodeMeta,
  nodeStats,
  personById,
  primaryCollection,
} from "@/lib/api";
import type { GraphNode, RefKind } from "@/lib/types";

// the entity's mark — same shape language as the graph nodes (shape = kind, colour = identity).
// The radius is a fraction of the side (the alphabet: artifact rx side/4, collection side/10), so the
// mark keeps its shape at every size the callers use. It was 7px and 3px, cut for the 28px profile mark;
// on a 14px row mark 7px is a full circle, and an artifact row wore a person's shape.
// The topic's hexagon stands on a POINT (a vertex at the top), the way NodeShape draws it on the canvas
// (its first vertex is at 30°, so the ring of six has one at 90°): the mark stood on a flat side, and at
// 10–16px a flat-topped hexagon with its points to the sides reads as a wide dot while the canvas's reads
// as a hexagon — the same kind wore two shapes and the heading's mark was taken for a coloured dot. A
// regular pointy hexagon is 87% as wide as it is tall, hence the 6% and 94%.
const MARK_SHAPE: Partial<Record<RefKind, string>> = {
  topic: "[clip-path:polygon(50%_0,94%_25%,94%_75%,50%_100%,6%_75%,6%_25%)]",
  decision: "[clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]",
};
const MARK_RADIUS: Partial<Record<RefKind, string>> = { artifact: "25%", collection: "10%" };

export function NodeMark({
  node,
  className = "size-7",
  pending = false,
  fill: fillOverride,
}: {
  node: { id: string; kind: RefKind };
  className?: string;
  // pending — the graph's one "not yet" mark: a dashed outline in the identity colour on the card, the same
  // dash NodeShape draws for a node still being processed. A list row for a node the graph draws dashed was
  // a filled swatch, so the two views disagreed about the one thing provenance is meant to say.
  pending?: boolean;
  // fill — the one mark with no identity hue: the space itself, a "collection" with no swatch, which the team
  // field draws as its hub in ink (nodeFill: the frame, not a thing). Without this the Team title's mark fell
  // to the chart-1 fallback and wore a hue the graph never gave it.
  fill?: string;
}) {
  const fill =
    fillOverride ??
    (node.kind === "artifact"
      ? (primaryCollection(node.id)?.color ?? "var(--chart-1)")
      : node.kind === "collection"
        ? (collectionById(node.id)?.color ?? "var(--chart-1)")
        : tintVar(node.id));
  // a source is a RING — a circle with the ground inside it, its identity hue on the line only. It was a
  // filled disc, the person's shape, so "3 interview transcripts" sat in a list as a person and was taken
  // for a document by anyone who knew the person's shape; a source is an origin outside the base, and a
  // hollow mark says "outside". The same ring NodeShape draws on the canvas.
  const ring = node.kind === "source";
  return (
    <span
      className={`shrink-0 ${className} ${MARK_SHAPE[node.kind] ?? (MARK_RADIUS[node.kind] ? "" : "rounded-full")}`}
      style={
        pending || ring
          ? { background: "var(--card)", border: `1.5px ${pending ? "dashed" : "solid"} ${fill}`, borderRadius: MARK_RADIUS[node.kind] }
          : { background: fill, borderRadius: MARK_RADIUS[node.kind] }
      }
    />
  );
}

type Placement = "docked" | "popover" | "inline";

// the nodeStats labels that are plain numbers (not sets of entities) — shown as a quiet line, not a row
const SCALAR_FACTS = new Set(["Sections", "Reads", "Proposed"]);

// EntityProfile — the selected entity's "file": identity · numbers · history · Open. View-agnostic:
// the graph docks it at the stage base, but a list-row hover / timeline / Ask citation can reuse the
// same card with a different placement. One definition of what an entity looks like — one truth.
export function EntityProfile({
  node,
  placement = "docked",
  onSelect,
  primaryAction,
  secondaryAction,
}: {
  node: GraphNode;
  placement?: Placement;
  onSelect?: (id: string) => void;
  // an optional footer action (e.g. an explorer's "Focus here" to re-center on this node)
  primaryAction?: { label: string; onClick: () => void; icon?: LucideIcon };
  // a second, quieter one beside it (the explorer's "Show N more" / "Hide N" on a hub — the peek offers
  // what the hub's fold does). Ghost, not outlined: two outlined buttons in one row are two primaries.
  secondaryAction?: { label: string; onClick: () => void; icon?: LucideIcon };
}) {
  // connections = the entity's related entities, GROUPED by category — each an interactive row that expands to
  // its members. scalars = the non-entity numbers (Sections / Reads / Proposed), kept as one quiet line.
  const conns = nodeConnections(node.id);
  const scalars = nodeStats(node.id).filter((s) => SCALAR_FACTS.has(s.label));
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const meta = nodeMeta(node.id);
  const person = node.kind === "person" ? personById(node.id) : undefined;
  const open =
    node.kind === "artifact"
      ? `/artifact/${node.id}`
      : node.kind === "collection"
        ? `/collection/${collectionById(node.id)?.slug ?? ""}`
        : null;
  // eyebrow = what it IS (kind · type · role). The "how much" now lives in the interactive category rows below.
  const eyebrow = [node.kind, node.type, person?.role].filter(Boolean).join(", ");
  const ActionIcon = primaryAction?.icon;
  const SecondIcon = secondaryAction?.icon;

  // placement shapes the frame: docked floats (shadow), popover sits flatter, inline is bare
  const frame =
    placement === "docked"
      ? "w-full max-w-md rounded-lg border bg-popover/95 shadow-lg backdrop-blur-sm"
      : placement === "popover"
        ? "w-full max-w-md rounded-lg border bg-popover shadow-md"
        : "w-full rounded-lg border bg-card";

  return (
    <div className={`overflow-hidden ${frame}`}>
      {/* one block, one rhythm: identity → metrics → related, evenly spaced. History sits under a rule. */}
      <div className="flex flex-col gap-3 p-4">
        {/* identity — mark · title · open, with kind/type/role as the eyebrow under the title */}
        <div className="flex items-start gap-3">
          <NodeMark node={node} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate text-base font-medium">{node.label}</h3>
              {open ? (
                <IconButton label="Open" size="icon-sm" className="-mt-0.5 -mr-1" nativeButton={false} render={<Link href={open} />}>
                  <ArrowUpRight />
                </IconButton>
              ) : null}
            </div>
            <p className="mt-1 text-sm font-medium text-muted-foreground">
              {eyebrow}
            </p>
          </div>
        </div>

        {/* connections — one interactive row per category (menu-item hit area + hover bg, extended to the card
            edge); a row with members expands in place to its entities, each re-focusable (hops the peek / opens). */}
        {conns.length ? (
          <div className="-mx-2 flex flex-col">
            {conns.map((c) => {
              const n = c.items.length;
              const isOpen = expanded === c.label;
              return (
                <div key={c.label}>
                  <button
                    type="button"
                    disabled={n === 0}
                    onClick={() => setExpanded(isOpen ? null : c.label)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2.5 text-left text-sm transition-colors enabled:hover:bg-tint-1 disabled:cursor-default"
                  >
                    <span className={n ? "font-medium text-foreground-prose" : "text-muted-foreground"}>{c.label}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className={`tabular-nums font-medium ${n ? "text-foreground" : "text-muted-foreground"}`}>{n}</span>
                      <ChevronRight className={`size-4 text-muted-foreground transition-transform ${n ? "" : "opacity-0"} ${isOpen ? "rotate-90" : ""}`} />
                    </span>
                  </button>
                  {isOpen && n ? (
                    <ul className="flex flex-col gap-0.5 pb-1 pl-2">
                      {c.items.map((it) => {
                        const inner = (
                          <>
                            <NodeMark node={{ id: it.id, kind: it.kind }} className="size-3.5" />
                            <span className="truncate">{it.label}</span>
                          </>
                        );
                        return (
                          <li key={it.id}>
                            {onSelect ? (
                              <button
                                onClick={() => onSelect(it.id)}
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-foreground-prose transition-colors hover:bg-tint-1 hover:text-foreground"
                              >
                                {inner}
                              </button>
                            ) : (
                              <span className="flex items-center gap-2 px-2 py-1.5 text-sm text-foreground-prose">{inner}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        {/* scalar facts — the plain numbers (sections / reads / proposed), quietest tier, one line */}
        {scalars.length ? (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {scalars.map((s) => (
              <span key={s.label}>
                <span className="font-medium tabular-nums text-foreground">{s.value}</span> {s.label}
              </span>
            ))}
          </div>
        ) : null}

        {/* the footer actions the host wires — the primary (an explorer's "Focus here", outlined) and, beside
            it, the secondary (ghost); one row, each taking half, so two verbs never stack into a column.
            ONE box for both: the ghost draws its border transparent, so its height, its text's inset and
            its hover ground (tint-1, the same rung the primary's hover takes) are the primary's by
            construction, not by the row's stretch — and whatever the ghost's label says ("Show 14 more",
            then "Hide 14" once the ring is out) it is the same button in the same register. Its hover
            ground is a hover: a pointer that stays where it clicked keeps it, as on every ghost. */}
        {primaryAction || secondaryAction ? (
          <div className="-mx-2 flex gap-2">
            {primaryAction ? (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-sm font-medium text-foreground-prose transition-colors hover:bg-tint-1 hover:text-foreground"
              >
                {ActionIcon ? <ActionIcon className="size-3.5" /> : null}
                {primaryAction.label}
              </button>
            ) : null}
            {secondaryAction ? (
              <button
                type="button"
                onClick={secondaryAction.onClick}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-tint-1 hover:text-foreground"
              >
                {SecondIcon ? <SecondIcon className="size-3.5" /> : null}
                {secondaryAction.label}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* history — the time facts, quietest tier, under a rule */}
      {meta ? (
        <div className="border-t px-4 py-2 text-xs text-muted-foreground">
          Created <span className="text-muted-foreground">{meta.created}</span>, viewed{" "}
          <span className="text-muted-foreground">{meta.viewed}</span>, edited{" "}
          <span className="text-muted-foreground">{meta.modified}</span>
        </div>
      ) : null}
    </div>
  );
}
