"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Hash, Diamond, Link2, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentAvatar, PersonAvatar } from "./identity";
import { Valve, ProposalMeta, provisional } from "./proposal";
import type { EvidenceItem, EvidenceGroup } from "@/lib/types";

// the read-along evidence rail — provenance beside the body. Each item is anchored to a section
// (block_id); as the reader scrolls, the section in view lights up its evidence and dims the rest.
// Hovering a row highlights the source block in the doc (bi-directional sync); clicking scrolls to
// it, or navigates when the row points at another artifact. The graph, felt while reading.

const ORDER: EvidenceGroup[] = ["proposed", "source", "decision", "person", "topic", "link"];
const GROUP_LABEL: Record<EvidenceGroup, string> = {
  proposed: "Proposed",
  source: "Woven from",
  decision: "Decisions",
  person: "People",
  topic: "Topics",
  link: "Links",
};
const GROUP_ICON: Partial<Record<EvidenceGroup, LucideIcon>> = {
  source: FileText,
  decision: Diamond,
  topic: Hash,
  link: Link2,
};

function Eyebrow({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn("text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground", className)}>
      {children}
    </p>
  );
}

function EvidenceRow({
  item,
  active,
  onHover,
  onScrollTo,
}: {
  item: EvidenceItem;
  active: string;
  onHover: (b: string | null) => void;
  onScrollTo: (b: string) => void;
}) {
  const scoped = !!item.block_id;
  const on = scoped && item.block_id === active;
  const off = scoped && !!active && item.block_id !== active;
  const Icon = GROUP_ICON[item.group];

  const body = (
    <>
      <span
        className={cn(
          "h-px shrink-0 transition-all duration-200",
          on ? "w-4 bg-foreground" : "w-2 bg-border group-hover/ev:w-3 group-hover/ev:bg-foreground/40",
        )}
      />
      {item.group === "person" ? (
        <PersonAvatar seed={item.target_id} name={item.label} size="xs" />
      ) : Icon ? (
        <Icon className="size-3.5 shrink-0 text-muted-foreground" />
      ) : null}
      <span
        className={cn(
          "truncate text-[12.5px] transition-colors",
          on ? "text-foreground" : "text-muted-foreground group-hover/ev:text-foreground",
        )}
      >
        {item.label}
      </span>
      {item.href ? (
        <ArrowUpRight className="ml-auto size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/ev:opacity-100" />
      ) : null}
    </>
  );

  const cls = cn(
    "group/ev -mx-2 flex items-center gap-2 rounded-md px-2 py-1 text-left transition-all duration-200 hover:bg-foreground/[0.04]",
    off && "opacity-40 hover:opacity-100",
  );
  const hover = {
    onMouseEnter: () => item.block_id && onHover(item.block_id),
    onMouseLeave: () => onHover(null),
  };

  if (item.href) {
    return (
      <Link href={item.href} className={cls} {...hover}>
        {body}
      </Link>
    );
  }
  if (item.block_id) {
    return (
      <button type="button" onClick={() => onScrollTo(item.block_id!)} className={cls} {...hover}>
        {body}
      </button>
    );
  }
  return <div className={cn(cls, "cursor-default")}>{body}</div>;
}

function ProposedRow({
  item,
  onResolve,
  onHover,
  onScrollTo,
}: {
  item: EvidenceItem;
  onResolve: (edgeId: string, action: "confirm" | "discard") => void;
  onHover: (b: string | null) => void;
  onScrollTo: (b: string) => void;
}) {
  return (
    <div
      className={cn(provisional, "p-2.5")}
      onMouseEnter={() => item.block_id && onHover(item.block_id)}
      onMouseLeave={() => onHover(null)}
    >
      <button
        type="button"
        onClick={() => item.block_id && onScrollTo(item.block_id)}
        className="flex w-full items-center gap-1.5 text-left text-[12.5px] leading-snug"
      >
        <AgentAvatar size="xs" />
        <span className="truncate">
          Link to <span className="font-medium">{item.label}</span>
        </span>
      </button>
      {item.rationale ? <ProposalMeta rationale={item.rationale} className="mt-1.5" /> : null}
      <Valve
        onConfirm={() => onResolve(item.edge_id, "confirm")}
        onDismiss={() => onResolve(item.edge_id, "discard")}
        className="mt-2"
      />
    </div>
  );
}

export function EvidenceRail({
  items,
  active,
  onHover,
  onScrollTo,
  onResolve,
}: {
  items: EvidenceItem[];
  active: string;
  onHover: (b: string | null) => void;
  onScrollTo: (b: string) => void;
  onResolve: (edgeId: string, action: "confirm" | "discard") => void;
}) {
  const groups = ORDER.map((g) => ({ g, list: items.filter((i) => i.group === g) })).filter(
    (x) => x.list.length > 0,
  );
  if (!groups.length) return null;
  return (
    <div className="flex flex-col gap-5">
      <Eyebrow>Evidence</Eyebrow>
      {groups.map(({ g, list }) => (
        <div key={g} className="flex flex-col gap-1.5">
          <Eyebrow className="text-[10px] tracking-[0.12em] text-muted-foreground/70">{GROUP_LABEL[g]}</Eyebrow>
          <div className="flex flex-col gap-0.5">
            {g === "proposed"
              ? list.map((i) => (
                  <ProposedRow key={i.edge_id} item={i} onResolve={onResolve} onHover={onHover} onScrollTo={onScrollTo} />
                ))
              : list.map((i) => (
                  <EvidenceRow key={i.edge_id} item={i} active={active} onHover={onHover} onScrollTo={onScrollTo} />
                ))}
          </div>
        </div>
      ))}
    </div>
  );
}
