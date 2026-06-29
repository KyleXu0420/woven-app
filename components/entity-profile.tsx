"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { tintVar } from "@/lib/identity";
import {
  collectionById,
  nodeMeta,
  nodeRelations,
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
  const stats = nodeStats(node.id);
  const rels = nodeRelations(node.id);
  const related = rels.slice(0, 6);
  const meta = nodeMeta(node.id);
  const person = node.kind === "person" ? personById(node.id) : undefined;
  const open =
    node.kind === "artifact"
      ? `/artifact/${node.id}`
      : node.kind === "collection"
        ? `/collection/${collectionById(node.id)?.slug ?? ""}`
        : null;
  // the artifact type reads as identity, not a metric — it lives in the eyebrow, so the number row
  // stays purely numeric (no "HTML" wearing tabular-nums next to 14 / 4 / 248).
  const facts = stats.filter((s) => s.label !== "Type");
  const eyebrow = [node.kind, node.type, person?.role, rels.length ? `${rels.length} links` : null]
    .filter(Boolean)
    .join(" · ");

  // placement shapes the frame: docked floats (shadow), popover sits flatter, inline is bare
  const frame =
    placement === "docked"
      ? "w-full max-w-md rounded-2xl border bg-popover/95 shadow-lg backdrop-blur-sm"
      : placement === "popover"
        ? "w-full max-w-md rounded-xl border bg-popover shadow-md"
        : "w-full rounded-xl border bg-card";

  return (
    <div className={`overflow-hidden ${frame}`}>
      {/* identity — mark · title · open, with kind/type/role/links as the eyebrow under the title */}
      <div className="flex items-start gap-3 p-4 pb-0">
        <NodeMark node={node} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="truncate text-[15px] font-semibold leading-snug">{node.label}</h3>
            {open ? (
              <Link
                href={open}
                className="-mt-0.5 -mr-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
                aria-label="Open"
              >
                <ArrowUpRight className="size-4" />
              </Link>
            ) : null}
          </div>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.1em] text-muted-foreground">
            {eyebrow}
          </p>
        </div>
      </div>

      {/* facts — pure numbers, inline */}
      {facts.length ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pt-3 pb-4 text-xs text-muted-foreground">
          {facts.map((s) => (
            <span key={s.label}>
              <span className="font-semibold tabular-nums text-foreground">{s.value}</span> {s.label}
            </span>
          ))}
        </div>
      ) : null}

      {/* related — a preview of the entity's strongest links, as re-focusable chips (the "Links panel"
          to the graph's "show me"). Fills the card and gives a readable list of what it connects to. */}
      {related.length ? (
        <div className="px-4 pb-4">
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Related
          </p>
          <div className="flex flex-wrap gap-1.5">
            {related.map((r) => {
              const inner = (
                <>
                  <NodeMark node={{ id: r.target_id, kind: r.kind }} className="size-3.5" />
                  <span className="max-w-[12rem] truncate">{r.label}</span>
                </>
              );
              return onSelect ? (
                <button
                  key={r.edge_id}
                  onClick={() => onSelect(r.target_id)}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-card px-2 py-1 text-xs transition-colors hover:bg-foreground/[0.04]"
                >
                  {inner}
                </button>
              ) : (
                <span
                  key={r.edge_id}
                  className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs"
                >
                  {inner}
                </span>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* history — the time facts, quietest tier */}
      {meta ? (
        <div className="border-t px-4 py-2 text-[11px] text-muted-foreground">
          Created <span className="text-foreground/75">{meta.created}</span>
          <span className="mx-1.5 opacity-50">·</span>
          Viewed <span className="text-foreground/75">{meta.viewed}</span>
          <span className="mx-1.5 opacity-50">·</span>
          Edited <span className="text-foreground/75">{meta.modified}</span>
        </div>
      ) : null}

      {/* a little breathing room if there's nothing below the identity */}
      {!facts.length && !related.length && !meta ? <div className="pb-4" /> : null}
    </div>
  );
}
