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
//
// The agent is credited ONCE here, by the AgentBand byline (2026-10-02, the evolve pass). Every row below leads
// with the mark of what it is ABOUT, in the alphabet (shape = kind, hue = identity): a proposal with its
// subject artifact's square, an edit with the artifact it edits, an approval with its decision's diamond, a
// review with the drop's square. They led with the agent's 28px seal (three in one viewport), a teammate's
// monogram, or a lucide glyph in a grey well, so the one idea the product owns appeared nowhere in its busiest
// list, and the seal used as a bullet read as a confirm dot.

import * as React from "react";
import { Check, CheckCheck, ChevronDown } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ChoiceValve, Valve } from "@/components/proposal";
import { ConfidenceWord, CONFIDENCE_COPY, confidenceLevel } from "@/components/confidence";
import { NodeMark } from "@/components/entity-profile";
import { WELD_MS } from "@/components/local-graph";
import { MergeSheet } from "@/components/merge-sheet";
import { PeekText, PeekTrigger } from "@/components/entity-peek";
import { toasts, notify } from "@/lib/notifications";
import { AgentBand, DIVIDED, FeedHead, undot } from "@/components/inbox-agent-band";
import { DecisionStateLabel } from "@/components/decision-state";
import { ReviewPacketView } from "@/components/review-packet";
import { ActivationObservationDialog } from "@/components/activation-observation-dialog";
import { useSearch } from "@/components/search";
import { cn } from "@/lib/utils";
import {
  applySuggestion,
  approveDecision,
  confirmActivationEvidence,
  effectiveOwner,
  getArtifact,
  governingCollection,
  listArtifacts,
  listCaptureReviews,
  listDecisionActions,
  listOpenSuggestions,
  listPending,
  personById,
  resolveCaptureReview,
  restoreCaptureReview,
  restoreEdge,
  reviewPacket,
  revalidateDecision,
  verifyEdge,
  VIEWER,
} from "@/lib/api";
import {
  listPromotable,
  promoteRule,
  pauseRule,
  ignorePromotable,
  recordDecision,
  RULE_CAPABILITY,
  type PromotableRule,
} from "@/lib/api";
import { useGraphVersion } from "@/lib/use-graph-version";
import { activationEvidenceSatisfiesRequirement } from "@/lib/activation";
import type {
  CaptureReview,
  Collection,
  Decision,
  DecisionAction,
  DecisionRecord,
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

const REVIEW_LABEL: Record<ReviewKind, string> = {
  duplicate: "Duplicate",
  naming: "Naming",
  archive: "Archive",
  extraction: "Extraction",
};
// what each review type means, shown on hover over its word, so the row explains itself the way the
// confidence word does. Each was an em dash chain ("overlaps this drop — merge them…"); a choice is its own
// sentence now.
const REVIEW_EXPLAIN: Record<ReviewKind, string> = {
  duplicate: "Woven found an existing artifact that overlaps this drop. Merge them into one, or keep both.",
  naming: "Two artifacts share a name. Rename one so they stay distinct, or merge them.",
  archive: "A newer artifact supersedes this one. Archive the old version, or keep both.",
  extraction: "Woven pulled structure out of the drop (decisions, people, sources). Confirm what it found.",
};

// a change as it flows through the desk — an agent-proposed edge or a colleague's suggested edit, each stamped
// with the collection that governs it and the person who holds its approve.
type Change =
  | { kind: "edge"; p: PendingEdge; collection?: Collection; ownerId: string; priority: number }
  | { kind: "suggestion"; s: OpenSuggestion; collection?: Collection; ownerId: string; priority: number };
type OpenSuggestion = ReturnType<typeof listOpenSuggestions>[number];
type EdgeChange = Extract<Change, { kind: "edge" }>;
const changeKey = (c: Change) => (c.kind === "edge" ? c.p.edge_id : c.s.id);
// The band a batch groups by is the confidence word's own level (components/confidence.tsx), so a "Confirm all"
// is one homogeneous tier (a shaky one never rides in a confident batch). It was a second vocabulary for the
// same thresholds ("high" / "likely" / "less sure") beside a row that says "Likely" / "Unsure".

// The rows' lead column, the one Activity and Governance hang their marks in (inbox-activity.tsx LEAD): 28px
// wide after the 14px inset, one title line tall, so the 12px mark sits centred on the line it names and starts
// 8px in, at 22. FeedHead pads its label to that same 22 (pl-5.5), so a group's label and the marks it labels
// share one edge, and the text edge stays where the 28px avatars put it.
const LEAD = "flex h-(--text-sm--line-height) w-7 shrink-0 items-center justify-center";

// The trailing cluster sits on the title's FIRST line, a slot one text-sm line tall, the way the Team review
// dialog seats it. gap-4, one gutter: the confidence word must break from the ✓ ✕ pair, or "Unsure" reads as a
// caption on the tick.
const TRAIL = "flex h-(--text-sm--line-height) shrink-0 items-center justify-end gap-4";

// where a change lives. The swatch is the collection's own mark in the alphabet (a square at the collection's
// 10% radius); it was a hand-cut 3px-radius square, a fourth shape that belonged to no kind. 12.5px was not a
// rung; 13 is the line's rung, the confidence word's beside it.
function CollectionStamp({ collection, className }: { collection: Collection; className?: string }) {
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground", className)}>
      <NodeMark node={{ id: collection.id, kind: "collection" }} className="size-2.5" />
      {collection.name}
    </span>
  );
}

