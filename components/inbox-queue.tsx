"use client";

// The Inbox = the team's change desk: everything the team + its agents have PROPOSED across the graph, waiting
// on a human before it becomes fact. It's a decision queue, not a notification feed (awareness lives on Today).
// It routes on OWNERSHIP so a team can share it without stepping on each other:
//   • "Needs you" — changes in the collections you own; you hold the ✓/✕.
//   • "The team's" — everything owned by teammates; you follow along, the owner makes the call (read-only here).
// Every change wears its TEAM IDENTITY (a ChangeMeta line): who proposed it (a teammate or an agent), which
// collection/workstream it belongs to, and whose call it is. Participation is felt through those faces — no
// separate dashboard. Proposed links group by their subject doc; colleague suggestions and capture reviews
// ride the same neutral card grammar.

import * as React from "react";
import Link from "next/link";
import {
  Check,
  X,
  CheckCheck,
  FileText,
  ArrowUpRight,
  Copy,
  Archive,
  Sparkles,
  PencilLine,
  type LucideIcon,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ChoiceValve } from "@/components/proposal";
import { MergeSheet } from "@/components/merge-sheet";
import { LinkPeek } from "@/components/entity-peek";
import { toasts, notify } from "@/lib/notifications";
import { PersonAvatar, AgentAvatar } from "@/components/identity";
import {
  applySuggestion,
  changeOwner,
  getArtifact,
  governingCollection,
  listCaptureReviews,
  listOpenSuggestions,
  listPending,
  personById,
  resolveCaptureReview,
  restoreCaptureReview,
  restoreEdge,
  verifyEdge,
  VIEWER,
} from "@/lib/api";
import type { CaptureReview, Collection, Edge, EdgeType, PendingEdge, Ref, ReviewKind } from "@/lib/types";

const VERB: Record<EdgeType, string> = {
  links_to: "links to",
  sourced_from: "sourced from",
  mentions: "mentions",
  in_collection: "in",
  authored_by: "by",
  decided: "decided",
  supersedes: "supersedes",
};

const REVIEW_ICON: Record<ReviewKind, LucideIcon> = {
  duplicate: Copy,
  naming: PencilLine,
  archive: Archive,
  extraction: Sparkles,
};
const REVIEW_LABEL: Record<ReviewKind, string> = {
  duplicate: "Duplicate",
  naming: "Naming",
  archive: "Archive",
  extraction: "Extraction",
};

const firstName = (name: string) => name.split(" ")[0];

// click-to-peek — resolve what a referenced node IS (its gist) without leaving the inbox, so a link decision
// carries the context it needs. Only artifacts/collections resolve to a card; a bare topic stays plain text.
function PeekLink({ refObj, className = "" }: { refObj: Ref; className?: string }) {
  const peekable = refObj.kind === "artifact" || refObj.kind === "collection";
  if (!peekable) return <span className={className}>{refObj.label}</span>;
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={`decoration-muted-foreground/40 underline decoration-dotted underline-offset-2 transition-colors hover:decoration-foreground ${className}`}
          />
        }
      >
        {refObj.label}
      </PopoverTrigger>
      <PopoverContent side="top" align="start" sideOffset={8} className="w-64">
        <LinkPeek linkRef={refObj} />
      </PopoverContent>
    </Popover>
  );
}

