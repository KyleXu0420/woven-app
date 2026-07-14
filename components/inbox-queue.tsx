"use client";

// The Inbox = the team's change desk, and it answers ONE question: what's waiting on your call? Everything else
// yields to that. (What the agent is running lives in Activity; how far it may act, in Governance; what merely
// happened, in Today's Catch-up.) Two zones, routed on ownership:
//   • "Needs you" — a flat priority stream. One row per change (no doc nesting), each carrying its own identity:
//     who proposed it (the agent, or a teammate), which collection it belongs to, and its reason. Because the
//     whole zone is your call, no row repeats "your call". Confirm / dismiss right on the row.
//   • "The team's" — a collapsed digest. One line per workstream ("Growth · 3 changes · waiting on Jordan"),
//     expandable to read-only rows. You stay aware; the owner decides.
// Capture reviews (your own drops) sit at the end of "Needs you".

import * as React from "react";
import { Check, X, CheckCheck, Copy, Archive, Sparkles, PencilLine, type LucideIcon } from "lucide-react";
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
import type { CaptureReview, Collection, EdgeType, PendingEdge, Ref, ReviewKind } from "@/lib/types";

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

// a change as it flows through the desk — an agent-proposed edge or a colleague's suggested edit, each stamped
// with the collection that governs it and the person who holds its approve.
type Change =
  | { kind: "edge"; p: PendingEdge; collection?: Collection; ownerId: string; priority: number }
  | { kind: "suggestion"; s: OpenSuggestion; collection?: Collection; ownerId: string; priority: number };
type OpenSuggestion = ReturnType<typeof listOpenSuggestions>[number];
const changeKey = (c: Change) => (c.kind === "edge" ? c.p.edge_id : c.s.id);

// click-to-peek — resolve what a referenced node IS (its gist) without leaving the inbox, so a decision carries
// its context. Only artifacts/collections resolve to a card; a bare topic stays plain text.
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

// the inbox valve — ✓ FILLED forest (the one confirm colour) + ✕ OUTLINED. The row chrome is borderless, so the
// key action carries its own boundary.
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

function CollectionStamp({ collection }: { collection: Collection }) {
  return (
    <span className="mt-0.5 inline-flex shrink-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
      <span className="size-2.5 shrink-0 rounded-[3px]" style={{ background: collection.color }} />
      {collection.name}
    </span>
  );
}

// one change, one row — the whole priority stream is these. The proposer avatar (agent mark / teammate) reads
// who; the sentence reads what; the collection stamp reads where; the line beneath reads why. The valve is on
// the row when it's your call, and absent (read-only) on the team's side.
function ChangeRow({
  c,
  readOnly,
  onEdge,
  onSuggestion,
}: {
  c: Change;
  readOnly?: boolean;
  onEdge: (p: PendingEdge, action: "confirm" | "discard") => void;
  onSuggestion: (s: OpenSuggestion, apply: boolean) => void;
}) {
  const author = c.kind === "suggestion" ? personById(c.s.author) : undefined;
  return (
    <div className="flex items-start gap-3 border-t border-border/50 py-3 first:border-t-0">
      {c.kind === "edge" ? (
        <AgentAvatar size="sm" className="mt-0.5" />
      ) : (
        <PersonAvatar
          seed={c.s.author}
          name={author?.name ?? c.s.author}
          initials={author?.initial}
          size="sm"
          className="mt-0.5"
        />
      )}

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="min-w-0 flex-1 text-[14px] leading-snug">
            {c.kind === "edge" ? (
              <>
                <PeekLink
                  refObj={{ id: c.p.fromId, label: c.p.fromLabel, kind: "artifact" }}
                  className="font-medium text-foreground"
                />
                <span className="text-muted-foreground"> {VERB[c.p.type]} </span>
                <PeekLink
                  refObj={{ id: c.p.toId, label: c.p.toLabel, kind: c.p.toKind }}
                  className="font-medium text-foreground"
                />
              </>
            ) : (
              <>
                <span className="font-medium text-foreground">{author?.name ?? c.s.author}</span>
                <span className="text-muted-foreground"> suggested an edit on </span>
                <PeekLink
                  refObj={{ id: c.s.artifactId, label: c.s.artifactTitle, kind: "artifact" }}
                  className="font-medium text-foreground"
                />
                <span className="text-muted-foreground"> · § {c.s.blockHeading}</span>
              </>
            )}
          </p>
          {c.collection ? <CollectionStamp collection={c.collection} /> : null}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[13px] leading-snug text-muted-foreground">
          {c.kind === "edge" ? c.p.rationale : c.s.after}
        </p>
      </div>

      {readOnly ? null : c.kind === "edge" ? (
        <LightValve
          onConfirm={() => onEdge(c.p, "confirm")}
          onDismiss={() => onEdge(c.p, "discard")}
          confirmLabel="Confirm"
          dismissLabel="Discard"
        />
      ) : (
        <LightValve
          onConfirm={() => onSuggestion(c.s, true)}
          onDismiss={() => onSuggestion(c.s, false)}
          confirmLabel="Apply edit"
          dismissLabel="Dismiss"
        />
      )}
    </div>
  );
}

