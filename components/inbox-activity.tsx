"use client";

// Inbox · Activity — the colleague monitor. Your teammates are working on this project alongside you, and so is
// the agent: here they're peers. AI is a first-class colleague — the Woven agent sits in the same list as the
// people, with a name, a status, and what it's doing. For each colleague you see two things: what they're up to
// (the agent's runs; a person's recent activity + what's waiting on their call), and — because watching isn't
// enough — what you can DO about it: nudge them, or take a stuck change onto your own plate (it moves to your
// Decisions). "The team's" changes that used to clutter the decision queue live here now, attached to whoever
// owns them.

import Link from "next/link";
import * as React from "react";
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
  ChevronDown,
  Bell,
  Hand,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PersonAvatar } from "@/components/identity";
import { AgentBand, DIVIDED, FeedHead } from "@/components/inbox-agent-band";
import { PeekTrigger } from "@/components/entity-peek";
import { notify } from "@/lib/notifications";
import {
  claimChange,
  effectiveOwner,
  getArtifact,
  listOpenSuggestions,
  listPending,
  listPeople,
  listRuns,
  personEpisodes,
  responsibilityLabel,
  ruleForRun,
  VIEWER,
} from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { AgentRun, Person, RunKind, RunStatus } from "@/lib/types";

const KIND_ICON: Record<RunKind, LucideIcon> = {
  capture: Sparkles,
  link: Link2,
  draft: PenLine,
  file: FolderInput,
  scan: RefreshCw,
  verify: ShieldCheck,
  summarize: FileSearch,
};

const firstName = (name: string) => name.split(" ")[0];

// a pending change waiting on some colleague's call — flattened from the agent's proposed edges + colleague
// suggestions, routed through effectiveOwner so a claimed one moves off its owner and onto you.
type Pending = { id: string; subjectId: string; line: string; ownerId: string };

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

// a small pill for a colleague's headline state — working / waiting on you / active / idle.
function StatePill({ tone, label }: { tone: "work" | "warn" | "calm"; label: string }) {
  const color = tone === "warn" ? "var(--warn)" : tone === "work" ? "var(--primary)" : undefined;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-muted-foreground"
      style={color ? { color } : undefined}
    >
      <span
        className={cn("size-1.5 rounded-full", tone === "work" && "animate-pulse")}
        style={{ background: color ?? "var(--muted-foreground)", opacity: tone === "calm" ? 0.5 : 1 }}
      />
      {label}
    </span>
  );
}

// one of the agent's runs, listed under the agent colleague.
function RunRow({ r, onReview, onOpenGovernance }: { r: AgentRun; onReview?: () => void; onOpenGovernance?: () => void }) {
  const Icon = KIND_ICON[r.kind];
  const art = r.artifactId ? getArtifact(r.artifactId) : undefined;
  const rule = ruleForRun(r); // set when Woven ran this autonomously — the tie back to the responsibility in Governance
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05] text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StatusBadge status={r.status} />
          <span className="text-[12px] tabular-nums text-muted-foreground">· {r.at}</span>
        </div>
        <p className="mt-0.5 text-[13.5px] font-medium leading-snug text-foreground">{r.title}</p>
        {r.result ? <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{r.result}</p> : null}
        {rule ? (
          <button
            type="button"
            onClick={onOpenGovernance}
            className="mt-1 inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <Sparkles className="size-3 shrink-0 text-primary" /> under{" "}
            <span className="underline decoration-dotted decoration-muted-foreground/50 underline-offset-2">{responsibilityLabel(rule)}</span>
          </button>
        ) : null}
        {r.steps && r.status === "running" ? (
          <ul className="mt-1.5 flex flex-col gap-1.5">
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
      {r.status === "needs_you" && (r.kind === "link" || r.kind === "verify") && onReview ? (
        <button
          type="button"
          onClick={onReview}
          className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md border border-primary/40 px-2.5 py-1 text-[13px] font-medium text-primary transition-colors hover:bg-primary/[0.08]"
        >
          Review <ArrowRight className="size-3.5" />
        </button>
      ) : art ? (
        <Link
          href={`/artifact/${art.id}`}
          className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
        >
          {art.title.length > 20 ? art.title.slice(0, 20) + "…" : art.title}
          <ArrowUpRight className="size-3" />
        </Link>
      ) : null}
    </div>
  );
}

