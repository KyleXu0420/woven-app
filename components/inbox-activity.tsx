"use client";

// Inbox · Activity — the run monitor. Each row is a command the agent is running or has run: a kind glyph, a
// status (running · needs you · done · failed), what it did, and the artifact it touched. The "what happened"
// made legible — status carried by a badge + colour (reserved for run-state), not prose.

import Link from "next/link";
import {
  Sparkles,
  Link2,
  PenLine,
  FolderInput,
  RefreshCw,
  ShieldCheck,
  FileSearch,
  Check,
  AlertTriangle,
  ArrowUpRight,
  ArrowRight,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getArtifact, listRuns } from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { RunKind, RunStatus } from "@/lib/types";

const KIND_ICON: Record<RunKind, LucideIcon> = {
  capture: Sparkles,
  link: Link2,
  draft: PenLine,
  file: FolderInput,
  scan: RefreshCw,
  verify: ShieldCheck,
  summarize: FileSearch,
};

function StatusBadge({ status }: { status: RunStatus }) {
  if (status === "running")
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-foreground/40" /> Running
      </span>
    );
  if (status === "needs_you")
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: "var(--warn)" }}>
        <span className="size-1.5 rounded-full" style={{ background: "var(--warn)" }} /> Needs you
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-destructive">
        <AlertTriangle className="size-3" /> Failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground">
      <span className="size-1.5 rounded-full bg-foreground/20" /> Done
    </span>
  );
}

export function InboxActivity({ onReviewDecisions }: { onReviewDecisions?: () => void }) {
  useGraphVersion();
  const runs = listRuns();

  if (runs.length === 0)
    return <p className="py-12 text-center text-[14px] text-muted-foreground">The agent hasn't run anything yet.</p>;

  return (
    <div className="flex flex-col">
      {runs.map((r) => {
        const Icon = KIND_ICON[r.kind];
        const art = r.artifactId ? getArtifact(r.artifactId) : undefined;
        return (
          <div key={r.id} className="flex items-start gap-3 border-t border-border/60 py-3.5 first:border-t-0">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05] text-muted-foreground">
              <Icon className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                <span className="text-[12px] tabular-nums text-muted-foreground">· {r.at}</span>
              </div>
              <p className="mt-1 text-[14px] font-medium leading-snug text-foreground">{r.title}</p>
              {r.result ? <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{r.result}</p> : null}
              {r.steps && r.status === "running" ? (
                <ul className="mt-2 flex flex-col gap-1.5">
                  {r.steps.map((s, i) => (
                    <li key={i} className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <span className="flex size-4 items-center justify-center">
                        {s.done ? (
                          <Check className="size-3.5 text-primary" />
                        ) : (
                          <span className="size-1.5 animate-pulse rounded-full bg-foreground/40" />
                        )}
                      </span>
                      <span className={cn(s.done && "text-foreground/70")}>{s.label}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            {r.status === "needs_you" && (r.kind === "link" || r.kind === "verify") && onReviewDecisions ? (
              <button
                type="button"
                onClick={onReviewDecisions}
                className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1 text-[13px] font-medium text-primary transition-colors hover:bg-primary/[0.08]"
              >
                Review <ArrowRight className="size-3.5" />
              </button>
            ) : art ? (
              <Link
                href={`/artifact/${art.id}`}
                className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
              >
                {art.title.length > 22 ? art.title.slice(0, 22) + "…" : art.title}
                <ArrowUpRight className="size-3" />
              </Link>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