// one change, one row — the whole priority stream is these. The mark leads with the SUBJECT (the artifact the
// proposal hangs off, the artifact an edit changes); the sentence reads what; the stamp reads where; the line
// beneath reads why.
//
// A binary call is the Valve (✓ wash mark + ✕ ghost, icon and tooltip) on the title line, per the
// forest-action-weight rule. It was a labelled Confirm / Dismiss pill pair under the reason, the ChoiceValve
// built for real multi-choice reviews, so the Inbox spoke two confirm grammars where the Team review dialog,
// the reader's edit bar and section comments speak one. ChoiceValve stays for the rows with more than two
// paths (approvals, capture reviews).
//
// A proposed link's claim (the relation and its target) is in MUTED ink, because it is not yet true: the
// verdict is visible in the ink (the Granola borrow, 2026-10-02), the same register the Team review dialog
// gives it. Its subject keeps full ink, the thing that exists either way. On ✓ the claim takes full ink over
// the weld's beat (.weld-ink, WELD_MS), and the row leaves when the beat ends. The target carries the class
// too: it is a button with its own colour transition, and the claim must arrive as one phrase on one clock.
function ChangeRow({
  c,
  readOnly,
  welding = false,
  onEdge,
  onSuggestion,
}: {
  c: Change;
  readOnly?: boolean;
  welding?: boolean;
  onEdge: (p: PendingEdge, action: "confirm" | "discard") => void;
  onSuggestion: (s: OpenSuggestion, apply: boolean) => void;
}) {
  const author = c.kind === "suggestion" ? personById(c.s.author) : undefined;
  const subject: { id: string; kind: RefKind } =
    c.kind === "edge" ? { id: c.p.fromId, kind: c.p.fromKind } : { id: c.s.artifactId, kind: "artifact" };
  const claimInk = cn("weld-ink", welding ? "text-foreground" : "text-muted-foreground");
  return (
    <div className="flex items-start gap-3 px-3.5 py-3.5">
      <span className={LEAD}>
        <NodeMark node={subject} className="size-3" />
      </span>

      {/* a two-column grid, not a flex row: the call (word, stamp, valve) belongs to the phrase's first line,
          the reason to the whole row. As a flex row the cluster would reserve its column for the row's full
          height, and on a phone the reason would wrap at half the width beside an empty column. */}
      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-4">
        <p className="min-w-0 text-sm text-pretty">
          {c.kind === "edge" ? (
            <>
              <PeekTrigger
                refObj={{ id: c.p.fromId, label: undot(c.p.fromLabel), kind: c.p.fromKind }}
                className="font-medium text-foreground"
              />{" "}
              <span className={claimInk}>
                {VERB[c.p.type]}{" "}
                <PeekTrigger
                  refObj={{ id: c.p.toId, label: undot(c.p.toLabel), kind: c.p.toKind }}
                  className={cn("font-medium", claimInk)}
                />
              </span>
            </>
          ) : (
            <>
              {/* the section was a "· § Owners" tail: a middle dot and a typesetter's sign, where the house
                  writes the words */}
              <PeekTrigger
                refObj={{ id: c.s.author, label: author?.name ?? c.s.author, kind: "person" }}
                className="font-medium text-foreground"
              />
              <span className="text-muted-foreground"> suggested an edit to {undot(c.s.blockHeading)} in </span>
              <PeekTrigger
                refObj={{ id: c.s.artifactId, label: undot(c.s.artifactTitle), kind: "artifact" }}
                className="font-medium text-foreground"
              />
            </>
          )}
        </p>
        <div className={TRAIL}>
          {c.kind === "edge" ? <ConfidenceWord value={c.p.confidence} /> : null}
          {/* at 390 the stamp moves under the reason: on the title line it left the phrase ~70px */}
          {c.collection ? <CollectionStamp collection={c.collection} className="hidden sm:inline-flex" /> : null}
          {readOnly ? null : c.kind === "edge" ? (
            <Valve
              size="icon-xs"
              onConfirm={() => (welding ? undefined : onEdge(c.p, "confirm"))}
              onDismiss={() => (welding ? undefined : onEdge(c.p, "discard"))}
            />
          ) : (
            <Valve
              size="icon-xs"
              confirmLabel="Apply edit"
              onConfirm={() => onSuggestion(c.s, true)}
              onDismiss={() => onSuggestion(c.s, false)}
            />
          )}
        </div>
        {/* the WHY — the one line the reader decides on */}
        <p className="col-span-2 mt-1 text-sm text-pretty text-muted-foreground">
          <PeekText text={c.kind === "edge" ? (c.p.rationale ?? "") : c.s.after} />
        </p>
        {c.collection ? <CollectionStamp collection={c.collection} className="col-span-2 mt-1.5 sm:hidden" /> : null}
      </div>
    </div>
  );
}

