"use client";

// The Inbox = the product-scale trust valve: everything the agent has PROPOSED across the graph, waiting for
// your call before it becomes fact. It's a decision queue, not a notification feed (awareness — "what happened"
// — lives on Today's Catch-up). Two moves make it fast to adjudicate:
//   • Grouped by the doc they're about — one neutral card per subject artifact, its gist right there so you
//     know what you're deciding on, its proposed links as ghost rows, a group-level Confirm all.
//   • Every referenced node is a click-to-peek (its gist without leaving), so a link decision carries the
//     context the decision needs.
// Capture reviews (dupe / naming / archive / extraction) ride the same neutral card grammar, one per drop.

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
import { PersonAvatar } from "@/components/identity";
import {
  applySuggestion,
  getArtifact,
  listCaptureReviews,
  listOpenSuggestions,
  listPending,
  personById,
  resolveCaptureReview,
  restoreCaptureReview,
  restoreEdge,
  verifyEdge,
} from "@/lib/api";
import type { CaptureReview, Edge, EdgeType, PendingEdge, Ref, ReviewKind } from "@/lib/types";

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

// the light inbox valve — ✓ forest-inked + ✕ muted, both ghost (no filled circle). The card is neutral, so the
// confirm reads by its forest ink, not a heavy fill; self-centered against a two-line row.
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
    <div className="flex shrink-0 items-center gap-0.5 self-center">
      <button
        type="button"
        aria-label={confirmLabel}
        title={confirmLabel}
        onClick={onConfirm}
        className="flex size-7 items-center justify-center rounded-md text-primary transition-colors hover:bg-primary/[0.1]"
      >
        <Check className="size-4" />
      </button>
      <button
        type="button"
        aria-label={dismissLabel}
        title={dismissLabel}
        onClick={onDismiss}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}

// one proposed link, as a ghost row inside its subject's card: the relation + the peekable target, the agent's
// reason beneath, and the light valve.
function LinkRow({ p, onResolve }: { p: PendingEdge; onResolve: (action: "confirm" | "discard") => void }) {
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
      <LightValve
        onConfirm={() => onResolve("confirm")}
        onDismiss={() => onResolve("discard")}
        confirmLabel="Confirm"
        dismissLabel="Discard"
      />
    </div>
  );
}

