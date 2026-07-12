"use client";

import * as React from "react";
import {
  CheckCheck,
  FileText,
  Users,
  Hash,
  Folder,
  Quote,
  Diamond,
  Copy,
  Archive,
  Sparkles,
  PencilLine,
  FolderPlus,
  type LucideIcon,
} from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { Valve, ChoiceValve, provisional } from "@/components/proposal";
import { MergeSheet } from "@/components/merge-sheet";
import { toasts } from "@/lib/notifications";
import {
  getArtifact,
  listCaptureReviews,
  listCollectionCandidates,
  listPending,
  resolveCaptureReview,
  resolveCollectionCandidate,
  restoreCaptureReview,
  restoreCollectionCandidate,
  restoreEdge,
  verifyEdge,
} from "@/lib/api";
import type {
  CaptureReview,
  CollectionCandidate,
  Edge,
  EdgeType,
  PendingEdge,
  RefKind,
  ReviewKind,
} from "@/lib/types";

const VERB: Record<EdgeType, string> = {
  links_to: "links to",
  sourced_from: "sourced from",
  mentions: "mentions",
  in_collection: "in",
  authored_by: "by",
  decided: "decided",
  supersedes: "supersedes",
};

// The row's lead reflects WHAT the proposed link points at (its kind) — not a repeated agent mark.
// "this whole list is agent-proposed" is said once, in the page header (not re-stamped per row).
const KIND_ICON: Record<RefKind, LucideIcon> = {
  artifact: FileText,
  person: Users,
  topic: Hash,
  collection: Folder,
  source: Quote,
  decision: Diamond,
};

// capture-review leads — the kind of decision the agent is asking you to make
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

// a post-capture decision — provisional row + the multi-choice valve (the agent's recommended path
// is the filled primary; the rest are quiet outlines)
function ReviewRow({ r, onChoose }: { r: CaptureReview; onChoose: (id: string) => void }) {
  const Icon = REVIEW_ICON[r.kind];
  return (
    <div className={`${provisional} overflow-hidden`}>
      <div className="flex items-start gap-3 px-3.5 pb-2.5 pt-3">
        <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground">
          <Icon className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium leading-snug">{r.title}</p>
            <span className="shrink-0 rounded-[4px] bg-foreground/[0.06] px-1.5 py-0.5 text-[10px] font-medium leading-none text-muted-foreground">
              {REVIEW_LABEL[r.kind]}
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-muted-foreground">{r.detail}</p>
        </div>
      </div>
      {/* decision footer — the choices get their own block, not squeezed against the content's right edge */}
      <div className="mx-3.5 h-px bg-border" />
      <div className="px-3.5 py-2.5">
        <ChoiceValve actions={r.actions} onChoose={onChoose} />
      </div>
    </div>
  );
}

// a proposed link — provisional row + the confirm/dismiss valve
function Row({
  p,
  primary,
  onConfirm,
  onDiscard,
}: {
  p: PendingEdge;
  primary?: boolean;
  onConfirm: () => void;
  onDiscard: () => void;
}) {
  const Icon = KIND_ICON[p.toKind] ?? FileText;
  return (
    <div className={`${provisional} flex items-start gap-3 px-3.5 py-3`}>
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-snug">
          <span className="font-medium">{p.fromLabel}</span>
          <span className="text-muted-foreground"> {VERB[p.type]} </span>
          <span className="font-medium">{p.toLabel}</span>
        </p>
        {p.rationale ? (
          <p className="mt-0.5 truncate text-[12px] leading-snug text-muted-foreground">{p.rationale}</p>
        ) : null}
      </div>
      <Valve
        onConfirm={onConfirm}
        onDismiss={onDiscard}
        confirmLabel="Confirm"
        dismissLabel="Discard"
        primary={primary}
        className="self-center"
      />
    </div>
  );
}

// a smart-collection candidate — "artifact belongs in collection" — Add files it, Skip clears it
function CandidateRow({
  c,
  primary,
  onResolve,
}: {
  c: CollectionCandidate;
  primary?: boolean;
  onResolve: (action: "add" | "skip") => void;
}) {
  return (
    <div className={`${provisional} flex items-start gap-3 px-3.5 py-3`}>
      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground">
        <FolderPlus className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm leading-snug">
          <span className="font-medium">{c.artifactTitle}</span>
          <span className="text-muted-foreground"> belongs in </span>
          <span className="font-medium">{c.collectionName}</span>
        </p>
        <p className="mt-0.5 truncate text-[12px] leading-snug text-muted-foreground">{c.rationale}</p>
      </div>
      <Valve
        onConfirm={() => onResolve("add")}
        onDismiss={() => onResolve("skip")}
        confirmLabel="Add"
        dismissLabel="Skip"
        primary={primary}
        className="self-center"
      />
    </div>
  );
}

