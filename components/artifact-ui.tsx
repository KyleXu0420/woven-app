import { Link2, Users, FileText, History, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Conn, ConnKind } from "@/lib/types";

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
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        Processing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
      <span className="size-1.5 rounded-full bg-primary" />
      Living
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <Badge
      variant="outline"
      className="text-[10px] uppercase tracking-wider text-muted-foreground"
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
        "flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 font-mono text-[11px] text-muted-foreground",
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
