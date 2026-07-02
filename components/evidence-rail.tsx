"use client";

import * as React from "react";
import Link from "next/link";
import { FileText, Hash, Diamond, Link2, ArrowUpRight, Check, CheckCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "./identity";
import type { EvidenceItem } from "@/lib/types";

// The read-along evidence rail — Cycle-style: it shows the provenance for the SECTION you're reading
// (the sources, people, topics, and decisions anchored to the section in view) plus any pending agent
// proposals, which always need a decision. The full connection web + reach live in the Connections
// drawer; the rail stays short and keyed to the claim in front of you. One row grammar, one left edge.

const ICON: Record<string, LucideIcon> = { source: FileText, topic: Hash, decision: Diamond, link: Link2, proposed: Link2 };

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{children}</p>;
}

// the marker slot — a person wears their avatar, everything else an outline icon; both sit in the same
// fixed-width slot so every label starts on the one left edge.
function Marker({ item }: { item: EvidenceItem }) {
  if (item.kind === "person") return <PersonAvatar seed={item.target_id} name={item.label} size="xs" />;
  const Icon = ICON[item.group] ?? Link2;
  return <Icon className={cn("size-4", item.group === "proposed" ? "text-primary" : "text-muted-foreground")} />;
}

function Head({ item, onScrollTo }: { item: EvidenceItem; onScrollTo: (b: string) => void }) {
  const cls = "flex w-full items-center gap-2.5 py-1.5 text-left text-sm leading-snug";
  const body = (
    <>
      <span className="flex w-5 shrink-0 items-center justify-center">
        <Marker item={item} />
      </span>
      <span className="truncate text-foreground">{item.label}</span>
      {item.href ? (
        <ArrowUpRight className="ml-auto size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/ev:opacity-100" />
      ) : null}
    </>
  );
  if (item.href) {
    return (
      <Link href={item.href} className={cls}>
        {body}
      </Link>
    );
  }
  if (item.block_id) {
    return (
      <button type="button" onClick={() => onScrollTo(item.block_id!)} className={cls}>
        {body}
      </button>
    );
  }
  return <div className={cls}>{body}</div>;
}

function Row({
  item,
  onHover,
  onScrollTo,
  onResolve,
}: {
  item: EvidenceItem;
  onHover: (b: string | null) => void;
  onScrollTo: (b: string) => void;
  onResolve: (edgeId: string, action: "confirm" | "discard") => void;
}) {
  const hover = {
    onMouseEnter: () => item.block_id && onHover(item.block_id),
    onMouseLeave: () => onHover(null),
  };
  if (item.group !== "proposed") {
    return (
      <div className="group/ev" {...hover}>
        <Head item={item} onScrollTo={onScrollTo} />
      </div>
    );
  }
  // proposed — the link, a quiet reason, and a text valve (a forest Confirm leads, Dismiss stays muted)
  return (
    <div className="group/ev flex flex-col" {...hover}>
      <Head item={item} onScrollTo={onScrollTo} />
      {item.rationale ? (
        <p className="mt-0.5 pr-1 pl-[1.875rem] text-[12px] leading-snug text-muted-foreground">{item.rationale}</p>
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
  sectionLabel,
  onHover,
  onScrollTo,
  onResolve,
  onConfirmAll,
}: {
  items: EvidenceItem[];
  active: string;
  sectionLabel: string;
  onHover: (b: string | null) => void;
  onScrollTo: (b: string) => void;
  onResolve: (edgeId: string, action: "confirm" | "discard") => void;
  onConfirmAll?: () => void;
}) {
  const proposed = items.filter((i) => i.group === "proposed");
  const sectionItems = items.filter((i) => i.group !== "proposed" && !!i.block_id && i.block_id === active);

  return (
    <div className="flex flex-col gap-7">
      {proposed.length ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <Eyebrow>Proposed</Eyebrow>
            {proposed.length > 1 && onConfirmAll ? (
              <button
                onClick={onConfirmAll}
                className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-primary transition-colors hover:text-primary/80"
              >
                <CheckCheck className="size-3" /> Confirm all
              </button>
            ) : null}
          </div>
          <div className="flex flex-col gap-5">
            {proposed.map((i) => (
              <Row key={i.edge_id} item={i} onHover={onHover} onScrollTo={onScrollTo} onResolve={onResolve} />
            ))}
          </div>
        </div>
      ) : null}

      {/* the section you're reading — its provenance, keyed to what's in view (Cycle's evidence rail) */}
      <div className="flex flex-col gap-2">
        <Eyebrow>{sectionLabel || "This section"}</Eyebrow>
        {sectionItems.length ? (
          <div className="flex flex-col">
            {sectionItems.map((i) => (
              <Row key={i.edge_id} item={i} onHover={onHover} onScrollTo={onScrollTo} onResolve={onResolve} />
            ))}
          </div>
        ) : (
          <p className="py-1.5 text-[13px] leading-snug text-muted-foreground">No sources cited in this section.</p>
        )}
      </div>
    </div>
  );
}