export function InboxQueue() {
  const [reviews, setReviews] = React.useState<CaptureReview[]>(() => listCaptureReviews());
  const [pending, setPending] = React.useState<PendingEdge[]>(() => listPending());
  const [candidates, setCandidates] = React.useState<CollectionCandidate[]>(() => listCollectionCandidates());
  // the duplicate review whose Merge valve opened the merge sheet (null = closed)
  const [merging, setMerging] = React.useState<CaptureReview | null>(null);

  function resolveReview(r: CaptureReview, actionId: string) {
    // a duplicate's "Merge" opens the merge sheet instead of resolving inline — the sheet's confirm
    // both merges the two artifacts and clears this review (see finishMerge).
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

  // the merge sheet confirmed — mergeArtifacts already ran inside it; clear the originating review + toast
  function finishMerge(r: CaptureReview, survivorId: string, loserId: string) {
    resolveCaptureReview(r.id);
    setReviews((list) => list.filter((x) => x.id !== r.id));
    const survivor = getArtifact(survivorId)?.title ?? "canonical";
    const loser = getArtifact(loserId)?.title ?? "duplicate";
    toasts.reviewResolved("Merged", `${loser} → ${survivor}`);
  }

  function resolveCandidate(c: CollectionCandidate, action: "add" | "skip") {
    resolveCollectionCandidate(c.id, action);
    setCandidates((list) => list.filter((x) => x.id !== c.id));
    const undo = {
      label: "Undo",
      onClick: () => {
        restoreCollectionCandidate(c, action === "add");
        setCandidates((list) => [c, ...list]);
      },
    };
    const desc = `${c.artifactTitle} → ${c.collectionName}`;
    if (action === "add") toasts.linkConfirmed(desc, undo);
    else toasts.proposalDismissed(desc, undo);
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
  function confirmAll() {
    const snapshot = pending.slice();
    const prevs = snapshot
      .map((p) => verifyEdge(p.edge_id, "confirm"))
      .filter((e): e is Edge => Boolean(e));
    setPending([]);
    toasts.linksConfirmed(snapshot.length, {
      label: "Undo",
      onClick: () => {
        prevs.forEach(restoreEdge);
        setPending(snapshot);
      },
    });
  }

  if (reviews.length === 0 && pending.length === 0 && candidates.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border py-14 text-center">
        <span className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary">
          <CheckCheck className="size-4.5" />
        </span>
        <p className="font-serif text-lg">Inbox zero</p>
        <p className="max-w-xs text-sm text-muted-foreground">
          Nothing to adjudicate. Every drop is filed and every proposed link is confirmed or cleared.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      {/* smart-collection candidates — the agent proposing members for a typed collection's rule */}
      {candidates.length ? (
        <section>
          <div className="mb-3">
            <span className="text-[12px] font-medium text-muted-foreground">
              {candidates.length} candidate{candidates.length > 1 ? "s" : ""} · for your smart collections
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {candidates.map((c) => (
              <CandidateRow key={c.id} c={c} onResolve={(action) => resolveCandidate(c, action)} />
            ))}
          </div>
        </section>
      ) : null}

      {/* capture reviews — the agent's post-drop decisions (dupe · naming · archive · extraction) */}
      {reviews.length ? (
        <section>
          <div className="mb-3">
            <span className="text-[12px] font-medium text-muted-foreground">
              {reviews.length} to review · from your drops
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {reviews.map((r) => (
              <ReviewRow key={r.id} r={r} onChoose={(id) => resolveReview(r, id)} />
            ))}
          </div>
        </section>
      ) : null}

      {/* proposed links — the agent's connections awaiting verify */}
      {pending.length ? (
        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="text-[12px] font-medium text-muted-foreground">
              {pending.length} proposed · awaiting verify
            </span>
            <IconButton label="Confirm all" size="icon-sm" side="left" variant="outline" onClick={confirmAll}>
              <CheckCheck />
            </IconButton>
          </div>
          <div className="flex flex-col gap-2.5">
            {pending.map((p) => (
              <Row
                key={p.edge_id}
                p={p}
                onConfirm={() => resolve(p, "confirm")}
                onDiscard={() => resolve(p, "discard")}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* the merge valve — a duplicate review's "Merge" opens this to pick the canonical survivor */}
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