// a capture review — your own drop, so it sits under "Needs you". A genuine multi-choice (merge / rename /
// archive / …), so it keeps its labelled ChoiceValve rather than the bare ✓ / ✕.
function ReviewCard({ r, onChoose }: { r: CaptureReview; onChoose: (id: string) => void }) {
  const Icon = REVIEW_ICON[r.kind];
  return (
    <div className="flex items-start gap-3 border-t border-border/50 py-3 first:border-t-0">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-foreground/[0.05] text-muted-foreground">
        <Icon className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="min-w-0 flex-1 truncate text-[14px] font-medium leading-snug">{r.title}</p>
          <span className="shrink-0 rounded-[4px] bg-foreground/[0.06] px-1.5 py-0.5 text-[11px] font-medium leading-none text-muted-foreground">
            {REVIEW_LABEL[r.kind]}
          </span>
        </div>
        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">{r.detail}</p>
        <div className="mt-2.5">
          <ChoiceValve actions={r.actions} onChoose={onChoose} />
        </div>
      </div>
    </div>
  );
}

export function InboxQueue() {
  const [reviews, setReviews] = React.useState<CaptureReview[]>(() => listCaptureReviews());
  const [pending, setPending] = React.useState<PendingEdge[]>(() => listPending());
  const [suggestions, setSuggestions] = React.useState<OpenSuggestion[]>(() => listOpenSuggestions());
  const [merging, setMerging] = React.useState<CaptureReview | null>(null);

  // one flat stream: agent edges (by confidence) + colleague suggestions (a human asked, so a touch higher),
  // each stamped with its governing collection + owner, sorted by priority.
  const changes = React.useMemo<Change[]>(() => {
    const edgeChanges: Change[] = pending.map((p) => ({
      kind: "edge",
      p,
      collection: governingCollection(p.fromId),
      ownerId: changeOwner(p.fromId),
      priority: p.confidence,
    }));
    const sugChanges: Change[] = suggestions.map((s) => ({
      kind: "suggestion",
      s,
      collection: governingCollection(s.artifactId),
      ownerId: changeOwner(s.artifactId),
      priority: 0.85,
    }));
    return [...edgeChanges, ...sugChanges].sort((a, b) => b.priority - a.priority);
  }, [pending, suggestions]);

  // Decisions shows only what's YOUR call — changes in the collections you own. Everyone else's activity (human
  // and agent alike) lives in the colleague monitor, not in your decision stream.
  const mine = changes.filter((c) => c.ownerId === VIEWER);

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

  if (mine.length === 0 && reviews.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border py-14 text-center">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCheck className="size-4.5" />
        </span>
        <p className="text-lg font-medium">Inbox zero</p>
        <p className="max-w-xs text-[15px] text-muted-foreground">
          Nothing waiting on your call. Every drop is filed and every change you own is confirmed or cleared.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {mine.map((c) => (
        <ChangeRow key={changeKey(c)} c={c} onEdge={resolve} onSuggestion={resolveSuggestion} />
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
