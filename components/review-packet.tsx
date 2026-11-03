import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  Diamond,
  FileText,
  Fingerprint,
  History,
  Plus,
  TriangleAlert,
  X,
} from "lucide-react";

import { AgentMark } from "@/components/agent-mark";
import { ACTIVATION_MATCH, activationTrustLabel, observedAtLabel } from "@/components/decision-state";
import { HashChip, isHashLike } from "@/components/exact-evidence-snapshot";
import { Button } from "@/components/ui/button";
import { ChoiceValve } from "@/components/proposal";
import { activationConditionSatisfaction } from "@/lib/activation";
import {
  artifactVersionById,
  currentCapturedEvidenceHref,
  evidenceRefById,
  sourceById,
} from "@/lib/api";
import { houseSeparators, upperFirst } from "@/lib/text";
import type { ActivationEvidence, EvidenceRef, EvidenceRefState, ReviewPacket } from "@/lib/types";
import { cn } from "@/lib/utils";

const EVIDENCE_STATE: Record<EvidenceRefState, string> = {
  current: "Current",
  changed: "Changed",
  superseded: "Superseded",
};

const REVIEW_FOCUS = {
  needs_approval: "Approval brief",
  waiting_activation: "Activation brief",
  in_effect: "Decision brief",
  needs_revalidation: "Revalidation brief",
  superseded: "Historical decision brief",
} as const;

const CURRENT_STATE = {
  needs_approval: "Needs authorization",
  waiting_activation: "Waiting for downstream proof",
  in_effect: "In effect",
  needs_revalidation: "Needs revalidation",
  superseded: "Superseded",
} as const;

type ReviewAction = { id: string; label: string; primary?: boolean };

// `capitalize` did the casing at every call site and made it title case ("Not Applicable"); sentence case here.
function readable(value?: string): string {
  return value ? upperFirst(value.replaceAll("_", " ")) : "Not recorded";
}

// The brief is a Dense surface: its labels are text-xs, its values text-sm, and the step between them is ink.
const LABEL = "text-xs font-medium text-muted-foreground";

function selectedActivation(packet: ReviewPacket): ActivationEvidence | undefined {
  const selectedId = packet.current_truth.activation_evidence_id;
  if (selectedId) return packet.record.activation.find((item) => item.id === selectedId);
  if (packet.current_truth.activation === "confirmed") {
    return [...packet.record.activation].reverse().find((item) => item.prov === "human_verified");
  }
  if (packet.current_truth.activation === "candidate") {
    return [...packet.record.activation].reverse().find((item) => item.prov === "ai_generated");
  }
  return undefined;
}

function exactProof(activation?: ActivationEvidence) {
  if (!activation?.evidence_ref_id) return undefined;
  const ref = evidenceRefById(activation.evidence_ref_id);
  if (!ref) return undefined;
  const href = currentCapturedEvidenceHref(ref);
  if (!href) return undefined;
  const version = artifactVersionById(ref.artifact_id, ref.version_id);
  const source = ref.source_id ? sourceById(ref.source_id) : undefined;
  return { evidence: ref, version, source, href };
}

// The sub-line printed the version's internal id ("Current · a_notif-v3"); a reader knows a version by its label.
function EvidenceLink({ evidence, href }: { evidence: EvidenceRef; href?: string }) {
  const version = artifactVersionById(evidence.artifact_id, evidence.version_id)?.label ?? evidence.version_id;
  const content = (
    <>
      <FileText className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block font-medium">{houseSeparators(evidence.label)}</span>
        <span className={cn("mt-0.5 block text-xs", evidence.state === "current" ? "text-muted-foreground" : "text-warn")}>
          {EVIDENCE_STATE[evidence.state]}, version {version}
        </span>
      </span>
      {href ? <ArrowUpRight className="mt-0.5 size-3.5 shrink-0 text-foreground-hint" /> : null}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="flex min-w-0 items-start gap-2 rounded-md py-1.5 text-sm text-foreground outline-none transition-colors hover:underline focus-visible:ring-2 focus-visible:ring-ring"
    >
      {content}
    </Link>
  ) : (
    <div className="flex min-w-0 items-start gap-2 py-1.5 text-sm text-muted-foreground">{content}</div>
  );
}

