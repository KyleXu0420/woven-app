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
import { Button } from "@/components/ui/button";
import { Valve, ChoiceValve, provisional } from "@/components/proposal";
import { toasts } from "@/lib/notifications";
import {
  listCaptureReviews,
  listCollectionCandidates,
  listPending,
  resolveCollectionCandidate,
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
    <div className={`${provisional} flex items-center gap-3 px-3.5 py-3`}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium leading-snug">{r.title}</p>
          <span className="shrink-0 rounded border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
            {REVIEW_LABEL[r.kind]}
          </span>
        </div>
        <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{r.detail}</p>
      </div>
      <ChoiceValve actions={r.actions} onChoose={onChoose} />
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
    <div className={`${provisional} flex items-center gap-3 px-3.5 py-3`}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground">
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
      <Valve onConfirm={onConfirm} onDismiss={onDiscard} confirmLabel="Confirm" dismissLabel="Discard" primary={primary} />
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
    <div className={`${provisional} flex items-center gap-3 px-3.5 py-3`}>
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground">
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
      />
    </div>
  );
}

export function InboxQueue() {
  const [reviews, setReviews] = React.useState<CaptureReview[]>(() => listCaptureReviews());
  const [pending, setPending] = React.useState<PendingEdge[]>(() => listPending());
  const [candidates, setCandidates] = React.useState<CollectionCandidate[]>(() => listCollectionCandidates());

  function resolveReview(r: CaptureReview, actionId: string) {
    const action = r.actions.find((a) => a.id === actionId);
    setReviews((list) => list.filter((x) => x.id !== r.id));
    toasts.reviewResolved(action?.label ?? "Resolved", r.title, {
      label: "Undo",
      onClick: () => setReviews((list) => [r, ...list]),
    });
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
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {candidates.length} candidate{candidates.length > 1 ? "s" : ""} · for your smart collections
            </span>
          </div>
          <div className="flex flex-col gap-2.5">
            {candidates.map((c, i) => (
              <CandidateRow key={c.id} c={c} primary={i === 0} onResolve={(action) => resolveCandidate(c, action)} />
            ))}
          </div>
        </section>
      ) : null}

      {/* capture reviews — the agent's post-drop decisions (dupe · naming · archive · extraction) */}
      {reviews.length ? (
        <section>
          <div className="mb-3">
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
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
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {pending.length} proposed · awaiting verify
            </span>
            <Button size="default" variant="outline" onClick={confirmAll}>
              <CheckCheck /> Confirm all
            </Button>
          </div>
          <div className="flex flex-col gap-2.5">
            {pending.map((p, i) => (
              <Row
                key={p.edge_id}
                p={p}
                primary={i === 0}
                onConfirm={() => resolve(p, "confirm")}
                onDiscard={() => resolve(p, "discard")}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
