"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
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

// the entity's mark — same shape language as the graph nodes (shape = kind, colour = identity)
const MARK_SHAPE: Partial<Record<RefKind, string>> = {
  artifact: "rounded-[9px]",
  collection: "rounded-[5px]",
  topic: "[clip-path:polygon(25%_6%,75%_6%,100%_50%,75%_94%,25%_94%,0_50%)]",
  decision: "[clip-path:polygon(50%_0,100%_50%,50%_100%,0_50%)]",
};

export function NodeMark({
  node,
  className = "size-7",
}: {
  node: { id: string; kind: RefKind };
  className?: string;
}) {
  const fill =
    node.kind === "artifact"
      ? (primaryCollection(node.id)?.color ?? "var(--chart-1)")
      : node.kind === "collection"
        ? (collectionById(node.id)?.color ?? "var(--chart-1)")
        : tintVar(node.id);
  return (
    <span
      className={`shrink-0 ${className} ${MARK_SHAPE[node.kind] ?? "rounded-full"}`}
      style={{ background: fill }}
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
}: {
  node: GraphNode;
  placement?: Placement;
  onSelect?: (id: string) => void;
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
  const eyebrow = [node.kind, node.type, person?.role].filter(Boolean).join(" · ");

  // placement shapes the frame: docked floats (shadow), popover sits flatter, inline is bare
  const frame =
    placement === "docked"
      ? "w-full max-w-md rounded-2xl border bg-popover/95 shadow-lg backdrop-blur-sm"
      : placement === "popover"
        ? "w-full max-w-md rounded-xl border bg-popover shadow-md"
        : "w-full rounded-xl border bg-card";

  return (
    <div className={`overflow-hidden ${frame}`}>
      {/* one block, one rhythm: identity → metrics → related, evenly spaced. History sits under a rule. */}
      <div className="flex flex-col gap-3 p-4">
        {/* identity — mark · title · open, with kind/type/role as the eyebrow under the title */}
        <div className="flex items-start gap-3">
          <NodeMark node={node} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="truncate text-[15px] font-semibold leading-snug">{node.label}</h3>
              {open ? (
                <IconButton label="Open" size="icon-sm" className="-mt-0.5 -mr-1" nativeButton={false} render={<Link href={open} />}>
                  <ArrowUpRight />
                </IconButton>
              ) : null}
            </div>
            <p className="mt-1 text-[13px] font-medium text-muted-foreground">
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
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2.5 text-left text-[13px] transition-colors enabled:hover:bg-foreground/[0.06] disabled:cursor-default"
                  >
                    <span className={n ? "font-medium text-foreground/90" : "text-muted-foreground"}>{c.label}</span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <span className={`tabular-nums font-semibold ${n ? "text-foreground" : "text-muted-foreground/50"}`}>{n}</span>
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
                                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-foreground/80 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                              >
                                {inner}
                              </button>
                            ) : (
                              <span className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-foreground/80">{inner}</span>
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
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
            {scalars.map((s) => (
              <span key={s.label}>
                <span className="font-semibold tabular-nums text-foreground/80">{s.value}</span> {s.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {/* history — the time facts, quietest tier, under a rule */}
      {meta ? (
        <div className="border-t px-4 py-2 text-[12px] text-muted-foreground">
          Created <span className="text-foreground/75">{meta.created}</span>
          <span className="mx-1.5 opacity-50">·</span>
          Viewed <span className="text-foreground/75">{meta.viewed}</span>
          <span className="mx-1.5 opacity-50">·</span>
          Edited <span className="text-foreground/75">{meta.modified}</span>
        </div>
      ) : null}
    </div>
  );
}
