"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Check, Diamond, FileText, History, Inbox, TriangleAlert } from "lucide-react";
import { AgentMark } from "@/components/agent-mark";
import { ACTIVATION_MATCH, DecisionStateLabel, activationTrustLabel, observedAtLabel } from "@/components/decision-state";
import { HashChip, isHashLike } from "@/components/exact-evidence-snapshot";
import { SystemState } from "@/components/system-state";
import { useSearch } from "@/components/search";
import { Button } from "@/components/ui/button";
import { activationConditionSatisfaction } from "@/lib/activation";
import {
  artifactVersionById,
  currentCapturedEvidenceHref,
  decisionRecord,
  decisionTruth,
  evidenceRefById,
  reviewPacket,
  sourceById,
} from "@/lib/api";
import { houseSeparators, upperFirst } from "@/lib/text";
import { useGraphVersion } from "@/lib/use-graph-version";
import { cn } from "@/lib/utils";

const AXIS = {
  verification: { provisional: "Provisional extraction", verified: "Verified extraction" },
  authorization: { pending: "Not authorized", approved: "Authorized", superseded: "Historical authorization" },
  activation: { none: "Not activated", candidate: "Activation candidate", confirmed: "Activation confirmed" },
  freshness: { current: "Evidence current", changed: "Evidence changed", superseded: "Evidence superseded" },
} as const;

const EVIDENCE_STATE = { current: "current", changed: "changed since", superseded: "superseded" } as const;

// `capitalize` was doing the casing here, which turned "not applicable" into "Not Applicable" and
// "config revision" into "Config Revision": title case on what should read as sentence case.
function readable(value?: string): string {
  return value ? upperFirst(value.replaceAll("_", " ")) : "Not recorded";
}

// The page's labels (section heads, the grid's facts) sit on the row-title rung and differ from their values
// by ink, never by a size of their own; meta lines sit one rung down on text-xs.
const SECTION = "text-base font-medium";
const FACT_LABEL = "text-xs text-muted-foreground";

