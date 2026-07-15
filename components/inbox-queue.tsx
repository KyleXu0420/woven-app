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
import { CheckCheck, Copy, Archive, Sparkles, PencilLine, type LucideIcon } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { ChoiceValve } from "@/components/proposal";
import { MergeSheet } from "@/components/merge-sheet";
import { LinkPeek } from "@/components/entity-peek";
import { toasts, notify } from "@/lib/notifications";
import { PersonAvatar, AgentAvatar } from "@/components/identity";
import {
  applySuggestion,
  effectiveOwner,
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
import {
  listPromotable,
  promoteRule,
  ignorePromotable,
  recordDecision,
  type PromotableRule,
} from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
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
// how sure Woven is — a calm 3-bar meter (no colour; exact % on hover). Lets you triage fast: clear the
// confident ones at a glance, slow down on the uncertain. It's also the axis the "learn from you" loop reasons over.
function ConfidenceTag({ value }: { value: number }) {
  const level = value >= 0.8 ? 3 : value >= 0.6 ? 2 : 1;
  const label = value >= 0.8 ? "High confidence" : value >= 0.6 ? "Likely" : "Less certain";
  return (
    <span
      className="flex shrink-0 items-center gap-[3px]"
      title={`${label} · ${Math.round(value * 100)}%`}
      aria-label={label}
    >
      {[0, 1, 2].map((i) => (
        <span key={i} className={`h-2.5 w-[3px] rounded-full ${i < level ? "bg-foreground/45" : "bg-foreground/15"}`} />
      ))}
    </span>
  );
}

function CollectionStamp({ collection }: { collection: Collection }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] text-muted-foreground">
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
  // both item types now share ONE action grammar: a bottom row of choice pills (primary tinted). Edges get
  // Confirm / Dismiss, suggestions get Apply edit / Dismiss, reviews keep Merge / Keep both / … — same place,
  // same look, so there's a single "where do I act" everywhere in the queue.
  const actions =
    c.kind === "edge"
      ? [
          { id: "confirm", label: "Confirm", primary: true },
          { id: "dismiss", label: "Dismiss" },
        ]
      : [
          { id: "apply", label: "Apply edit", primary: true },
          { id: "dismiss", label: "Dismiss" },
        ];
  function choose(id: string) {
    if (c.kind === "edge") onEdge(c.p, id === "confirm" ? "confirm" : "discard");
    else onSuggestion(c.s, id === "apply");
  }
  return (
    <div className="flex items-start gap-3 border-t border-border/50 py-3.5 first:border-t-0">
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
        <div className="flex items-start gap-2.5">
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
          <div className="mt-0.5 flex shrink-0 items-center gap-2.5">
            {c.kind === "edge" ? <ConfidenceTag value={c.p.confidence} /> : null}
            {c.collection ? <CollectionStamp collection={c.collection} /> : null}
          </div>
        </div>
        <p className="mt-1 line-clamp-1 text-[13px] leading-snug text-muted-foreground">
          {c.kind === "edge" ? c.p.rationale : c.s.after}
        </p>
        {readOnly ? null : (
          <div className="mt-2.5">
            <ChoiceValve actions={actions} onChoose={choose} />
          </div>
        )}
      </div>
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

// the judgment loop made visible. When you've decided one shape the same way enough times, Woven offers to take
// it off your plate. "Automate this" auto-clears the matching pending changes now AND records a rule you manage
// in Governance — the observable-decision → guidance handoff, as one calm prompt above the queue.
function LearnPrompt({
  rule,
  onAutomate,
  onIgnore,
}: {
  rule: PromotableRule;
  onAutomate: () => void;
  onIgnore: () => void;
}) {
  return (
    <div className="mb-1.5 flex items-start gap-3 rounded-xl border border-primary/25 bg-primary/[0.04] px-3.5 py-3">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-primary/[0.12] text-primary">
        <Sparkles className="size-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] leading-snug">
          You&rsquo;ve confirmed every <span className="font-medium">{VERB[rule.edgeType]}</span> Woven proposed in{" "}
          <span className="font-medium">{rule.collectionName}</span> — {rule.confirmed} in a row.
        </p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted-foreground">
          Want Woven to auto-confirm these and just tell you? Undo any of them, and revoke this in Governance anytime.
        </p>
        <div className="mt-2.5">
          <ChoiceValve
            actions={[
              { id: "automate", label: "Automate this", primary: true },
              { id: "ignore", label: "Not now" },
            ]}
            onChoose={(id) => (id === "automate" ? onAutomate() : onIgnore())}
          />
        </div>
      </div>
    </div>
  );
}

export function InboxQueue() {
  useGraphVersion();
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
      ownerId: effectiveOwner(p.edge_id, p.fromId),
      priority: p.confidence,
    }));
    const sugChanges: Change[] = suggestions.map((s) => ({
      kind: "suggestion",
      s,
      collection: governingCollection(s.artifactId),
      ownerId: effectiveOwner(s.id, s.artifactId),
      priority: 0.85,
    }));
    return [...edgeChanges, ...sugChanges].sort((a, b) => b.priority - a.priority);
  }, [pending, suggestions]);

  // Decisions shows only what's YOUR call — changes in the collections you own. Everyone else's activity (human
  // and agent alike) lives in the colleague monitor, not in your decision stream.
  const mine = changes.filter((c) => c.ownerId === VIEWER);
  const promotable = listPromotable();

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
    recordDecision(p.type, governingCollection(p.fromId)?.id, action); // teach the loop this shape's verdict
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

  // promote a shape you've decided consistently → Woven records the rule (managed in Governance) and clears the
  // matching pending changes right now, so the automation is something you SEE, not a promise.
  function automate(rule: PromotableRule) {
    const confirmed = promoteRule(rule.edgeType, rule.collectionId);
    const ids = new Set(confirmed.map((e) => e.id));
    setPending((list) => list.filter((p) => !ids.has(p.edge_id)));
    notify.success(`Automating ${VERB[rule.edgeType]} in ${rule.collectionName}`, {
      description: confirmed.length
        ? `Woven cleared ${confirmed.length} now and will handle new ones — revoke in Governance.`
        : "Woven will handle these from now on — revoke in Governance.",
    });
  }
  function ignore(rule: PromotableRule) {
    ignorePromotable(rule.edgeType, rule.collectionId);
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
      {promotable[0] ? (
        <LearnPrompt
          rule={promotable[0]}
          onAutomate={() => automate(promotable[0])}
          onIgnore={() => ignore(promotable[0])}
        />
      ) : null}
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
