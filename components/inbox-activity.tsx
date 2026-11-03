"use client";

// Inbox, Activity — the colleague monitor. Your teammates are working on this project alongside you, and so is
// the agent: here they're peers. AI is a first-class colleague — the Woven agent sits in the same list as the
// people, with a name, a status, and what it's doing. For each colleague you see two things: what they're up to
// (the agent's runs; a person's recent activity + what's waiting on their call), and — because watching isn't
// enough — what you can DO about it: nudge them, or take a stuck change onto your own plate (it moves to your
// Decisions). "The team's" changes that used to clutter the decision queue live here now, attached to whoever
// owns them.

import Link from "next/link";
import * as React from "react";
import { Check, AlertTriangle, ArrowUpRight, ArrowRight, ChevronDown, Bell, Hand } from "lucide-react";
import { cn } from "@/lib/utils";
import { pendingByOwner as selectPendingByOwner, type Pending } from "@/lib/pending";
import { firstName } from "@/lib/text";
import { AgentBand, DIVIDED, FeedHead, undot } from "@/components/inbox-agent-band";
import { NodeMark } from "@/components/entity-profile";
import { PeekTrigger } from "@/components/entity-peek";
import { notify } from "@/lib/notifications";
import {
  claimChange,
  collectionById,
  getArtifact,
  listPeople,
  listRuns,
  personEpisodes,
  RULE_CAPABILITY,
  ruleForRun,
  VIEWER,
} from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import type { AgentRun, LearnedRule, Person, RunStatus } from "@/lib/types";

// The rows' lead column: 28px, the width the old icon wells and avatars took, so every row on this tab keeps
// the text edge the Decisions tab's rows keep — the three lenses are one surface. The mark inside it is 12px
// (the row size of the alphabet, as on the Team list and the review panel) and sits on the line it names: a
// slot one title line tall.
const LEAD = "flex h-(--text-sm--line-height) w-7 shrink-0 items-center justify-center";

// what a run acted under, in words. responsibilityLabel (lib/api) joins the capability and the area with a
// middle dot; the tie is a phrase here, so it takes the comma the house writes.
function responsibilityPhrase(rule: LearnedRule): string {
  const c = collectionById(rule.collectionId);
  return c ? `${RULE_CAPABILITY[rule.edgeType]}, ${c.name}` : RULE_CAPABILITY[rule.edgeType];
}


function StatusBadge({ status }: { status: RunStatus }) {
  if (status === "running")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <span className="size-1.5 animate-pulse rounded-full bg-foreground/40" /> Running
      </span>
    );
  if (status === "needs_you")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium" style={{ color: "var(--warn)" }}>
        <span className="size-1.5 rounded-full" style={{ background: "var(--warn)" }} /> Needs you
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive">
        <AlertTriangle className="size-3" /> Failed
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="size-1.5 rounded-full bg-foreground/20" /> Done
    </span>
  );
}