// the inbox valve — ✓ FILLED forest (the one confirm colour, unmistakable) + ✕ OUTLINED. On the ghost row
// the surrounding chrome is borderless, so the key action must carry its own boundary; both buttons do.
function LightValve({
  onConfirm,
  onDismiss,
  confirmLabel = "Confirm",
  dismissLabel = "Dismiss",
}: {
  onConfirm: () => void;
  onDismiss: () => void;
  confirmLabel?: string;
  dismissLabel?: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 self-center">
      <button
        type="button"
        aria-label={confirmLabel}
        title={confirmLabel}
        onClick={onConfirm}
        className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
      >
        <Check className="size-4" />
      </button>
      <button
        type="button"
        aria-label={dismissLabel}
        title={dismissLabel}
        onClick={onDismiss}
        className="flex size-7 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

function Sep() {
  return (
    <span className="text-border" aria-hidden="true">
      ·
    </span>
  );
}

// the TEAM IDENTITY every change wears — who proposed it (a teammate or the agent), which collection it belongs
// to, and whose call it is. This is the context a decision needs in a shared workspace; participation reads off
// these faces rather than a separate chart.
type Proposer = { kind: "agent" } | { kind: "person"; id: string; name: string; role?: string };
function ChangeMeta({
  proposer,
  collection,
  ownerId,
  mine,
}: {
  proposer: Proposer;
  collection?: Collection;
  ownerId: string;
  mine: boolean;
}) {
  const owner = personById(ownerId);
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        {proposer.kind === "agent" ? (
          <>
            <AgentAvatar size="xs" />
            <span>Woven agent</span>
          </>
        ) : (
          <>
            <PersonAvatar seed={proposer.id} name={proposer.name} size="xs" />
            <span className="text-foreground/80">{proposer.name}</span>
            {proposer.role ? <span>· {proposer.role}</span> : null}
          </>
        )}
      </span>
      {collection ? (
        <>
          <Sep />
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: collection.color }} />
            {collection.name}
          </span>
        </>
      ) : null}
      <Sep />
      {mine ? (
        <span className="font-medium text-primary">your call</span>
      ) : owner ? (
        <span className="inline-flex items-center gap-1.5">
          <PersonAvatar seed={owner.id} name={owner.name} size="xs" />
          {firstName(owner.name)}&rsquo;s call
        </span>
      ) : null}
    </div>
  );
}

// one proposed link, as a ghost row inside its subject's card: the relation + the peekable target, the agent's
// reason beneath, and — only when it's your call — the light valve. On the team's side it's read-only.
function LinkRow({
  p,
  readOnly,
  onResolve,
}: {
  p: PendingEdge;
  readOnly?: boolean;
  onResolve: (action: "confirm" | "discard") => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-foreground/[0.03]">
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-snug">
          <span className="text-muted-foreground">{VERB[p.type]} </span>
          <PeekLink refObj={{ id: p.toId, label: p.toLabel, kind: p.toKind }} className="font-medium text-foreground" />
        </p>
        {p.rationale ? (
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{p.rationale}</p>
        ) : null}
      </div>
      {readOnly ? null : (
        <LightValve
          onConfirm={() => onResolve("confirm")}
          onDismiss={() => onResolve("discard")}
          confirmLabel="Confirm"
          dismissLabel="Discard"
        />
      )}
    </div>
  );
}

// a neutral card holding every proposed link ABOUT one doc — its gist for context, its team identity, the links
// as ghost rows. When it's your call: a group Confirm all + valves. On the team's side: read-only awareness.
function SubjectCard({
  fromId,
  label,
  edges,
  collection,
  ownerId,
  mine,
  onResolve,
  onConfirmGroup,
}: {
  fromId: string;
  label: string;
  edges: PendingEdge[];
  collection?: Collection;
  ownerId: string;
  mine: boolean;
  onResolve: (p: PendingEdge, action: "confirm" | "discard") => void;
  onConfirmGroup: (edges: PendingEdge[]) => void;
}) {
  const a = getArtifact(fromId);
  return (
    <div className="border-t border-border/60 py-4 first:border-t-0">
      <div className="flex items-start gap-3">
        <span className="mt-px flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05] text-muted-foreground">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PeekLink
              refObj={{ id: fromId, label, kind: "artifact" }}
              className="truncate text-[14px] font-medium text-foreground decoration-transparent"
            />
            {a?.type ? <span className="shrink-0 text-[12px] text-muted-foreground">{a.type}</span> : null}
            <span className="ml-auto flex shrink-0 items-center gap-1">
              {mine && edges.length > 1 ? (
                <button
                  type="button"
                  onClick={() => onConfirmGroup(edges)}
                  className="inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[12px] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
                >
                  <CheckCheck className="size-3.5 text-primary" /> Confirm all {edges.length}
                </button>
              ) : null}
              <Link
                href={`/artifact/${fromId}`}
                aria-label={`Open ${label}`}
                className="flex size-6 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
              >
                <ArrowUpRight className="size-4" />
              </Link>
            </span>
          </div>
          {a?.gist ? <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{a.gist}</p> : null}
          <ChangeMeta proposer={{ kind: "agent" }} collection={collection} ownerId={ownerId} mine={mine} />
        </div>
      </div>

      {/* the proposed links, nested under the doc title so it stays clear which doc they're about */}
      <div className="mt-1.5 ml-11 flex flex-col">
        {edges.map((p) => (
          <LinkRow key={p.edge_id} p={p} readOnly={!mine} onResolve={(action) => onResolve(p, action)} />
        ))}
      </div>
    </div>
  );
}

