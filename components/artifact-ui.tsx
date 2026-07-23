"use client";

import { Link2, Users, FileText, History, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PersonAvatar } from "@/components/identity";
import { cn } from "@/lib/utils";
import { listCollections } from "@/lib/api";
import type { Conn, ConnKind, Person } from "@/lib/types";

// Shared artifact vocabulary — used by the Today cards AND the Artifact page, so the
// two never drift (one system, not two).

// connection kind → icon (the lib stays React/lucide-free; the mapping lives here)
const CONN_ICON: Record<ConnKind, LucideIcon> = {
  link: Link2,
  people: Users,
  sources: FileText,
  version: History,
};

export function StatusPill({ state }: { state: string }) {
  if (state === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        Processing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-primary" />
      Living
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <Badge
      variant="outline"
      className="text-[11px] uppercase tracking-wider text-muted-foreground"
    >
      {type}
    </Badge>
  );
}

// ③ CONNECTIONS — divider + small icons + mono (the graph value, on a card)
export function Connections({ items, className }: { items: Conn[]; className?: string }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-[12px] text-muted-foreground",
        className,
      )}
    >
      {items.map((c) => {
        const Icon = CONN_ICON[c.kind];
        return (
          <span key={c.label} className="inline-flex items-center gap-1.5">
            <Icon className="size-3 opacity-70" />
            {c.label}
          </span>
        );
      })}
    </div>
  );
}

// the people on a document, as a small avatar stack (+N overflow) — the "faces, not stats" card footer signal.
// Shared so every surface (Library grid + row, Today Continue hero) shows participants identically.
export function PeopleStack({ people, className }: { people: Person[]; className?: string }) {
  if (!people.length) return null;
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)} title={people.map((p) => p.name).join(", ")}>
      <span className="flex -space-x-1.5">
        {people.slice(0, 3).map((p) => (
          <PersonAvatar key={p.id} seed={p.id} name={p.name} initials={p.initial} size="xs" className="ring-2 ring-card" />
        ))}
      </span>
      {people.length > 3 ? (
        <span className="text-[12px] tabular-nums text-muted-foreground">+{people.length - 3}</span>
      ) : null}
    </span>
  );
}

// a document can sit in several collections — show the first, fold the rest into a +N that unfolds the full list
// on hover. Shared so a doc reads the same whether it's a row, a grid card, or the Today hero.
export function CollectionTag({ ids, className }: { ids: string[]; className?: string }) {
  // keep the document's own order — the first collection it was filed in leads, the rest fold
  const all = listCollections();
  const cos = ids.flatMap((id) => {
    const c = all.find((x) => x.id === id);
    return c ? [c] : [];
  });
  if (!cos.length) return null;

  const lead = (
    <>
      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: cos[0].color }} />
      <span className="truncate">{cos[0].name}</span>
    </>
  );

  // single collection → a plain tag, no affordance
  if (cos.length === 1) {
    return <span className={cn("inline-flex min-w-0 items-center gap-1.5", className)}>{lead}</span>;
  }

  // several → the +N is the fold; it unfolds every collection in a small light popover. Opens on hover
  // (desktop) AND on tap (mobile) — same panel — via base-ui's openOnHover on a click-triggered Popover.
  // Portaled, so the card's overflow-hidden can't clip it. The tap must not also follow the card's link.
  return (
    <Popover>
      <PopoverTrigger
        nativeButton={false}
        openOnHover
        delay={140}
        render={
          <span
            className={cn("group/col inline-flex min-w-0 items-center gap-1.5 outline-none", className)}
            onClick={(e) => {
              e.preventDefault(); // don't let the tap fall through to the card's link
              e.stopPropagation();
            }}
          />
        }
      >
        {lead}
        <span className="shrink-0 rounded-full bg-secondary px-1 text-[11px] font-medium tabular-nums text-muted-foreground transition-colors group-hover/col:bg-primary/15 group-hover/col:text-foreground">
          +{cos.length - 1}
        </span>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={6} className="w-auto min-w-[8.5rem] p-2">
        <div className="flex flex-col gap-1.5 text-[13px]">
          {cos.map((c) => (
            <span key={c.id} className="inline-flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: c.color }} />
              <span className="truncate">{c.name}</span>
            </span>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