// a small pill for a colleague's headline state — working / waiting on you / active / idle.
function StatePill({ tone, label }: { tone: "work" | "warn" | "calm"; label: string }) {
  const color = tone === "warn" ? "var(--warn)" : tone === "work" ? "var(--primary)" : undefined;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground"
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

// one of the agent's runs, listed under the agent colleague. It leads with the mark of the thing the run was
// ABOUT — the artifact's rounded square in its collection's hue (dashed while it is still processing, as the
// graph draws it) — not with a lucide well for the run's verb: the title already says the verb, and the alphabet
// is the one thing that tells you which document at a glance. A run with no artifact is collection-scoped by
// the record's own contract (AgentRun.artifactId); which collection lives only in its title, so its mark is the
// collection's shape in the hint ink (the collection rail's rest ink — a muted-foreground square was the darkest
// mark in the feed) — the kind is known, the identity is not claimed. The mark sits on the TITLE line
// (the status line rides above it), because it names what the title names.
// The tie to Governance ("under Note who's mentioned, Growth") used to wear the agent's 12px seal: the agent
// credited a second time on the row, under the band that already credits it. It is a plain muted link now.
function RunRow({ r, onReview, onOpenGovernance }: { r: AgentRun; onReview?: () => void; onOpenGovernance?: () => void }) {
  const art = r.artifactId ? getArtifact(r.artifactId) : undefined;
  const rule = ruleForRun(r); // set when Woven ran this autonomously — the tie back to the responsibility in Governance
  return (
    <div className="flex items-start gap-3 px-3.5 py-2.5">
      <span className={cn(LEAD, "mt-[calc(var(--text-xs--line-height)+2px)]")}>
        {r.artifactId ? (
          <NodeMark node={{ id: r.artifactId, kind: "artifact" }} className="size-3" pending={art?.state === "processing"} />
        ) : (
          <NodeMark node={{ id: r.id, kind: "collection" }} className="size-3" fill="var(--foreground-hint)" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <StatusBadge status={r.status} />
          <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
          <span className="text-xs tabular-nums text-muted-foreground">{r.at}</span>
        </div>
        <p className="mt-0.5 text-sm font-medium text-foreground">{undot(r.title)}</p>
        {r.result ? <p className="mt-0.5 text-xs text-muted-foreground">{undot(r.result)}</p> : null}
        {rule ? (
          <button
            type="button"
            onClick={onOpenGovernance}
            className="mt-1 rounded-sm text-left text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
          >
            Under{" "}
            <span className="underline decoration-foreground-hint decoration-dotted underline-offset-2">{responsibilityPhrase(rule)}</span>
          </button>
        ) : null}
        {r.steps && r.status === "running" ? (
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {r.steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="flex size-4 items-center justify-center">
                  {s.done ? (
                    <Check className="size-3.5 text-primary" />
                  ) : (
                    <span className="size-1.5 animate-pulse rounded-full bg-foreground/40" />
                  )}
                </span>
                <span className={cn(s.done && "text-muted-foreground")}>{undot(s.label)}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {r.status === "needs_you" && (r.kind === "link" || r.kind === "verify") && onReview ? (
        <button
          type="button"
          onClick={onReview}
          className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-sm font-medium text-foreground transition-colors hover:bg-tint-1"
        >
          Review <ArrowRight className="size-3.5" />
        </button>
      ) : art ? (
        // the door to the document. Below sm its name goes and the arrow stays: at 390 the shrink-0 name took
        // half the row and wrapped the run's own title to two words a line, and the row's mark already says
        // which document it is
        <Link
          href={`/artifact/${art.id}`}
          aria-label={`Open ${undot(art.title)}`}
          className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-tint-1 hover:text-foreground"
        >
          <span className="max-w-[14rem] truncate max-sm:hidden">{undot(art.title)}</span>
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
    <div className="mt-2.5 rounded-lg bg-tint-1">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="size-1.5 shrink-0 rounded-full" style={{ background: "var(--warn)" }} />
        <span className="text-xs">
          <span className="font-medium tabular-nums">{pending.length}</span>{" "}
          {pending.length === 1 ? "change" : "changes"} waiting on {firstName(person.name)}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onNudge}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-tint-1 hover:text-foreground"
          >
            <Bell className="size-3.5" /> Nudge
          </button>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? "Collapse" : "Expand"}
            aria-expanded={open}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-tint-1 hover:text-foreground"
          >
            <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          </button>
        </span>
      </div>
      {open ? (
        <div className="flex flex-col px-3 pb-1.5">
          {pending.map((p) => (
            <div key={p.id} className="flex items-center gap-2 border-t border-border py-2">
              {/* the change's subject, in the alphabet — the same mark the row's link opens */}
              <NodeMark node={{ id: p.subjectId, kind: "artifact" }} className="size-3" />
              <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{undot(p.line)}</span>
              <button
                type="button"
                onClick={() => onTakeOver(p)}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-tint-1 hover:text-foreground"
              >
                <Hand className="size-3.5" /> Take over
              </button>
              <Link
                href={`/artifact/${p.subjectId}`}
                aria-label="Open"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-foreground-hint transition-colors hover:bg-tint-1 hover:text-foreground"
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

// a colleague row — the SAME grammar as a RunRow (the 28px lead column, name and role, body, a pill on the
// right), so a person's entry and the agent's run read as siblings in one feed. It leads with the person's
// disc in the alphabet (their identity hue, the hue the Team field draws them in) on the name's line — the
// row is about a person the way a run row is about a document. Border comes from the feed's DIVIDED wrapper.
function ColleagueBlock({
  person,
  name,
  meta,
  pill,
  children,
}: {
  person: Person;
  name: React.ReactNode;
  meta?: string;
  pill: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-3.5 py-3">
      <span className={LEAD}>
        <NodeMark node={{ id: person.id, kind: "person" }} className="size-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">{name}</span>
          {meta ? (
            <>
              <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
              <span className="truncate text-xs text-muted-foreground">{meta}</span>
            </>
          ) : null}
        </div>
        {children ? <div className="mt-0.5">{children}</div> : null}
      </div>
      {pill}
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
    ? `${runs.length} runs, ${needs} awaiting your call`
    : `${runs.length} runs, all caught up`;
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
      <FeedHead key={`h-${status}`} count={group.length} kind={status === "needs_you" ? "demand" : "inventory"}>
        {label}
      </FeedHead>,
    );
    for (const r of group)
      runFeed.push(<RunRow key={r.id} r={r} onReview={onReviewDecisions} onOpenGovernance={onOpenGovernance} />);
  }

  // every pending change, routed to whoever owns it right now (claims respected), grouped by that owner.
  const pendingByOwner = React.useMemo(() => {
    return selectPendingByOwner();
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
      description: `${undot(p.line)}, now in your Decisions.`,
    });
  }

  // ONE feed under the agent band: the agent's runs (grouped by status) then the teammates (grouped under their
  // own header) — every entry the same row grammar, hairline-divided together.
  const feedNodes: React.ReactNode[] = [...runFeed];
  if (!runs.length) {
    feedNodes.push(
      <p key="none" className="px-3.5 py-3 text-xs text-muted-foreground">
        Nothing running.
      </p>,
    );
  }
  if (colleagues.length) {
    feedNodes.push(
      <FeedHead key="h-team" count={colleagues.length} kind="inventory">
        Teammates
      </FeedHead>,
    );
    for (const { person, pending, activity } of colleagues) {
      const act = activity[0];
      const tone: "warn" | "calm" = pending.length ? "warn" : "calm";
      const label = pending.length ? `${pending.length} waiting` : act ? `Active ${act.at}` : "Idle";
      feedNodes.push(
        <ColleagueBlock
          key={person.id}
          person={person}
          name={<PeekTrigger refObj={{ id: person.id, label: person.name, kind: "person" }} />}
          meta={undot(person.role)}
          pill={<StatePill tone={tone} label={label} />}
        >
          {act ? (
            <p className="text-xs text-muted-foreground">
              {undot(act.summary)} <span className="text-muted-foreground">{act.at}</span>
            </p>
          ) : null}
          {pending.length ? (
            <PendingBlock person={person} pending={pending} onNudge={() => nudge(person, pending.length)} onTakeOver={takeOver} />
          ) : null}
        </ColleagueBlock>,
      );
    }
  }

  return (
    <div className="flex flex-col">
      {/* the agent — a first-class colleague, headed by the SAME shared AgentBand */}
      <AgentBand
        className="pb-4"
        state={agentTone === "work" ? "thinking" : "idle"}
        summary={runSummary}
        right={<StatePill tone={agentTone} label={agentLabel} />}
      />
      <div className={cn(DIVIDED, "border-t border-border")}>{feedNodes}</div>
    </div>
  );
}