// a capture review — same neutral card, its choices in a footer block (ghost, the recommended path lightly
// inked). Your own drops, so these always sit under "Needs you." One per drop.
function ReviewCard({ r, onChoose }: { r: CaptureReview; onChoose: (id: string) => void }) {
  const Icon = REVIEW_ICON[r.kind];
  return (
    <div className="border-t border-border/60 py-4 first:border-t-0">
      <div className="flex items-start gap-3">
        <span className="mt-px flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05] text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[14px] font-medium leading-snug">{r.title}</p>
            <span className="shrink-0 rounded-[4px] bg-foreground/[0.06] px-1.5 py-0.5 text-[11px] font-medium leading-none text-muted-foreground">
              {REVIEW_LABEL[r.kind]}
            </span>
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{r.detail}</p>
        </div>
      </div>
      <div className="mt-3 ml-11">
        <ChoiceValve actions={r.actions} onChoose={onChoose} />
      </div>
    </div>
  );
}

type OpenSuggestion = ReturnType<typeof listOpenSuggestions>[number];

// a colleague's suggested edit — unified into the same queue as the agent's proposals, wearing the same team
// identity (who suggested it · which collection · whose call). Apply / Dismiss only when it's your call.
function SuggestionCard({
  s,
  collection,
  ownerId,
  mine,
  onResolve,
}: {
  s: OpenSuggestion;
  collection?: Collection;
  ownerId: string;
  mine: boolean;
  onResolve: (apply: boolean) => void;
}) {
  const person = personById(s.author);
  const name = person?.name ?? s.author;
  return (
    <div className="border-t border-border/60 py-4 first:border-t-0">
      <div className="flex items-start gap-3">
        <span className="mt-px flex size-8 shrink-0 items-center justify-center rounded-lg bg-foreground/[0.05] text-muted-foreground">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PeekLink
              refObj={{ id: s.artifactId, label: s.artifactTitle, kind: "artifact" }}
              className="truncate text-[14px] font-medium text-foreground decoration-transparent"
            />
            <span className="shrink-0 truncate text-[13px] text-muted-foreground">§ {s.blockHeading}</span>
            <Link
              href={`/artifact/${s.artifactId}`}
              aria-label={`Open ${s.artifactTitle}`}
              className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          <ChangeMeta
            proposer={{ kind: "person", id: s.author, name, role: person?.role }}
            collection={collection}
            ownerId={ownerId}
            mine={mine}
          />
        </div>
      </div>

      {/* the change, nested under the doc — held in a faint inset (not a card) so it stays ghost but legible */}
      <div className="mt-2.5 ml-11">
        {s.text ? <p className="mb-2 text-[13px] leading-snug text-muted-foreground">{s.text}</p> : null}
        <div className="rounded-lg bg-foreground/[0.03] p-2.5">
          <p className="text-[13px] leading-relaxed text-foreground">{s.after}</p>
          <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground line-through decoration-foreground/25">
            {s.before}
          </p>
        </div>
        {mine ? (
          <div className="mt-2.5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => onResolve(true)}
              className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-colors hover:bg-[var(--primary-hover)]"
            >
              <Check className="size-3.5" /> Apply edit
            </button>
            <button
              type="button"
              onClick={() => onResolve(false)}
              className="inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// a section of the desk — "Needs you" or "The team's" — a quiet header (label + count + one-line who-it's-for)
// over its stack of cards.
function Section({
  title,
  count,
  hint,
  children,
}: {
  title: string;
  count: number;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2">
        <h2 className="text-[14px] font-medium tracking-[-0.01em] text-foreground">{title}</h2>
        <span className="text-[12px] tabular-nums text-muted-foreground">{count}</span>
      </div>
      <p className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</p>
      <div className="mt-2">{children}</div>
    </section>
  );
}

export function InboxQueue() {
  const [reviews, setReviews] = React.useState<CaptureReview[]>(() => listCaptureReviews());
  const [pending, setPending] = React.useState<PendingEdge[]>(() => listPending());
  const [suggestions, setSuggestions] = React.useState<OpenSuggestion[]>(() => listOpenSuggestions());
  const [merging, setMerging] = React.useState<CaptureReview | null>(null);

  // group the proposed links by the doc they originate from, then stamp each group with its team identity — the
  // collection that governs it and the person who holds its approve.
  const groups = React.useMemo(() => {
    const map = new Map<string, PendingEdge[]>();
    for (const p of pending) {
      const arr = map.get(p.fromId) ?? [];
      arr.push(p);
      map.set(p.fromId, arr);
    }
    return [...map.entries()].map(([fromId, edges]) => ({
      fromId,
      label: edges[0].fromLabel,
      edges,
      collection: governingCollection(fromId),
      ownerId: changeOwner(fromId),
    }));
  }, [pending]);

  function resolveReview(r: CaptureReview, actionId: string) {
    if (actionId === "merge" && r.kind === "duplicate" && r.dupeArtifactIds) {
      setMerging(r);
      return;
    }
    const action = r.actions.find((a) => a.id === actionId);
    resolveCaptureReview(r.id);
    setReviews((list) => list.filter((x) => x.id !== r.id));
    toasts.reviewResolved(action?.label ?? "Resolved", r.title, {
      label: "Undo",
      onClick: () => {
        restoreCaptureReview(r);
        setReviews((list) => [r, ...list]);
      },
    });
  }

  function finishMerge(r: CaptureReview, survivorId: string, loserId: string) {
    resolveCaptureReview(r.id);
    setReviews((list) => list.filter((x) => x.id !== r.id));
    const survivor = getArtifact(survivorId)?.title ?? "canonical";
    const loser = getArtifact(loserId)?.title ?? "duplicate";
    toasts.reviewResolved("Merged", `${loser} → ${survivor}`);
  }

  function resolve(p: PendingEdge, action: "confirm" | "discard") {
    const prev = verifyEdge(p.edge_id, action);
    setPending((list) => list.filter((x) => x.edge_id !== p.edge_id));
    const undo = prev
      ? {
          label: "Undo",
          onClick: () => {
            restoreEdge(prev);
            setPending((list) => [p, ...list].sort((a, b) => b.confidence - a.confidence));
          },
        }
      : undefined;
    const desc = `${p.fromLabel} ${VERB[p.type]} ${p.toLabel}`;
    if (action === "confirm") toasts.linkConfirmed(desc, undo);
    else toasts.proposalDismissed(desc, undo);
  }

  function resolveSuggestion(s: OpenSuggestion, apply: boolean) {
    applySuggestion(s.discussionId, apply);
    setSuggestions((list) => list.filter((x) => x.id !== s.id));
    const who = personById(s.author)?.name ?? "A teammate";
    notify.success(apply ? "Suggestion applied" : "Suggestion dismissed", {
      description: `${who} · ${s.artifactTitle} · ${s.blockHeading}`,
    });
  }

  function confirmGroup(edges: PendingEdge[]) {
    const ids = new Set(edges.map((e) => e.edge_id));
    const prevs = edges.map((p) => verifyEdge(p.edge_id, "confirm")).filter((e): e is Edge => Boolean(e));
    setPending((list) => list.filter((x) => !ids.has(x.edge_id)));
    toasts.linksConfirmed(edges.length, {
      label: "Undo",
      onClick: () => {
        prevs.forEach(restoreEdge);
        setPending((list) => [...edges, ...list].sort((a, b) => b.confidence - a.confidence));
      },
    });
  }

  // route on ownership — your collections' changes need you; the rest are the team's to call.
  const mineGroups = groups.filter((g) => g.ownerId === VIEWER);
  const teamGroups = groups.filter((g) => g.ownerId !== VIEWER);
  const mineSugs = suggestions.filter((s) => changeOwner(s.artifactId) === VIEWER);
  const teamSugs = suggestions.filter((s) => changeOwner(s.artifactId) !== VIEWER);

  const mineCount = mineGroups.reduce((n, g) => n + g.edges.length, 0) + mineSugs.length + reviews.length;
  const teamCount = teamGroups.reduce((n, g) => n + g.edges.length, 0) + teamSugs.length;

  if (reviews.length === 0 && pending.length === 0 && suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border py-14 text-center">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCheck className="size-4.5" />
        </span>
        <p className="text-lg font-medium">Inbox zero</p>
        <p className="max-w-xs text-[15px] text-muted-foreground">
          Nothing to adjudicate. Every drop is filed and every proposed change is confirmed or cleared.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-9">
      <Section title="Needs you" count={mineCount} hint="Your call before any of these become fact.">
        {mineCount === 0 ? (
          <p className="rounded-xl border border-dashed py-6 text-center text-[13px] text-muted-foreground">
            You&rsquo;re all clear — nothing waiting on you.
          </p>
        ) : (
          <div className="flex flex-col">
            {mineGroups.map((g) => (
              <SubjectCard key={g.fromId} {...g} mine onResolve={resolve} onConfirmGroup={confirmGroup} />
            ))}
            {mineSugs.map((s) => (
              <SuggestionCard
                key={s.id}
                s={s}
                collection={governingCollection(s.artifactId)}
                ownerId={changeOwner(s.artifactId)}
                mine
                onResolve={(apply) => resolveSuggestion(s, apply)}
              />
            ))}
            {reviews.map((r) => (
              <ReviewCard key={r.id} r={r} onChoose={(id) => resolveReview(r, id)} />
            ))}
          </div>
        )}
      </Section>

      {teamCount > 0 ? (
        <Section title="The team's" count={teamCount} hint="Owned by teammates — follow along; the owner makes the call.">
          <div className="flex flex-col">
            {teamGroups.map((g) => (
              <SubjectCard key={g.fromId} {...g} mine={false} onResolve={resolve} onConfirmGroup={confirmGroup} />
            ))}
            {teamSugs.map((s) => (
              <SuggestionCard
                key={s.id}
                s={s}
                collection={governingCollection(s.artifactId)}
                ownerId={changeOwner(s.artifactId)}
                mine={false}
                onResolve={(apply) => resolveSuggestion(s, apply)}
              />
            ))}
          </div>
        </Section>
      ) : null}

      {merging?.dupeArtifactIds ? (
        <MergeSheet
          aId={merging.dupeArtifactIds[0]}
          bId={merging.dupeArtifactIds[1]}
          open={!!merging}
          onOpenChange={(o) => {
            if (!o) setMerging(null);
          }}
          onMerged={(survivorId, loserId) => finishMerge(merging, survivorId, loserId)}
        />
      ) : null}
    </div>
  );
}
