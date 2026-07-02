"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Hash, Diamond, Link2, ArrowUpRight, Check, CheckCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./identity";
import type { EvidenceItem, EvidenceGroup } from "@/lib/types";

// the read-along evidence rail — provenance beside the body. ONE row grammar for every kind: a
// fixed-width marker slot + a label, all left-aligned at the same edge. Groups are merged to a few
// (Proposed · Woven from · Mentions · Decisions · Links). Rows carry the same loose rhythm as the
// Connections drawer (comfortable py, sans-body text, full-row hover). As you scroll, the evidence
// anchored to the section in view reads full and the rest dims. Proposed items align with everything
// else (a forest marker + the header carry "agent-proposed"); the valve stays quiet.

const DISPLAY_ORDER = ["proposed", "source", "mention", "decision", "link"] as const;
type DisplayGroup = (typeof DISPLAY_ORDER)[number];
const DISPLAY_LABEL: Record<DisplayGroup, string> = {
  proposed: "Proposed",
  source: "Woven from",
  mention: "Mentions",
  decision: "Decisions",
  link: "Links",
};
function displayGroup(g: EvidenceGroup): DisplayGroup {
  return g === "person" || g === "topic" ? "mention" : (g as DisplayGroup);
}
const ICON: Record<string, LucideIcon> = { source: FileText, topic: Hash, decision: Diamond, link: Link2, proposed: Link2 };

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground", className)}>
      {children}
    </p>
  );
}

// the marker slot — a person wears their avatar, everything else an outline icon; both sit in the same
// fixed-width slot so every label starts on the one left edge.
function Marker({ item }: { item: EvidenceItem }) {
  if (item.kind === "person") return <PersonAvatar seed={item.target_id} name={item.label} size="xs" />;
  const Icon = ICON[item.group] ?? Link2;
  return <Icon className={cn("size-4", item.group === "proposed" ? "text-primary" : "text-muted-foreground")} />;
}

function Row({
  item,
  active,
  onHover,
  onScrollTo,
  onResolve,
}: {
  item: EvidenceItem;
  active: string;
  onHover: (b: string | null) => void;
  onScrollTo: (b: string) => void;
  onResolve: (edgeId: string, action: "confirm" | "discard") => void;
}) {
  const isProposed = item.group === "proposed";
  const on = !!item.block_id && item.block_id === active;
  // proposals always read full (they need a decision); other rows dim when off the section in view
  const off = !isProposed && !!item.block_id && !!active && item.block_id !== active;

  const head = (
    <>
      <span className="flex w-5 shrink-0 items-center justify-center">
        <Marker item={item} />
      </span>
      <span
        className={cn(
          "truncate",
          isProposed || on ? "text-foreground" : "text-muted-foreground group-hover/ev:text-foreground",
        )}
      >
        {item.label}
      </span>
      {item.href ? (
        <ArrowUpRight className="ml-auto size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/ev:opacity-100" />
      ) : null}
    </>
  );

  // non-proposed rows take the drawer's loose row: full-row hover, comfortable py, sans-body text
  const rowCls = "-mx-2 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm leading-snug transition-colors hover:bg-foreground/[0.04]";
  const hover = {
    onMouseEnter: () => item.block_id && onHover(item.block_id),
    onMouseLeave: () => onHover(null),
  };

  if (!isProposed) {
    const inner = item.href ? (
      <Link href={item.href} className={rowCls}>
        {head}
      </Link>
    ) : item.block_id ? (
      <button type="button" onClick={() => onScrollTo(item.block_id!)} className={cn(rowCls, "w-full")}>
        {head}
      </button>
    ) : (
      <div className={rowCls}>{head}</div>
    );
    return (
      <div className={cn("group/ev transition-opacity duration-200", off && "opacity-45 hover:opacity-100")} {...hover}>
        {inner}
      </div>
    );
  }

  // proposed — same marker + label grammar (aligned), then the reason + a quiet valve, indented to the
  // label. The forest marker + the "Proposed" header carry "agent-proposed"; no box, no filled button.
  return (
    <div className="group/ev flex flex-col" {...hover}>
      <button
        type="button"
        onClick={() => item.block_id && onScrollTo(item.block_id)}
        className="flex items-center gap-2.5 py-0.5 text-left text-sm leading-snug"
      >
        {head}
      </button>
      {item.rationale ? (
        <p className="mt-1 pr-1 pl-[1.875rem] text-[12px] leading-snug text-muted-foreground">{item.rationale}</p>
      ) : null}
      <div className="mt-2 flex items-center gap-4 pl-[1.875rem]">
        <button
          type="button"
          onClick={() => onResolve(item.edge_id, "confirm")}
          className="inline-flex items-center gap-1 text-[12px] font-medium text-primary transition-colors hover:text-primary/80"
        >
          <Check className="size-3.5" /> Confirm
        </button>
        <button
          type="button"
          onClick={() => onResolve(item.edge_id, "discard")}
          className="text-[12px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function EvidenceRail({
  items,
  active,
  onHover,
  onScrollTo,
  onResolve,
  onConfirmAll,
}: {
  items: EvidenceItem[];
  active: string;
  onHover: (b: string | null) => void;
  onScrollTo: (b: string) => void;
  onResolve: (edgeId: string, action: "confirm" | "discard") => void;
  onConfirmAll?: () => void;
}) {
  const groups = DISPLAY_ORDER.map((dg) => ({ dg, list: items.filter((i) => displayGroup(i.group) === dg) })).filter(
    (x) => x.list.length > 0,
  );
  if (!groups.length) return null;
  return (
    <div className="flex flex-col gap-7">
      {groups.map(({ dg, list }) => (
        <div key={dg} className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>{DISPLAY_LABEL[dg]}</Eyebrow>
            {dg === "proposed" && list.length > 1 && onConfirmAll ? (
              <button
                onClick={onConfirmAll}
                className="inline-flex items-center gap-1 text-[10px] font-medium text-primary transition-colors hover:text-primary/80"
              >
                <CheckCheck className="size-3" /> Confirm all
              </button>
            ) : null}
          </div>
          <div className={cn("flex flex-col", dg === "proposed" ? "gap-5" : "gap-0.5")}>
            {list.map((i) => (
              <Row key={i.edge_id} item={i} active={active} onHover={onHover} onScrollTo={onScrollTo} onResolve={onResolve} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