export function DecisionDetail({ decisionId }: { decisionId: string }) {
  useGraphVersion();
  const { openSearch } = useSearch();
  const record = decisionRecord(decisionId);
  const truth = decisionTruth(decisionId);
  const packet = reviewPacket(decisionId);
  if (!record || !truth || !packet) {
    return (
      <SystemState
        variant="error"
        scope="reader"
        title="This decision could not load"
        action={{ onClick: () => window.location.reload(), label: "Reload page" }}
      />
    );
  }
  const authority = record.authority?.name;
  const successor = truth.cites.find((cite) => cite.decision_id && cite.decision_id !== decisionId);
  const prompt = packet.ask_prompt;
  const actionable = record.state === "needs_approval" || record.state === "waiting_activation" || record.state === "needs_revalidation";
  const selectedActivation = truth.activation_evidence_id
    ? record.activation.find((event) => event.id === truth.activation_evidence_id)
    : undefined;
  const selectedEvidence = selectedActivation?.evidence_ref_id
    ? evidenceRefById(selectedActivation.evidence_ref_id)
    : undefined;
  const selectedEvidenceHref = selectedEvidence ? currentCapturedEvidenceHref(selectedEvidence) : undefined;
  const activationProof = selectedEvidence && selectedEvidenceHref
    ? {
        evidence: selectedEvidence,
        href: selectedEvidenceHref,
        version: artifactVersionById(selectedEvidence.artifact_id, selectedEvidence.version_id),
        source: selectedEvidence.source_id ? sourceById(selectedEvidence.source_id) : undefined,
      }
    : undefined;
  const activationMatch = selectedActivation
    ? activationConditionSatisfaction(record.decision, selectedActivation)
    : "unknown";
  const activationProofUnavailable = Boolean(selectedActivation && !activationProof);
  const displayedActivationMatch = activationProofUnavailable ? "unverified" : activationMatch;
  const activationTrust = selectedActivation
    ? activationTrustLabel(selectedActivation.prov, authority, activationProofUnavailable)
    : undefined;
  const activationAxisLabel = activationProofUnavailable
    ? truth.activation === "candidate" ? "Candidate, proof unavailable" : "Activation recorded, proof unavailable"
    : AXIS.activation[truth.activation];
  // The source line under the proof. It printed "audit · Q4 launch calendar · published state · version v4 ·
  // hash" and then the whole 64-character hash: the source's label repeated the evidence label word for word
  // above it, and the hash ran onto a line of its own. The source now says what kind it is (and its name only
  // when that differs), and the hash is a chip.
  const proofSource = activationProof
    ? activationProof.source
      ? `${upperFirst(activationProof.source.kind)} source${activationProof.source.label !== activationProof.evidence.label ? ` “${activationProof.source.label}”` : ""}`
      : "Source unavailable"
    : undefined;
  return (
    <div className="mx-auto w-full max-w-[840px] px-5 pb-20 pt-8 sm:px-8 sm:pt-12">
      <Link href={`/artifact/${record.decision.artifact_id}`} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground">
        <ArrowLeft className="size-3.5" /> Back to {packet.artifact.title}
      </Link>

      <header className="mt-6 border-b pb-7">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Diamond className="size-3.5" /> Decision</span>
          <DecisionStateLabel state={record.state} />
        </div>
        {/* The display rung on purpose: the verdict names this page's eyebrow → display title → one plain
            sentence as the product's best register, so the title keeps text-3xl (the rung carries its own
            tracking, so the hand-written tracking-[-0.02em] is gone). */}
        <h1 className="mt-3 text-3xl font-medium">{record.decision.text}</h1>
        {/* The answer is composed in lib/api.ts, which still joins the proof's system and id with a middle
            dot; display only, the record is untouched. */}
        <p className={cn("mt-3 max-w-2xl text-lg", truth.hedged ? "text-muted-foreground" : "text-foreground-prose")}>{houseSeparators(truth.answer)}</p>
        {successor?.href ? (
          // Forest is the colour of assent and a link assents to nothing, so this is ink with an underline.
          <Link href={successor.href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline">
            Open the current decision <ArrowUpRight className="size-3.5" />
          </Link>
        ) : null}
      </header>

      <section className="mt-7">
        <p className={SECTION}>Current truth</p>
        <div className="mt-3 grid overflow-hidden rounded-lg border sm:grid-cols-2">
          {([
            ["Verification", AXIS.verification[truth.verification]],
            ["Authorization", AXIS.authorization[truth.authorization]],
            ["Activation", activationAxisLabel],
            ["Freshness", AXIS.freshness[truth.freshness]],
          ] as const).map(([label, value], index) => (
            <div key={label} className={cn("px-4 py-3", index > 0 && "border-t sm:border-t-0", index % 2 === 1 && "sm:border-l", index > 1 && "sm:border-t")}>
              <p className={FACT_LABEL}>{label}</p>
              <p className="mt-0.5 text-base font-medium">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-7 grid gap-6 sm:grid-cols-2">
        <div>
          <p className={SECTION}>People and condition</p>
          {/* Label and value were joined by " · " inside one line ("Authority · Maya Chen"). A two-column
              list parts them by space; "Counts as active when" became "In effect when", the state's own
              words, short enough to hold the label column narrow. */}
          <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-4 gap-y-2 text-base">
            <dt className="text-muted-foreground">Authority</dt>
            <dd>{authority ?? "Unassigned"}</dd>
            <dt className="text-muted-foreground">Driver</dt>
            <dd>{record.driver?.name ?? "Unassigned"}</dd>
            <dt className="text-muted-foreground">In effect when</dt>
            <dd>{record.decision.activation_condition ?? "Not defined"}</dd>
          </dl>
        </div>
        <div>
          <p className={SECTION}>Exact evidence</p>
          <div className="mt-2 grid gap-2">
            {packet.evidence.map(({ ref, href }) => {
              // The sub-line printed the version's internal id ("a_notif-v3 · current"); a reader knows
              // the version by its label.
              const version = artifactVersionById(ref.artifact_id, ref.version_id)?.label ?? ref.version_id;
              return href ? (
                <Link key={ref.id} href={href} className="group/evidence flex items-start gap-2 text-base text-foreground">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="underline-offset-4 group-hover/evidence:underline">{houseSeparators(ref.label)}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">Version {version}, {EVIDENCE_STATE[ref.state]}</span>
                  </span>
                  <ArrowUpRight className="mt-0.5 size-3.5 text-foreground-hint opacity-0 group-hover/evidence:opacity-100" />
                </Link>
              ) : (
                <p key={ref.id} className="flex items-start gap-2 text-base text-muted-foreground"><FileText className="mt-0.5 size-4" /> Exact snapshot unavailable</p>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mt-7 border-t pt-7" aria-labelledby="selected-activation-proof">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <p className={SECTION} id="selected-activation-proof">Activation proof</p>
            {/* Was "The reducer-selected observation behind the current activation truth": the name of the
                function that picks it, read aloud. What a reader needs is who picked it and what it proves. */}
            <p className="mt-1 text-sm text-muted-foreground">
              The observation Woven picked as proof this decision is in effect.
            </p>
          </div>
          {selectedActivation ? (
            // A status chip: mark (forest 10%) when the authority confirmed it, tint-1 when it is still a
            // candidate. It was bg-primary/10 and bg-muted, a hand-written alpha and a fill darker than paper.
            <span className={cn(
              "mt-1 w-fit shrink-0 rounded-full px-2.5 py-1 text-xs font-medium sm:mt-0",
              activationProofUnavailable
                ? "bg-warn/10 text-warn"
                : selectedActivation.prov === "human_verified" ? "bg-mark text-primary" : "bg-tint-1 text-muted-foreground",
            )}>
              {activationTrust}
            </span>
          ) : null}
        </div>

        {selectedActivation ? (
          // The truth grid's container, not a second one: a hairline box with no fill. The proof sat in a
          // filled panel (bg-secondary/35) that was the one tinted surface on the page.
          <div className="mt-3 min-w-0 rounded-lg border p-4">
            <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
              <p className="min-w-0 break-words text-base font-medium">
                {selectedActivation.system}, {selectedActivation.external_id ?? selectedActivation.label}
              </p>
              {/* Was "Requirement Match · Satisfied" (a field name, a dot, and `capitalize` making it title
                  case). It is a finding, so it says the finding. */}
              <span className={cn(
                "shrink-0 text-xs font-medium",
                displayedActivationMatch === "satisfied" ? "text-primary" : displayedActivationMatch === "contradicted" ? "text-destructive" : "text-warn",
              )}>
                {ACTIVATION_MATCH[displayedActivationMatch]}
              </span>
            </div>

            <div className="mt-3 border-t pt-3">
              <p className={FACT_LABEL}>Exact captured evidence</p>
              {activationProof ? (
                // The row was one link wrapping the label and the meta line. The hash chip carries a copy
                // button, and a button cannot sit inside a link, so the link is the label alone.
                <div className="mt-1.5 flex min-w-0 items-start gap-2">
                  <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <Link href={activationProof.href} className="group/proof inline-flex items-center gap-1 text-sm font-medium text-foreground underline-offset-4 hover:underline">
                      {houseSeparators(activationProof.evidence.label)}
                      <ArrowUpRight className="size-3.5 shrink-0 text-foreground-hint opacity-0 group-hover/proof:opacity-100" />
                    </Link>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-1 text-xs text-muted-foreground">
                      <span>
                        {proofSource}, version {activationProof.version?.label ?? activationProof.evidence.version_id},
                        {activationProof.version?.content_hash ? " hash" : " no content hash recorded"}
                      </span>
                      {activationProof.version?.content_hash ? <HashChip value={activationProof.version.content_hash} /> : null}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="mt-2 flex items-start gap-2 text-sm text-warn">
                  <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                  The exact proof is outside what you can open, so Woven can&rsquo;t link to it or rely on it here. Treat this activation as unverified.
                </p>
              )}
            </div>

            {/* "Trust" repeated the chip in the section's header word for word; the four facts stand alone. */}
            <dl className="mt-3 grid min-w-0 gap-x-6 gap-y-2 border-t pt-3 text-sm sm:grid-cols-2">
              <div className="min-w-0"><dt className={FACT_LABEL}>Observation</dt><dd className="mt-0.5 font-medium">{readable(selectedActivation.observation_type)}</dd></div>
              <div className="min-w-0"><dt className={FACT_LABEL}>Target</dt><dd className="mt-0.5 break-all font-medium">{selectedActivation.target ?? "Not recorded"}</dd></div>
              <div className="min-w-0"><dt className={FACT_LABEL}>Environment</dt><dd className="mt-0.5 font-medium">{readable(selectedActivation.environment)}</dd></div>
              <div className="min-w-0"><dt className={FACT_LABEL}>Observed at</dt><dd className="mt-0.5 break-words font-medium tabular-nums">{observedAtLabel(selectedActivation.observed_at ?? selectedActivation.at)}</dd></div>
            </dl>

            <div className="mt-3 grid min-w-0 gap-4 border-t pt-3 sm:grid-cols-2">
              <div className="min-w-0">
                <p className={FACT_LABEL}>Assertion</p>
                {selectedActivation.assertion ? (
                  // "14 ↓ 14" asked the reader to know the arrow meant expected-then-observed; now it says so.
                  <div className="mt-1 text-sm">
                    <p className="break-words font-medium">{selectedActivation.assertion.subject}</p>
                    <p className="mt-0.5 break-words text-muted-foreground">
                      {selectedActivation.assertion.expected
                        ? `Expected ${selectedActivation.assertion.expected}`
                        : readable(selectedActivation.assertion.operator)}
                      , observed <span className="text-foreground">{selectedActivation.assertion.actual || "nothing recorded"}</span>
                    </p>
                  </div>
                ) : <p className="mt-1 text-sm text-warn">No structured assertion</p>}
              </div>
              <div className="min-w-0">
                <p className={FACT_LABEL}>Revision</p>
                {selectedActivation.revision ? (
                  <dl className="mt-1 grid gap-1 text-sm">
                    {Object.entries(selectedActivation.revision).map(([key, value]) => value ? (
                      <div key={key} className="flex min-w-0 items-center gap-1.5">
                        <dt className="shrink-0 text-muted-foreground">{readable(key)}</dt>
                        {/* A commit SHA or digest is an id, not words: the same chip as the content hash. */}
                        <dd className="min-w-0 break-all font-medium">{isHashLike(value) ? <HashChip value={value} label="Copy full revision" /> : value}</dd>
                      </div>
                    ) : null)}
                  </dl>
                ) : <p className="mt-1 text-sm text-warn">No immutable revision</p>}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
            <History className="mt-0.5 size-4 shrink-0" />
            <p>
              {truth.activation === "none"
                ? "No downstream observation has been picked as proof yet."
                : "The proof Woven picked isn't available to you. Treat the conclusion as hedged until the exact proof can be opened."}
            </p>
          </div>
        )}
      </section>

      <section className="mt-7">
        <p className={SECTION}>Trust history</p>
        {/* Each event was one dotted chain ("Activation confirmed · selected · Launch calendar · launch-q4-v4",
            "Approved by Maya Chen · 2d"). The event is the line, where it came from is its muted second
            half, and the time sits at the row's end where every timestamp in the house sits. */}
        <ul className="mt-2 grid gap-2 text-base">
          {record.approvals.map((event) => (
            <li key={event.id} className="flex items-baseline justify-between gap-4">
              <span><Check className="mr-1.5 inline size-3.5 text-primary" />Approved by {authority ?? "the authority"}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{event.at}</span>
            </li>
          ))}
          {record.activation.map((event) => {
            const authorityRecorded = event.prov === "human_verified";
            const selected = event.id === truth.activation_evidence_id;
            const eventRef = event.evidence_ref_id ? evidenceRefById(event.evidence_ref_id) : undefined;
            const eventHasExactProof = Boolean(eventRef && currentCapturedEvidenceHref(eventRef));
            const proofUnavailable = (selected && activationProofUnavailable) || (authorityRecorded && !eventHasExactProof);
            const label = proofUnavailable
              ? authorityRecorded ? "Confirmation recorded, exact proof unavailable" : "Candidate, proof unavailable"
              : authorityRecorded ? "Activation confirmed" : "Activation candidate";
            return (
              <li key={event.id} className="flex items-baseline justify-between gap-4">
                <span className={proofUnavailable ? "text-warn" : authorityRecorded ? "text-foreground" : "text-muted-foreground"}>
                  {proofUnavailable
                    ? <TriangleAlert className="mr-1.5 inline size-3.5" />
                    : <Check className={cn("mr-1.5 inline size-3.5", authorityRecorded ? "text-primary" : "text-muted-foreground")} />}
                  {label}
                  <span className="text-muted-foreground"> on {event.system}, {event.external_id ?? event.label}{selected ? ", the proof above" : ""}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{event.at}</span>
              </li>
            );
          })}
          {record.revalidations.map((event) => (
            <li key={event.id} className="flex items-baseline justify-between gap-4">
              <span><History className="mr-1.5 inline size-3.5 text-primary" />Revalidated by {authority ?? "the authority"}<span className="text-muted-foreground">, old evidence kept</span></span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{event.at}</span>
            </li>
          ))}
          {!record.approvals.length && !record.activation.length && !record.revalidations.length ? <li className="text-muted-foreground">No trust events yet.</li> : null}
        </ul>
      </section>

      {/* Both controls write nothing (one opens the Inbox, one asks), so both are neutral: Ask was the page's
          one solid forest button, and the generic Sparkles stood in for the agent, which is AgentMark. */}
      <div className="mt-8 flex flex-wrap gap-2 border-t pt-5">
        {actionable ? (
          <Button variant="outline" nativeButton={false} render={<Link href={`/inbox?decision=${decisionId}`} />}>
            <Inbox className="size-4" /> Review in Inbox
          </Button>
        ) : null}
        <Button variant="outline" onClick={() => openSearch(prompt, { kind: "decision", id: decisionId, title: record.decision.text })}>
          <AgentMark state="still" size={16} className="size-4 text-primary" /> Ask this decision
        </Button>
      </div>
    </div>
  );
}