// the changes waiting on one person's call — a count you can nudge them about, and (expanded) each change with a
// "take over" that pulls it onto your own plate.
function PendingBlock({
  person,
  pending,
  onNudge,
  onTakeOver,
}: {
  person: Person;
  pending: Pending[];
  onNudge: () => void;
  onTakeOver: (p: Pending) => void;
}) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="mt-2.5 rounded-lg bg-foreground/[0.03]">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: "var(--warn)" }} />
        <span className="text-[13px]">
          <span className="font-medium tabular-nums">{pending.length}</span>{" "}
          {pending.length === 1 ? "change" : "changes"} waiting on {firstName(person.name)}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onNudge}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <Bell className="size-3.5" /> Nudge
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Collapse" : "Expand"}
            aria-expanded={open}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
          >
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        </span>
      </div>
      {open ? (
        <div className="flex flex-col px-3 pb-1.5">
          {pending.map((p) => (
            <div key={p.id} className="flex items-center gap-2 border-t border-border/40 py-2">
              <span className="min-w-0 flex-1 truncate text-[13px] text-muted-foreground">{p.line}</span>
              <button
                type="button"
                onClick={() => onTakeOver(p)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[12.5px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
              >
                <Hand className="size-3.5" /> Take over
              </button>
              <Link
                href={`/artifact/${p.subjectId}`}
                aria-label="Open"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// the shared block chrome for a colleague — avatar · name · role/meta · a state pill on the right — over its body.
function ColleagueBlock({
  avatar,
  name,
  meta,
  pill,
  children,
}: {
  avatar: React.ReactNode;
  name: React.ReactNode;
  meta?: string;
  pill: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-t border-border/60 py-4 first:border-t-0">
      <div className="flex items-center gap-3">
        {avatar}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="text-[14px] font-medium">{name}</span>
          {meta ? <span className="truncate text-[12.5px] text-muted-foreground">· {meta}</span> : null}
        </div>
        {pill}
      </div>
      {children ? <div className="mt-1 ml-[42px]">{children}</div> : null}
    </div>
  );
}

export function InboxActivity({
  onReviewDecisions,
  onOpenGovernance,
}: {
  onReviewDecisions?: () => void;
  onOpenGovernance?: () => void;
}) {
  const gv = useGraphVersion();
  const runs = listRuns();

  const agentTone: "work" | "warn" | "calm" = runs.some((r) => r.status === "running")
    ? "work"
    : runs.some((r) => r.status === "needs_you")
      ? "warn"
      : "calm";
  const agentLabel = agentTone === "work" ? "Working" : agentTone === "warn" ? "Needs you" : "Idle";
  // the band carries only the rollup; the per-STATUS breakdown is the run feed's group headers below.
  const needs = runs.filter((r) => r.status === "needs_you").length;
  const runSummary = needs
    ? `${runs.length} runs · ${needs} awaiting your call`
    : `${runs.length} runs · all caught up`;
  // the agent's runs, grouped by status (Needs you → Running → Done → Failed) with the shared FeedHead grammar
  const RUN_STATUS: { status: RunStatus; label: string }[] = [
    { status: "needs_you", label: "Needs you" },
    { status: "running", label: "Running" },
    { status: "done", label: "Done" },
    { status: "failed", label: "Failed" },
  ];
  const runFeed: React.ReactNode[] = [];
  for (const { status, label } of RUN_STATUS) {
    const group = runs.filter((r) => r.status === status);
    if (!group.length) continue;
    runFeed.push(
      <FeedHead key={`h-${status}`}>
        {label} · {group.length}
      </FeedHead>,
    );
    for (const r of group)
      runFeed.push(<RunRow key={r.id} r={r} onReview={onReviewDecisions} onOpenGovernance={onOpenGovernance} />);
  }

  // every pending change, routed to whoever owns it right now (claims respected), grouped by that owner.
  const pendingByOwner = React.useMemo(() => {
    const all: Pending[] = [
      ...listPending().map((p) => ({
        id: p.edge_id,
        subjectId: p.fromId,
        line: `${p.fromLabel} → ${p.toLabel}`,
        ownerId: effectiveOwner(p.edge_id, p.fromId),
      })),
      ...listOpenSuggestions().map((s) => ({
        id: s.id,
        subjectId: s.artifactId,
        line: `Edit on ${s.artifactTitle} · § ${s.blockHeading}`,
        ownerId: effectiveOwner(s.id, s.artifactId),
      })),
    ];
    const map = new Map<string, Pending[]>();
    for (const p of all) {
      const arr = map.get(p.ownerId) ?? [];
      arr.push(p);
      map.set(p.ownerId, arr);
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gv]);

  // the human colleagues worth surfacing — anyone (not you) with changes waiting on them or recent activity,
  // those with pending first so you see who's holding things up.
  const colleagues = React.useMemo(
    () =>
      listPeople()
        .filter((p) => p.id !== VIEWER)
        .map((person) => ({
          person,
          pending: pendingByOwner.get(person.id) ?? [],
          activity: personEpisodes(person.id, 1),
        }))
        .filter((c) => c.pending.length > 0 || c.activity.length > 0)
        .sort((a, b) => b.pending.length - a.pending.length),
    [pendingByOwner],
  );

  function nudge(person: Person, count: number) {
    notify.success(`Nudged ${firstName(person.name)}`, {
      description: `${count} ${count === 1 ? "change is" : "changes are"} waiting on their call.`,
    });
  }

  function takeOver(p: Pending) {
    claimChange(p.id);
    notify.success("You took this on", {
      description: `${p.line} — now in your Decisions.`,
    });
  }

  return (
    <div className="flex flex-col">
      {/* the agent — a first-class colleague, headed by the SAME shared AgentBand; its runs grouped by status */}
      <div className="pb-4">
        <AgentBand
          state={agentTone === "work" ? "thinking" : "idle"}
          summary={runSummary}
          right={<StatePill tone={agentTone} label={agentLabel} />}
        />
        {runs.length ? (
          <div className={cn(DIVIDED, "mt-3 border-t border-border/60")}>{runFeed}</div>
        ) : (
          <p className="ml-[42px] mt-1 text-[13px] text-muted-foreground">Nothing running.</p>
        )}
      </div>

      {/* the people */}
      {colleagues.map(({ person, pending, activity }) => {
        const act = activity[0];
        const tone: "warn" | "calm" = pending.length ? "warn" : "calm";
        const label = pending.length ? `${pending.length} waiting` : act ? `Active ${act.at}` : "Idle";
        return (
          <ColleagueBlock
            key={person.id}
            avatar={<PersonAvatar seed={person.id} name={person.name} initials={person.initial} size="default" />}
            name={<PeekTrigger refObj={{ id: person.id, label: person.name, kind: "person" }} />}
            meta={person.role}
            pill={<StatePill tone={tone} label={label} />}
          >
            {act ? (
              <p className="text-[13px] leading-snug text-muted-foreground">
                {act.summary} <span className="text-muted-foreground/70">· {act.at}</span>
              </p>
            ) : null}
            {pending.length ? (
              <PendingBlock
                person={person}
                pending={pending}
                onNudge={() => nudge(person, pending.length)}
                onTakeOver={takeOver}
              />
            ) : null}
          </ColleagueBlock>
        );
      })}
    </div>
  );
}