export function ReviewPacketView({
  packet,
  onAsk,
  actions,
  onChoose,
  onClose,
  onAddProof,
}: {
  packet: ReviewPacket;
  onAsk: (prompt: string) => void;
  actions?: ReviewAction[];
  onChoose?: (id: string) => void;
  onClose?: () => void;
  onAddProof?: () => void;
}) {
  const { record } = packet;
  const authority = record.authority?.name;
  const activation = selectedActivation(packet);
  const proof = exactProof(activation);
  const activationProofUnavailable = Boolean(activation && !proof);
  const requirement = record.decision.activation_requirement;
  const satisfaction = activation ? activationConditionSatisfaction(record.decision, activation) : "unknown";
  const displayedSatisfaction = activationProofUnavailable ? "unverified" : satisfaction;
  const activationTrust = activation ? activationTrustLabel(activation.prov, authority, activationProofUnavailable) : undefined;
  // Same source line as the Decision page: the kind of source (its name only when it differs from the
  // evidence label above it), the version, and the hash as a chip rather than 64 characters of body text.
  const proofSource = proof
    ? proof.source
      ? `${upperFirst(proof.source.kind)} source${proof.source.label !== proof.evidence.label ? ` “${proof.source.label}”` : ""}`
      : "Source unavailable"
    : undefined;
  const truthWarnings = [
    packet.current_truth.verification === "provisional" ? "Record is provisional" : null,
    packet.current_truth.authorization === "pending" ? "Not authorized" : null,
    packet.current_truth.freshness !== "current" ? `Evidence ${packet.current_truth.freshness}` : null,
    packet.current_truth.hedged ? "Current truth is hedged" : null,
  ].filter(Boolean);

  return (
    <section
      id={`review-packet-${record.decision.id}`}
      aria-label="Decision review brief"
      // A sunk well inside the row (tint-1), where it was bg-secondary/55, a hand-written alpha.
      className="mt-3 min-w-0 rounded-xl bg-tint-1 px-4 py-4 sm:px-5 sm:py-5"
    >
      <header>
        <div className="flex items-center gap-3">
          <h2 className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Diamond className="size-3.5" /> {REVIEW_FOCUS[record.state]}
          </h2>
          {onClose ? (
            <Button size="xs" variant="ghost" onClick={onClose} className="ml-auto text-muted-foreground">
              Close <X className="size-3" />
            </Button>
          ) : null}
        </div>

        {/* An opaque card on the well, where it was bg-background/55 */}
        <div className="mt-3 rounded-lg bg-card px-3.5 py-3">
          <p className={LABEL}>Conclusion</p>
          <p className="mt-1 max-w-3xl text-base font-medium text-foreground">{packet.question}</p>
          {/* composed in lib/api.ts, which still joins the proof's system and id with a middle dot; display only */}
          <p className="mt-1.5 max-w-4xl text-sm text-foreground-prose">{houseSeparators(packet.current_truth.answer)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {/* forest only once the decision is in effect (a confirm); a pending state was forest too, and
                forest on "Needs authorization" read as already granted */}
            <span className={cn("font-medium", record.state === "needs_revalidation" ? "text-warn" : record.state === "in_effect" ? "text-primary" : "text-foreground")}>
              {CURRENT_STATE[record.state]}
            </span>
            {/* "Authority · Maya Chen": the role and the name are parted by ink, not by a dot */}
            <span className="text-muted-foreground">Authority <span className="text-foreground">{authority ?? "Unassigned"}</span></span>
            <span className="text-muted-foreground">Driver <span className="text-foreground">{record.driver?.name ?? "Unassigned"}</span></span>
            {truthWarnings.map((warning) => <span key={warning} className="text-warn">{warning}</span>)}
          </div>
        </div>
      </header>

      {/* The four section labels were numbered with a middle dot ("1 · Activation condition"). Their order on
          the page already numbers them. */}
      <section aria-labelledby={`${packet.id}-contract`} className="mt-4 border-t pt-4">
        <p className={LABEL}>Activation condition</p>
        <h3 id={`${packet.id}-contract`} className="mt-1 text-base font-medium">
          {record.decision.activation_condition ?? "No activation condition is defined."}
        </h3>
        <dl className="mt-2.5 flex flex-col gap-1.5 text-sm sm:flex-row sm:flex-wrap sm:gap-x-5">
          <div className="flex min-w-0 gap-1.5"><dt className="text-muted-foreground">Kind</dt><dd>{readable(requirement?.kind)}</dd></div>
          <div className="flex min-w-0 gap-1.5"><dt className="text-muted-foreground">Target</dt><dd className="break-all">{requirement?.target ?? "Not recorded"}</dd></div>
          <div className="flex min-w-0 gap-1.5"><dt className="text-muted-foreground">Environment</dt><dd>{readable(requirement?.environment)}</dd></div>
        </dl>
      </section>

      <section aria-labelledby={`${packet.id}-activation-proof`} className="mt-4 border-t pt-4">
        <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
          <div>
            {/* "Selected activation proof": selected by what was never said. The Decision page says it in a
                sentence; here the label is the noun and the trust chip says whose word it carries. */}
            <p className={LABEL}>Activation proof</p>
            <h3 id={`${packet.id}-activation-proof`} className="mt-1 text-sm font-medium">
              {activation ? `${activation.system}, ${activation.external_id ?? activation.label}` : "No observation picked as proof yet"}
            </h3>
          </div>
          {activation ? (
            // status chip: mark when the authority confirmed it, tint-1 when it is a candidate (were
            // bg-primary/10 and bg-muted)
            <span className={cn(
              "mt-1 w-fit rounded-full px-2 py-0.5 text-xs font-medium sm:mt-0",
              activationProofUnavailable
                ? "bg-warn/10 text-warn"
                : activation.prov === "human_verified" ? "bg-mark text-primary" : "bg-tint-1 text-muted-foreground",
            )}>
              {activationTrust}
            </span>
          ) : null}
        </div>

        {activation ? (
          // a hairline box on the well; its fill (bg-background/45) was a third ground inside two others
          <div className="mt-2.5 rounded-lg border p-3.5">
            <div className="flex min-w-0 flex-col gap-3">
              <div className="min-w-0">
                <p className={LABEL}>Exact captured evidence</p>
                {proof ? (
                  <div className="mt-1.5">
                    <EvidenceLink evidence={proof.evidence} href={proof.href} />
                    {/* outside the link: the hash chip carries a copy button, which cannot sit inside a link.
                        pl-5 + the icon column's own 2px is 22, the label's edge; pl-5.5 was a fractional rung. */}
                    <p className="mt-1 flex flex-wrap items-center gap-x-1 break-words pl-5 text-xs text-muted-foreground">
                      <span>
                        {proofSource}, version {proof.version?.label ?? proof.evidence.version_id},
                        {proof.version?.content_hash ? " hash" : " no content hash recorded"}
                      </span>
                      {proof.version?.content_hash ? <HashChip value={proof.version.content_hash} /> : null}
                    </p>
                  </div>
                ) : (
                  <p className="mt-1.5 flex items-start gap-2 text-sm text-warn">
                    <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> No exact evidence you can open is attached to this observation.
                  </p>
                )}
              </div>

              <dl className="grid min-w-0 gap-x-5 gap-y-2 border-t pt-3 text-sm sm:grid-cols-2">
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">Observed target</dt><dd className="mt-0.5 break-all font-medium">{activation.target ?? "Not recorded"}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">Environment</dt><dd className="mt-0.5 font-medium">{readable(activation.environment)}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">Observation</dt><dd className="mt-0.5 font-medium">{readable(activation.observation_type)}</dd></div>
                <div className="min-w-0"><dt className="text-xs text-muted-foreground">Observed at</dt><dd className="mt-0.5 break-words font-medium tabular-nums">{observedAtLabel(activation.observed_at ?? activation.at)}</dd></div>
              </dl>

              <div className="grid min-w-0 gap-3 border-t pt-3 sm:grid-cols-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Assertion</p>
                  {activation.assertion ? (
                    // "14 ↓ 14" asked the reader to know the arrow meant expected-then-observed; now it says so
                    <div className="mt-1 text-sm">
                      <p className="break-words font-medium">{activation.assertion.subject}</p>
                      <p className="mt-0.5 break-words text-muted-foreground">
                        {activation.assertion.expected
                          ? `Expected ${activation.assertion.expected}`
                          : readable(activation.assertion.operator)}
                        , observed <span className="text-foreground">{activation.assertion.actual || "nothing recorded"}</span>
                      </p>
                    </div>
                  ) : <p className="mt-1 text-sm text-warn">No structured assertion</p>}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">Revision</p>
                  {activation.revision ? (
                    <dl className="mt-1 grid gap-0.5 text-sm">
                      {Object.entries(activation.revision).map(([key, value]) => value ? (
                        <div key={key} className="flex min-w-0 items-center gap-1.5">
                          <dt className="shrink-0 text-muted-foreground">{readable(key)}</dt>
                          {/* a commit SHA or digest is an id, not words: the same chip as the content hash */}
                          <dd className="min-w-0 break-all font-medium">{isHashLike(value) ? <HashChip value={value} label="Copy full revision" /> : value}</dd>
                        </div>
                      ) : null)}
                    </dl>
                  ) : <p className="mt-1 text-sm text-warn">No immutable revision</p>}
                </div>
              </div>

              {/* "Requirement match · satisfied · <note>": a field name, its value and the note chained by dots.
                  The finding is the line; the note is its muted second line. */}
              <div className={cn(
                "flex items-start gap-2 border-t pt-3 text-sm",
                displayedSatisfaction === "satisfied" ? "text-primary" : displayedSatisfaction === "contradicted" ? "text-destructive" : "text-warn",
              )}>
                {displayedSatisfaction === "satisfied" ? <Check className="mt-0.5 size-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />}
                <p className="min-w-0">
                  <span className="font-medium">{ACTIVATION_MATCH[displayedSatisfaction]}</span>
                  {activation.condition_note ? <span className="block text-muted-foreground">{activation.condition_note}</span> : null}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-2.5 flex flex-col items-start gap-2 rounded-lg border border-dashed px-3.5 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>No exact downstream proof is attached yet.</span>
            {record.state === "waiting_activation" && onAddProof ? (
              // opens the proof dialog and writes nothing itself, so it is neutral; the dialog's submit is the write
              <Button size="sm" variant="outline" onClick={onAddProof}><Plus className="size-3.5" /> Add downstream proof</Button>
            ) : null}
          </div>
        )}
      </section>

      <section aria-labelledby={`${packet.id}-support`} className="mt-4 border-t pt-4">
        <p className={LABEL}>Supporting decision record</p>
        <h3 id={`${packet.id}-support`} className="sr-only">Decision evidence and affected claims</h3>
        <div className="mt-2.5 grid min-w-0 gap-4 sm:grid-cols-2 sm:gap-6">
          <div className="min-w-0">
            <p className="text-xs font-medium">Decision evidence</p>
            <div className="mt-1 grid gap-1">
              {packet.evidence.map(({ ref: evidence, href }) => <EvidenceLink key={evidence.id} evidence={evidence} href={href} />)}
            </div>
          </div>
          <div className="min-w-0 border-t pt-3 sm:border-l sm:border-t-0 sm:pl-6 sm:pt-0">
            <p className="text-xs font-medium">Affected claims</p>
            {packet.related_claims.length ? (
              <ul className="mt-1.5 grid gap-2 text-sm text-foreground-prose">
                {packet.related_claims.map(({ claim, freshness }) => (
                  <li key={claim.id} className="flex min-w-0 items-start gap-2">
                    <span className="min-w-0 flex-1">{claim.text}</span>
                    <span className={cn("shrink-0 text-xs", freshness === "current" ? "text-muted-foreground" : "text-warn")}>
                      {EVIDENCE_STATE[freshness]}
                    </span>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1.5 text-sm text-muted-foreground">No related claims.</p>}
          </div>
        </div>
      </section>

      {/* Each event was a dotted chain ("Authorized by Maya Chen · 2d", "Candidate · selected · GitHub · PR #191").
          The event is the line, where it came from is its muted half, and the time ends the row. */}
      <section aria-labelledby={`${packet.id}-history`} className="mt-4 border-t pt-4">
        <p className={LABEL}>Trust history</p>
        <h3 id={`${packet.id}-history`} className="sr-only">Trust history</h3>
        <ol className="mt-2 grid gap-2.5 text-sm">
          <li className={cn("flex items-start gap-2", packet.current_truth.verification === "verified" ? "text-foreground" : "text-muted-foreground")}>
            <Fingerprint className="mt-0.5 size-3.5 shrink-0" />
            <span>{packet.current_truth.verification === "verified" ? "Decision record verified" : "Decision record still provisional"}</span>
          </li>
          <li className={cn("flex items-start gap-2", record.approval ? "text-foreground" : "text-muted-foreground")}>
            <Check className={cn("mt-0.5 size-3.5 shrink-0", record.approval && "text-primary")} />
            <span className="min-w-0 flex-1">{record.approval ? `Authorized by ${authority ?? "the authority"}` : "Not authorized yet"}</span>
            {record.approval ? <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{record.approval.at}</span> : null}
          </li>
          {record.revalidations.map((event) => (
            <li key={event.id} className="flex items-start gap-2 text-foreground">
              <History className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1">Revalidated by {authority ?? "the authority"}</span>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{event.at}</span>
            </li>
          ))}
          {record.activation.length ? record.activation.map((event) => {
            const eventProof = exactProof(event);
            const selected = event.id === packet.current_truth.activation_evidence_id;
            const authorityRecorded = event.prov === "human_verified";
            const proofUnavailable = !eventProof;
            const label = activationTrustLabel(event.prov, authority, proofUnavailable);
            return (
              <li key={event.id} className={cn("flex items-start gap-2", proofUnavailable ? "text-warn" : authorityRecorded ? "text-foreground" : "text-muted-foreground")}>
                {proofUnavailable
                  ? <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
                  : authorityRecorded
                    ? <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
                    : <History className="mt-0.5 size-3.5 shrink-0" />}
                <span className="min-w-0 flex-1">
                  {label}
                  <span className="text-muted-foreground"> on {event.system}, {event.external_id ?? event.label}{selected ? ", the proof above" : ""}</span>
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{event.at}</span>
              </li>
            );
          }) : (
            <li className="flex items-start gap-2 text-muted-foreground">
              <History className="mt-0.5 size-3.5 shrink-0" />
              <span>No observation picked as proof yet</span>
            </li>
          )}
          {packet.current_truth.freshness !== "current" ? (
            <li className="flex items-start gap-2 text-warn">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>Decision evidence {packet.current_truth.freshness} after authorization</span>
            </li>
          ) : null}
        </ol>
      </section>

      <footer className="mt-4 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-end sm:justify-between">
        {actions?.length && onChoose ? (
          <fieldset className="min-w-0 border-0 p-0">
            <legend className={cn("mb-1.5", LABEL)}>Your call</legend>
            <ChoiceValve actions={actions} onChoose={onChoose} />
          </fieldset>
        ) : <span />}
        <div className="flex flex-wrap items-center gap-2">
          {record.state === "waiting_activation" && onAddProof && activation && !actions?.some((action) => action.id === "add_proof") ? (
            <Button size="sm" variant="outline" onClick={onAddProof}><Plus className="size-3.5" /> Add downstream proof</Button>
          ) : null}
          <Button size="sm" variant="outline" nativeButton={false} render={<Link href={`/decision/${record.decision.id}`} />}>
            Open decision <ArrowUpRight className="size-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => onAsk(packet.ask_prompt)}>
            {/* the agent is AgentMark, never the generic Sparkles */}
            <AgentMark state="still" size={14} className="size-3.5 text-primary" /> Ask this decision
          </Button>
        </div>
      </footer>
    </section>
  );
}