// the drop a capture review is about, for its mark. A duplicate names its two artifacts ([dropped, existing]);
// the other kinds carry only the drop's title, so the artifact is found by it. A review whose subject is no
// single artifact ("Two files named …") has no identity to claim: its mark is the artifact's shape in the hint
// ink, the rule Activity uses for a run with no artifact (the kind is known, the identity is not claimed).
function reviewSubject(r: CaptureReview): string | undefined {
  const id = r.dupeArtifactIds?.[0] ?? listArtifacts().find((a) => a.title === r.title)?.id;
  return id && getArtifact(id) ? id : undefined;
}

// a capture review — your own drop, so it sits under "Needs you". A genuine multi-choice (merge / rename /
// archive / …), so it keeps its labelled ChoiceValve rather than the bare ✓ / ✕.
// It led with a lucide glyph per review kind in a grey well (Copy, Pencil, Archive, and Sparkles for an
// extraction, the AI cliché the house retired for the agent). The row is about the drop, so it leads with the
// drop's mark; the review's kind is the word in the trailing slot, explained on hover, the confidence word's
// grammar. It was an 11px chip on a hand-written alpha, the one filled object on an open row.
function ReviewCard({ r, onChoose }: { r: CaptureReview; onChoose: (id: string) => void }) {
  const subject = reviewSubject(r);
  return (
    <div className="flex items-start gap-3 px-3.5 py-3.5">
      <span className={LEAD}>
        {subject ? (
          <NodeMark node={{ id: subject, kind: "artifact" }} className="size-3" />
        ) : (
          <NodeMark node={{ id: r.id, kind: "artifact" }} className="size-3" fill="var(--foreground-hint)" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-4">
          <p className="min-w-0 flex-1 text-sm font-medium text-pretty">{undot(r.title)}</p>
          <Popover>
            <PopoverTrigger
              nativeButton={false}
              openOnHover
              delay={120}
              render={
                <span className="flex h-(--text-sm--line-height) shrink-0 cursor-help items-center text-sm text-muted-foreground outline-none">
                  {REVIEW_LABEL[r.kind]}
                </span>
              }
            />
            <PopoverContent side="top" align="end" sideOffset={8} className="w-64 p-3">
              <p className="text-sm font-medium">{REVIEW_LABEL[r.kind]}</p>
              <p className="mt-1 text-sm text-pretty text-muted-foreground">{REVIEW_EXPLAIN[r.kind]}</p>
            </PopoverContent>
          </Popover>
        </div>
        <p className="mt-1 text-sm text-pretty text-muted-foreground">{undot(r.detail)}</p>
        <div className="mt-2.5">
          <ChoiceValve actions={r.actions} onChoose={onChoose} />
        </div>
      </div>
    </div>
  );
}

// who holds the call and who carries it out. It was "Authority · Maya Chen · Driver · Jordan", four tokens of
// one ink on one dotted chain, so the reader paired each label with its name by position. Now two pairs, the
// label muted and the name in ink, parted by the hairline: the grammar the review packet's own conclusion
// writes the same two facts in, so the row and the packet it opens into say them one way.
function Ownership({ record }: { record: DecisionRecord }) {
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
      <span>
        Authority <span className="text-foreground">{record.authority?.name ?? "unassigned"}</span>
      </span>
      <span aria-hidden="true" className="h-3 w-px shrink-0 bg-border" />
      <span className="sr-only">, </span>
      <span>
        Driver <span className="text-foreground">{record.driver?.name ?? "unassigned"}</span>
      </span>
    </p>
  );
}

function DecisionActionRow({
  item,
  expanded,
  onToggle,
  onChoose,
  onAsk,
  onAddProof,
}: {
  item: DecisionAction;
  expanded: boolean;
  onToggle: () => void;
  onChoose: (choice: string) => void;
  onAsk: (prompt: string) => void;
  onAddProof: () => void;
}) {
  const { record } = item;
  const rowRef = React.useRef<HTMLDivElement>(null);
  const packet = reviewPacket(item.decision_id);
  React.useEffect(() => {
    if (expanded) rowRef.current?.scrollIntoView({ block: "nearest" });
  }, [expanded]);
  const activationSatisfied = item.kind === "confirm_activation" && item.activation_candidate
    ? activationEvidenceSatisfiesRequirement(item.record.decision, item.activation_candidate)
    : false;
  const actions = item.kind === "approve"
      ? [
          { id: "approve", label: "Approve", primary: true },
          { id: "packet", label: expanded ? "Close packet" : "Review packet", ariaExpanded: expanded, ariaControls: `review-packet-${item.decision_id}` },
        ]
      : item.kind === "add_activation_evidence" || (item.kind === "confirm_activation" && !activationSatisfied)
        ? [
            { id: "add_proof", label: "Add downstream proof", primary: true },
            ...(item.activation_candidate ? [{ id: "dismiss", label: "Not this evidence" }] : []),
            { id: "packet", label: expanded ? "Close packet" : "Review evidence", ariaExpanded: expanded, ariaControls: `review-packet-${item.decision_id}` },
          ]
        : item.kind === "confirm_activation"
          ? [
              { id: "confirm", label: "Confirm activation", primary: true },
              { id: "dismiss", label: "Not this evidence" },
              { id: "packet", label: expanded ? "Close packet" : "Review packet", ariaExpanded: expanded, ariaControls: `review-packet-${item.decision_id}` },
            ]
        : [
            { id: "packet", label: expanded ? "Close packet" : "Review changed evidence", primary: true, ariaExpanded: expanded, ariaControls: `review-packet-${item.decision_id}` },
          ];
  const reviewActions = actions.filter((action) => action.id !== "packet");
  // the decision's own mark (the diamond, in its identity hue), where a lucide Diamond sat in a grey well: the
  // well was the heaviest lead in the list and the glyph was an icon, not the alphabet's decision.
  return (
    <div ref={rowRef} className="flex items-start gap-3 px-3.5 py-3.5">
      <span className={LEAD}>
        <NodeMark node={{ id: item.decision_id, kind: "decision" }} className="size-3" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <p className="min-w-0 text-sm font-medium text-pretty">{undot(item.title)}</p>
          <DecisionStateLabel state={record.state} className="shrink-0" />
        </div>
        {expanded ? null : (
          <>
            <p className="mt-1 text-sm text-pretty text-muted-foreground">{undot(item.detail)}</p>
            <Ownership record={record} />
            {/* Approve stays a labelled ChoiceValve: it sits beside Review packet, a real second path. Its body
                is the confirm variant's, so it takes that variant's dark rung (10%, 1.18:1 on the canvas) and
                not a hand-copied 6% that read as a forest ring around a word on charcoal. */}
            <div className="mt-2.5">
              <ChoiceValve
                actions={actions}
                onChoose={(choice) => choice === "packet" ? onToggle() : choice === "add_proof" ? onAddProof() : onChoose(choice)}
              />
            </div>
          </>
        )}
        {expanded && packet ? (
          <ReviewPacketView
            packet={packet}
            onAsk={onAsk}
            actions={reviewActions}
            onChoose={(choice) => choice === "add_proof" ? onAddProof() : onChoose(choice)}
            onClose={onToggle}
            onAddProof={onAddProof}
          />
        ) : null}
      </div>
    </div>
  );
}

// the judgment loop made visible. When you've decided one shape the same way enough times, Woven offers to take
// it off your plate. "Automate this" auto-clears the matching pending changes now AND records a rule you manage
// in Governance — the observable-decision → guidance handoff, as one calm prompt above the queue.
//
// The offer is the agent speaking, so it hangs under the agent's byline, at the byline's text edge (its 28px
// seal + 12), and the byline's seal is its mark. It was a wash card led by Sparkles in a forest well, with the
// agent's 12px seal again on its last line: the AI cliché standing for the agent the house draws as its own
// mark, and the agent credited three times in one band (byline, card, line). Credited once (2026-10-02), the
// offer needs no card: the byline above and the hairline below already set it apart from the feed.
function LearnPrompt({
  rule,
  onAutomate,
  onIgnore,
  onOpenGovernance,
}: {
  rule: PromotableRule;
  onAutomate: () => void;
  onIgnore: () => void;
  onOpenGovernance?: () => void;
}) {
  return (
    <div className="pb-5 pl-10">
      {/* agent prose: one fact per sentence, the count in full ink, held to 75ch. The count hung off an em
          dash ("Q4 Roadmap — 4 in a row"). */}
      <p className="max-w-[75ch] text-sm text-pretty">
        You&rsquo;ve confirmed every <span className="font-medium">{VERB[rule.edgeType]}</span> Woven proposed in{" "}
        <PeekTrigger
          refObj={{ id: rule.collectionId, label: rule.collectionName, kind: "collection" }}
          className="font-medium"
        />
        , <span className="font-medium tabular-nums">{rule.confirmed}</span> in a row.
      </p>
      <p className="mt-0.5 max-w-[75ch] text-sm text-pretty text-muted-foreground">
        Want Woven to auto-confirm these and just tell you? Undo any of them anytime.
      </p>
      {/* A sentence is one text run, not a row of flex items: as inline-flex the two spans wrapped as blocks.
          Its subject was the agent's seal ("[seal] becomes …"); with the seal gone the sentence names it. */}
      <button
        type="button"
        onClick={onOpenGovernance}
        className="mt-1.5 block max-w-[75ch] rounded-sm text-left text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
      >
        It becomes{" "}
        <span className="underline decoration-foreground-hint decoration-dotted underline-offset-2">
          {RULE_CAPABILITY[rule.edgeType]} in {rule.collectionName}
        </span>
        , a responsibility in Governance
      </button>
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
  );
}

// a batch — every pending proposal of ONE observable shape (relation × collection × confidence band), the axis
// Woven learns on. Collapsed to a header + "Confirm all" so you clear a whole shape in one move (which is also
// the strongest teaching signal); expand to adjudicate each. A shaky tier is its own group, so a batch-confirm
// never sweeps in a low-confidence one.
// It led with the agent's seal like every proposal row. A batch is about its shape's AREA, so it leads with the
// collection's mark (the hint ink when the shape has none). "Confirm all N" is the wash Button with its tick,
// the one the Team review dialog gives its batch, not a one-option ChoiceValve.
function ShapeGroup({
  edges,
  welding,
  onResolve,
  onConfirmAll,
}: {
  edges: EdgeChange[];
  welding: string[];
  onResolve: (p: PendingEdge, action: "confirm" | "discard") => void;
  onConfirmAll: (edges: EdgeChange[]) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const first = edges[0].p;
  const collection = edges[0].collection;
  const level = confidenceLevel(first.confidence);
  return (
    <div className="px-3.5 py-3.5">
      <div className="flex items-start gap-3">
        <span className={LEAD}>
          {collection ? (
            <NodeMark node={{ id: collection.id, kind: "collection" }} className="size-3" />
          ) : (
            <NodeMark node={{ id: first.edge_id, kind: "collection" }} className="size-3" fill="var(--foreground-hint)" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              aria-expanded={open}
              className="-my-0.5 -ml-1 flex min-w-0 flex-1 items-center gap-1 rounded-sm px-1 py-0.5 text-left text-sm outline-none transition-colors hover:bg-tint-1 focus-visible:ring-2 focus-visible:ring-focus"
            >
              <span className="truncate">
                <span className="font-medium text-foreground">
                  {edges.length} {VERB[first.type]}
                </span>
                <span className="text-muted-foreground"> proposals{collection ? ` in ${collection.name}` : ""}</span>
              </span>
              <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            <div className={TRAIL}>
              <ConfidenceWord value={first.confidence} />
              {collection ? <CollectionStamp collection={collection} className="hidden sm:inline-flex" /> : null}
            </div>
          </div>
          {/* the tier in the confidence word's own vocabulary, one fact per sentence (it was "All likely
              confidence — confirming all teaches…") */}
          <p className="mt-1 text-sm text-pretty text-muted-foreground">
            All {edges.length} are {CONFIDENCE_COPY[level].word.toLowerCase()}. Confirming them together teaches Woven this shape.
          </p>
          <div className="mt-2.5">
            <Button size="sm" variant="confirm" onClick={() => onConfirmAll(edges)}>
              <Check /> Confirm all {edges.length}
            </Button>
          </div>
          {open ? (
            <div className={cn("mt-2 flex flex-col", DIVIDED)}>
              {edges.map((c) => (
                <ChangeRow
                  key={c.p.edge_id}
                  c={c}
                  welding={welding.includes(c.p.edge_id)}
                  onEdge={onResolve}
                  onSuggestion={() => {}}
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function InboxQueue({
  onOpenGovernance,
  initialDecisionId,
}: {
  onOpenGovernance?: () => void;
  initialDecisionId?: string | null;
}) {
  useGraphVersion();
  const { openSearch } = useSearch();
  const [expandedDecisionId, setExpandedDecisionId] = React.useState<string | null>(initialDecisionId ?? null);
  const [decisionWork, setDecisionWork] = React.useState<DecisionAction[]>(() => listDecisionActions());
  const [reviews, setReviews] = React.useState<CaptureReview[]>(() => listCaptureReviews());
  const [pending, setPending] = React.useState<PendingEdge[]>(() => listPending());
  const [suggestions, setSuggestions] = React.useState<OpenSuggestion[]>(() => listOpenSuggestions());
  const [merging, setMerging] = React.useState<CaptureReview | null>(null);
  const [proofDecision, setProofDecision] = React.useState<Decision | null>(null);
  // THE WELD on this queue (WELD_MS, components/local-graph.tsx; the Team review dialog's pattern): the edges
  // confirmed and still in their beat. A ✓ here was recorded on the click and the row was gone on the first
  // frame, so the claim never got to arrive in ink. Now the click starts the beat (the claim takes full ink) and
  // the record is written when it ends; the row then leaves as it always did. A second ✓ inside the beat does
  // nothing, and the commit checks the edge is still pending, so an Undo or a Confirm all that lands in the same
  // beat cannot confirm one edge twice.
  const [welding, setWelding] = React.useState<string[]>([]);
  function weldThen(ids: string[], commit: () => void) {
    const fresh = ids.filter((id) => !welding.includes(id));
    if (!fresh.length) return;
    setWelding((w) => [...w, ...fresh]);
    window.setTimeout(() => {
      setWelding((w) => w.filter((id) => !fresh.includes(id)));
      commit();
    }, WELD_MS);
  }
  const stillPending = (id: string) => listPending().some((p) => p.edge_id === id);

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
  const focusedAction = initialDecisionId
    ? decisionWork.find((item) => item.decision_id === initialDecisionId)
    : undefined;
  const focusedPacket = initialDecisionId && !focusedAction ? reviewPacket(initialDecisionId) : undefined;

  // group MY agent-edge proposals by observable shape (relation × collection × confidence band) so identical
  // calls batch together; a colleague's suggestion isn't a learnable shape, so it stays an individual row. A
  // shape with a single proposal renders as a plain row (no group chrome).
  const mineSugs = mine.filter((c) => c.kind === "suggestion");
  const mineEdges = mine.filter((c): c is EdgeChange => c.kind === "edge");
  const shapeGroups: EdgeChange[][] = [];
  const gmap = new Map<string, EdgeChange[]>();
  for (const c of mineEdges) {
    const key = `${c.p.type}|${c.collection?.id ?? "-"}|${confidenceLevel(c.p.confidence)}`;
    let arr = gmap.get(key);
    if (!arr) {
      arr = [];
      gmap.set(key, arr);
      shapeGroups.push(arr);
    }
    arr.push(c);
  }

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

  function resolveDecisionWork(item: DecisionAction, choice: string) {
    if (choice === "add_proof") {
      setProofDecision(item.record.decision);
      return;
    }
    if (item.kind === "approve" && choice === "approve") {
      approveDecision(item.decision_id);
      notify.success("Decision approved", {
        // one fact per sentence; the toast read "<title> · waiting for…", a middle dot standing in for a full stop
        description: `${undot(item.title)}. Waiting for activation evidence from ${item.record.driver?.name ?? "the driver"}.`,
      });
    } else if (item.kind === "confirm_activation" && item.activation_candidate) {
      const resolved = confirmActivationEvidence(item.activation_candidate.id, choice === "confirm" ? "confirm" : "dismiss");
      if (resolved) {
        notify.success(choice === "confirm" ? "Decision is in effect" : "Activation evidence dismissed", {
          description: item.title,
        });
      } else {
        notify.error("Activation condition not satisfied", {
          description: "Add deployment, configuration, render, or other downstream proof before confirming.",
        });
      }
    } else if (item.kind === "revalidate" && choice === "keep") {
      const resolved = revalidateDecision(item.decision_id);
      if (resolved) notify.success("Decision revalidated", { description: `${undot(item.title)} is still in effect.` });
      else notify.error("Capture the new revision first", { description: "Revalidation requires a genuinely new immutable snapshot and exact evidence reference." });
    }
    setExpandedDecisionId(null);
    setDecisionWork(listDecisionActions());
  }

  function askDecision(item: DecisionAction, prompt: string) {
    openSearch(prompt, { kind: "decision", id: item.decision_id, title: item.title });
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
    const desc = `${undot(p.fromLabel)} ${VERB[p.type]} ${undot(p.toLabel)}`;
    if (action === "confirm") toasts.linkConfirmed(desc, undo);
    else toasts.proposalDismissed(desc, undo);
  }
  // ✓ on a row: the weld, then the record
  function confirmWelded(p: PendingEdge) {
    weldThen([p.edge_id], () => {
      if (stillPending(p.edge_id)) resolve(p, "confirm");
    });
  }
  function onEdge(p: PendingEdge, action: "confirm" | "discard") {
    if (action === "confirm") confirmWelded(p);
    else resolve(p, "discard");
  }

  // confirm a whole shape at once — clears the batch AND, because it feeds recordDecision per edge, it's the
  // strongest signal to the learning loop (a clean batch of one shape is exactly what promotes a rule).
  function confirmGroup(all: EdgeChange[]) {
    const edges = all.filter((c) => stillPending(c.p.edge_id));
    if (!edges.length) return;
    const prevs = edges
      .map((c) => {
        const prev = verifyEdge(c.p.edge_id, "confirm");
        recordDecision(c.p.type, c.collection?.id, "confirm");
        return prev;
      })
      .filter((e): e is Edge => Boolean(e));
    const ids = new Set(edges.map((c) => c.p.edge_id));
    setPending((list) => list.filter((p) => !ids.has(p.edge_id)));
    toasts.linksConfirmed(edges.length, {
      label: "Undo",
      onClick: () => {
        prevs.forEach(restoreEdge);
        setPending((list) => [...edges.map((c) => c.p), ...list].sort((a, b) => b.confidence - a.confidence));
      },
    });
  }
  // Confirm all: the whole batch welds in one beat (the rows of an open group take their ink together)
  function confirmGroupWelded(edges: EdgeChange[]) {
    weldThen(
      edges.map((c) => c.p.edge_id),
      () => confirmGroup(edges),
    );
  }

  function resolveSuggestion(s: OpenSuggestion, apply: boolean) {
    applySuggestion(s.discussionId, apply);
    setSuggestions((list) => list.filter((x) => x.id !== s.id));
    const who = personById(s.author)?.name ?? "A teammate";
    // a phrase, not three names on middle dots ("Dan Lee · Q4 launch plan · Owners")
    notify.success(apply ? "Suggestion applied" : "Suggestion dismissed", {
      description: `${who}'s edit to ${undot(s.blockHeading)} in ${undot(s.artifactTitle)}`,
    });
  }

  // promote a shape you've decided consistently → Woven records the rule (managed in Governance) and clears the
  // matching pending changes right now, so the automation is something you SEE, not a promise.
  function automate(rule: PromotableRule) {
    const { ruleId, confirmed } = promoteRule(rule.edgeType, rule.collectionId);
    const ids = new Set(confirmed.map((e) => e.id));
    setPending((list) => list.filter((p) => !ids.has(p.edge_id)));
    notify.success(`Automating ${VERB[rule.edgeType]} in ${rule.collectionName}`, {
      description: confirmed.length
        ? `Woven cleared ${confirmed.length} now and will handle new ones. Revoke it in Governance.`
        : "Woven will handle these from now on. Revoke it in Governance.",
      // undoing a rule's action is a correction → the rule pauses (not revokes) so you can review it in Governance
      action: confirmed.length
        ? {
            label: "Undo",
            onClick: () => {
              confirmed.forEach(restoreEdge);
              pauseRule(ruleId, confirmed.length);
              setPending(listPending());
            },
          }
        : undefined,
    });
  }
  function ignore(rule: PromotableRule) {
    ignorePromotable(rule.edgeType, rule.collectionId);
  }

  // the queue's one-line state for the shared agent band. The by-TYPE breakdown is NOT a field here — it's the
  // feed's group headers below (Proposals · Edits · Reviews), so the band carries only the rollup.
  const dSummary = `${decisionWork.length + mineEdges.length + mineSugs.length + reviews.length} waiting on your call`;

  if (decisionWork.length === 0 && mine.length === 0 && reviews.length === 0) {
    return (
      // the status dish on the forest MARK token (it was a hand-written primary/10, the same value), the body on
      // the ladder's 15 (it was the literal 15px)
      <div className="flex flex-col items-center gap-2 rounded-xl border py-14 text-center">
        <span className="flex size-9 items-center justify-center rounded-full bg-mark text-primary">
          <CheckCheck className="size-4.5" />
        </span>
        <p className="text-lg font-medium">Inbox zero</p>
        <p className="max-w-xs text-base text-muted-foreground">
          Nothing waiting on your call. Every drop is filed and every change you own is confirmed or cleared.
        </p>
      </div>
    );
  }

  // ONE grouped feed, categorised BY TYPE — the same FeedHead + DIVIDED grammar the other tabs use. Proposals
  // (the agent's link batches) · Edits (teammates' suggestions) · Reviews (your own drops). Each header IS the
  // count that used to live in the band's summary field.
  const feed: React.ReactNode[] = [];
  const approvalWork = decisionWork.filter((item) => item.kind === "approve");
  const activationWork = decisionWork.filter(
    (item) => item.kind === "add_activation_evidence" || item.kind === "confirm_activation",
  );
  const revalidationWork = decisionWork.filter((item) => item.kind === "revalidate");
  if (revalidationWork.length) {
    feed.push(<FeedHead key="h-revalidation" count={revalidationWork.length}>Revalidation</FeedHead>);
    for (const item of revalidationWork) {
      feed.push(
        <DecisionActionRow
          key={item.id}
          item={item}
          expanded={expandedDecisionId === item.decision_id}
          onToggle={() => setExpandedDecisionId((id) => (id === item.decision_id ? null : item.decision_id))}
          onChoose={(choice) => resolveDecisionWork(item, choice)}
          onAsk={(prompt) => askDecision(item, prompt)}
          onAddProof={() => setProofDecision(item.record.decision)}
        />,
      );
    }
  }
  if (activationWork.length) {
    feed.push(<FeedHead key="h-activation" count={activationWork.length}>Activation evidence</FeedHead>);
    for (const item of activationWork) {
      feed.push(
        <DecisionActionRow
          key={item.id}
          item={item}
          expanded={expandedDecisionId === item.decision_id}
          onToggle={() => setExpandedDecisionId((id) => (id === item.decision_id ? null : item.decision_id))}
          onChoose={(choice) => resolveDecisionWork(item, choice)}
          onAsk={(prompt) => askDecision(item, prompt)}
          onAddProof={() => setProofDecision(item.record.decision)}
        />,
      );
    }
  }
  if (approvalWork.length) {
    feed.push(<FeedHead key="h-approval" count={approvalWork.length}>Approval</FeedHead>);
    for (const item of approvalWork) {
      feed.push(
        <DecisionActionRow
          key={item.id}
          item={item}
          expanded={expandedDecisionId === item.decision_id}
          onToggle={() => setExpandedDecisionId((id) => (id === item.decision_id ? null : item.decision_id))}
          onChoose={(choice) => resolveDecisionWork(item, choice)}
          onAsk={(prompt) => askDecision(item, prompt)}
          onAddProof={() => setProofDecision(item.record.decision)}
        />,
      );
    }
  }
  if (mineEdges.length) {
    feed.push(
      <FeedHead key="h-proposals" count={mineEdges.length}>
        Proposals
      </FeedHead>,
    );
    for (const g of shapeGroups) {
      feed.push(
        g.length >= 2 ? (
          <ShapeGroup
            key={`grp-${g[0].p.edge_id}`}
            edges={g}
            welding={welding}
            onResolve={onEdge}
            onConfirmAll={confirmGroupWelded}
          />
        ) : (
          <ChangeRow
            key={changeKey(g[0])}
            c={g[0]}
            welding={welding.includes(g[0].p.edge_id)}
            onEdge={onEdge}
            onSuggestion={resolveSuggestion}
          />
        ),
      );
    }
  }
  if (mineSugs.length) {
    feed.push(
      <FeedHead key="h-edits" count={mineSugs.length}>
        Edits
      </FeedHead>,
    );
    for (const c of mineSugs) feed.push(<ChangeRow key={changeKey(c)} c={c} onEdge={onEdge} onSuggestion={resolveSuggestion} />);
  }
  if (reviews.length) {
    feed.push(
      <FeedHead key="h-reviews" count={reviews.length}>
        Reviews
      </FeedHead>,
    );
    for (const r of reviews) feed.push(<ReviewCard key={r.id} r={r} onChoose={(id) => resolveReview(r, id)} />);
  }

  return (
    <div className="flex flex-col">
      <AgentBand summary={dSummary} className="pb-4" />
      {/* the automate nudge — the agent's offer, hung under its byline (see LearnPrompt), and set apart from the
          decision feed by the feed's hairline, not stuck to the first group header. */}
      {promotable[0] && !initialDecisionId ? (
        <LearnPrompt
          rule={promotable[0]}
          onAutomate={() => automate(promotable[0])}
          onIgnore={() => ignore(promotable[0])}
          onOpenGovernance={onOpenGovernance}
        />
      ) : null}
      {focusedPacket ? (
        <div className="mb-4">
          <ReviewPacketView
            packet={focusedPacket}
            onAsk={(prompt) =>
              openSearch(prompt, {
                kind: "decision",
                id: focusedPacket.record.decision.id,
                title: focusedPacket.record.decision.text,
              })
            }
            onAddProof={
              focusedPacket.record.state === "waiting_activation"
                ? () => setProofDecision(focusedPacket.record.decision)
                : undefined
            }
          />
        </div>
      ) : initialDecisionId && !focusedAction ? (
        <div className="mb-4 rounded-lg bg-tint-1 px-4 py-3 text-sm text-muted-foreground">
          Decision unavailable. It may have moved or be outside your reachable scope.
        </div>
      ) : null}
      {/* the feed's top rule is Activity's (border-border, solid): it was border/60, a hand-written alpha and a
          paler first line than the hairlines under it */}
      <div className={cn(DIVIDED, "border-t border-border")}>{feed}</div>

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
      {proofDecision ? (
        <ActivationObservationDialog
          decision={proofDecision}
          open
          onOpenChange={(next) => {
            if (!next) setProofDecision(null);
          }}
          onRecorded={(evidence) => {
            const match = activationEvidenceSatisfiesRequirement(proofDecision, evidence);
            setProofDecision(null);
            setDecisionWork(listDecisionActions());
            setExpandedDecisionId(proofDecision.id);
            notify.success("Downstream proof added", {
              description: match
                ? "Saved as a matching candidate. An authority still needs to confirm activation."
                : "Saved as a candidate. It does not yet satisfy the full activation requirement.",
            });
          }}
        />
      ) : null}
    </div>
  );
}