// a neutral card holding every proposed link ABOUT one doc — its gist for context, the links as ghost rows,
// a group Confirm all so you clear a whole doc's connections in one move.
function SubjectCard({
  fromId,
  label,
  edges,
  onResolve,
  onConfirmGroup,
}: {
  fromId: string;
  label: string;
  edges: PendingEdge[];
  onResolve: (p: PendingEdge, action: "confirm" | "discard") => void;
  onConfirmGroup: (edges: PendingEdge[]) => void;
}) {
  const a = getArtifact(fromId);
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <span className="mt-px flex size-8 shrink-0 items-center justify-center rounded-lg border bg-secondary text-muted-foreground">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PeekLink
              refObj={{ id: fromId, label, kind: "artifact" }}
              className="truncate text-[15px] font-semibold text-foreground decoration-transparent"
            />
            {a?.type ? <span className="shrink-0 text-[12px] text-muted-foreground">{a.type}</span> : null}
            <Link
              href={`/artifact/${fromId}`}
              aria-label={`Open ${label}`}
              className="ml-auto flex size-6 shrink-0 items-center justify-center rounded-md text-muted-foreground/70 transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
          {a?.gist ? <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{a.gist}</p> : null}
        </div>
      </div>

      <div className="mx-4 h-px bg-border" />

      <div className="flex flex-col p-2">
        {edges.map((p) => (
          <LinkRow key={p.edge_id} p={p} onResolve={(action) => onResolve(p, action)} />
        ))}
      </div>

      {edges.length > 1 ? (
        <>
          <div className="mx-4 h-px bg-border" />
          <div className="px-4 py-2.5">
            <button
              type="button"
              onClick={() => onConfirmGroup(edges)}
              className="-ml-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
            >
              <CheckCheck className="size-4 text-primary" /> Confirm all {edges.length}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

// a capture review — same neutral card, its choices in a footer block (ghost, the recommended path lightly
// inked). One per drop.
function ReviewCard({ r, onChoose }: { r: CaptureReview; onChoose: (id: string) => void }) {
  const Icon = REVIEW_ICON[r.kind];
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <span className="mt-px flex size-8 shrink-0 items-center justify-center rounded-lg border bg-secondary text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[15px] font-semibold leading-snug">{r.title}</p>
            <span className="shrink-0 rounded-[4px] bg-foreground/[0.06] px-1.5 py-0.5 text-[11px] font-medium leading-none text-muted-foreground">
              {REVIEW_LABEL[r.kind]}
            </span>
          </div>
          <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{r.detail}</p>
        </div>
      </div>
      <div className="mx-4 h-px bg-border" />
      <div className="px-4 py-2.5">
        <ChoiceValve actions={r.actions} onChoose={onChoose} />
      </div>
    </div>
  );
}

type OpenSuggestion = ReturnType<typeof listOpenSuggestions>[number];

// a colleague's suggested edit — unified into the same queue as the agent's proposals. Subject doc · who ·
// the proposed text (the old struck beneath) · Apply / Dismiss. A named verb, so it carries labels rather than
// the bare ✓/✕ valve the agent's link rows use.
function SuggestionCard({ s, onResolve }: { s: OpenSuggestion; onResolve: (apply: boolean) => void }) {
  const name = personById(s.author)?.name ?? s.author;
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-start gap-3 px-4 pb-3 pt-3.5">
        <span className="mt-px flex size-8 shrink-0 items-center justify-center rounded-lg border bg-secondary text-muted-foreground">
          <FileText className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <PeekLink
              refObj={{ id: s.artifactId, label: s.artifactTitle, kind: "artifact" }}
              className="truncate text-[15px] font-semibold text-foreground decoration-transparent"
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
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted-foreground">
            <PersonAvatar seed={s.author} name={name} size="xs" />
            <span className="font-medium text-foreground/80">{name}</span> suggested an edit
          </p>
        </div>
      </div>

      <div className="mx-4 h-px bg-border" />

      <div className="px-4 py-3">
        <p className="text-[13px] leading-snug text-muted-foreground">{s.text}</p>
        <div className="mt-2.5 rounded-lg border p-2.5">
          <p className="text-[13px] leading-relaxed text-foreground">{s.after}</p>
          <p className="mt-1.5 text-[12px] leading-snug text-muted-foreground line-through decoration-foreground/25">
            {s.before}
          </p>
        </div>
      </div>

      <div className="mx-4 h-px bg-border" />

      <div className="flex items-center gap-2 px-4 py-2.5">
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
          className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}

export function InboxQueue() {
  const [reviews, setReviews] = React.useState<CaptureReview[]>(() => listCaptureReviews());
  const [pending, setPending] = React.useState<PendingEdge[]>(() => listPending());
  const [suggestions, setSuggestions] = React.useState<OpenSuggestion[]>(() => listOpenSuggestions());
  const [merging, setMerging] = React.useState<CaptureReview | null>(null);

  // group the proposed links by the doc they originate from — so you decide a doc's connections together, and
  // the repeated "Notification Strategy v3 → …" collapses into one card.
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
      confidence: Math.max(...edges.map((e) => e.confidence)),
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

  if (reviews.length === 0 && pending.length === 0 && suggestions.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border py-14 text-center">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCheck className="size-4.5" />
        </span>
        <p className="text-lg font-medium">Inbox zero</p>
        <p className="max-w-xs text-[15px] text-muted-foreground">
          Nothing to adjudicate. Every drop is filed and every proposed link is confirmed or cleared.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {groups.map((g) => (
        <SubjectCard
          key={g.fromId}
          fromId={g.fromId}
          label={g.label}
          edges={g.edges}
          onResolve={resolve}
          onConfirmGroup={confirmGroup}
        />
      ))}
      {suggestions.map((s) => (
        <SuggestionCard key={s.id} s={s} onResolve={(apply) => resolveSuggestion(s, apply)} />
      ))}
      {reviews.map((r) => (
        <ReviewCard key={r.id} r={r} onChoose={(id) => resolveReview(r, id)} />
      ))}

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
