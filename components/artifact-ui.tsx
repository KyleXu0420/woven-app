import { Link2, Users, FileText, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Conn, ConnKind } from "@/lib/types";

// Shared artifact vocabulary — used by the Today cards AND the Artifact page, so the
// two never drift (one system, not two).

// connection kind → icon (the lib stays React/lucide-free; the mapping lives here)
const CONN_ICON: Record<ConnKind, LucideIcon> = {
  link: Link2,
  people: Users,
  sources: FileText,
};

export function StatusPill({ state }: { state: string }) {
  if (state === "processing") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-muted-foreground" />
        Processing
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/[0.06] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.06em] text-primary">
      <span className="size-1.5 rounded-full bg-current" />
      Living
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  return (
    <Badge
      variant="outline"
      className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground"
    >
      {type}
    </Badge>
  );
}

// ③ CONNECTIONS — divider + small icons + mono (the graph value, on a card)
export function Connections({ items }: { items: Conn[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 font-mono text-[11px] text-muted-foreground">
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
