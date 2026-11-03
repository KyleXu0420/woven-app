import type {
  ActivationAssertion,
  ActivationConditionSatisfaction,
  ActivationEvidence,
  ActivationEvidenceKind,
  ActivationObservationType,
  Decision,
  SourceKind,
} from "./types";

const OBSERVATION_KINDS: Record<ActivationEvidenceKind, ActivationObservationType[]> = {
  merge: ["code_change"],
  deployment: ["deployment_receipt", "effective_config", "product_state"],
  publication: ["publication"],
  policy_change: ["policy_state"],
  customer_communication: ["customer_communication"],
  other: ["product_state"],
};

export function activationAssertionSatisfied(assertion?: ActivationAssertion): boolean | undefined {
  if (!assertion?.subject.trim() || !assertion.actual.trim()) return undefined;
  const actual = assertion.actual.trim();
  const expected = assertion.expected.trim();
  if (assertion.operator === "exists") return Boolean(actual);
  if (assertion.operator === "passes") {
    return ["pass", "passed", "true", "success", "succeeded"].includes(actual.toLowerCase());
  }
  if (!expected) return undefined;
  if (assertion.operator === "eq") return actual === expected;
  return actual.toLowerCase().includes(expected.toLowerCase());
}

export function activationEvidenceKindForObservation(
  observation: ActivationObservationType,
  requirementKind?: ActivationEvidenceKind,
): ActivationEvidenceKind {
  if (observation === "code_change") return "merge";
  if (observation === "deployment_receipt" || observation === "effective_config") return "deployment";
  if (observation === "publication") return "publication";
  if (observation === "policy_state") return "policy_change";
  if (observation === "customer_communication") return "customer_communication";
  return requirementKind === "deployment" ? "deployment" : "other";
}

export function activationSourceSupportsObservation(
  sourceKind: SourceKind | undefined,
  evidenceKind: ActivationEvidenceKind,
  observation: ActivationObservationType | undefined,
): boolean {
  if (!sourceKind || !observation) return false;
  if (sourceKind === "github") return evidenceKind === "merge" && observation === "code_change";
  if (sourceKind === "loom" || sourceKind === "transcript" || sourceKind === "meeting" || sourceKind === "link") {
    return false;
  }
  return sourceKind === "file" || sourceKind === "doc" || sourceKind === "audit";
}

// Pure, deterministic condition matching. Connector observation and organizational confirmation stay
// separate: this only says whether the external record can satisfy the Decision's structured requirement.
export function activationConditionSatisfaction(
  decision: Decision,
  evidence: ActivationEvidence,
): ActivationConditionSatisfaction {
  const requirement = decision.activation_requirement;
  if (
    !requirement ||
    (!evidence.external_id?.trim() && !evidence.href?.trim() && !evidence.evidence_ref_id?.trim()) ||
    !evidence.observation_type ||
    !evidence.observed_at?.trim() ||
    !evidence.capture_mode
  ) return "unknown";
  if (evidence.capture_mode.startsWith("manual_") && !evidence.evidence_ref_id?.trim()) return "unknown";
  if (!evidence.target) return "unknown";
  if (evidence.target !== requirement.target) return "contradicted";
  if (evidence.kind !== requirement.kind) return "partial";
  if (!OBSERVATION_KINDS[evidence.kind].includes(evidence.observation_type)) return "partial";
  if (requirement.environment && evidence.environment !== requirement.environment) {
    return evidence.environment ? "partial" : "unknown";
  }
  const assertionSatisfied = activationAssertionSatisfied(evidence.assertion);
  if (assertionSatisfied === undefined) return "unknown";
  if (!assertionSatisfied) return "contradicted";
  if (
    (evidence.kind === "deployment" || evidence.kind === "merge") &&
    !evidence.revision?.commit_sha?.trim() &&
    !evidence.revision?.artifact_digest?.trim() &&
    !evidence.revision?.config_revision?.trim()
  ) return "partial";
  return "satisfied";
}

export function activationEvidenceSatisfiesRequirement(
  decision: Decision,
  evidence: ActivationEvidence,
): boolean {
  return activationConditionSatisfaction(decision, evidence) === "satisfied";
}

export function activationHasStableLocator(evidence: ActivationEvidence): boolean {
  return Boolean(
    evidence.external_id?.trim() ||
      evidence.href?.trim() ||
      evidence.evidence_ref_id?.trim(),
  );
}

export function asActivationCandidate(
  input: Omit<ActivationEvidence, "recorded_by" | "prov" | "disposition">,
): ActivationEvidence {
  return {
    ...input,
    // These fields deliberately come after the spread so stale/untyped callers cannot self-upgrade trust.
    recorded_by: "agent",
    prov: "ai_generated",
  };
}

// The review surface, Ask, and Inbox must all point at the same unresolved observation. Recency wins: an
// older satisfying record must never hide a newer contradictory or partial observation of the same Decision.
// Confirmation/dismissal is append-only and arrives here as the derived disposition on the view model.
export function selectActivationCandidate(
  decision: Decision,
  items: ActivationEvidence[],
): ActivationEvidence | undefined {
  return items
    .map((item, index) => ({ item, index, observedAt: Date.parse(item.observed_at ?? "") }))
    .filter(({ item }) =>
      item.decision_id === decision.id &&
      item.prov === "ai_generated" &&
      item.disposition !== "dismissed" &&
      activationHasStableLocator(item),
    )
    .sort((a, b) => {
      const aTime = Number.isFinite(a.observedAt) ? a.observedAt : Number.NEGATIVE_INFINITY;
      const bTime = Number.isFinite(b.observedAt) ? b.observedAt : Number.NEGATIVE_INFINITY;
      return bTime - aTime || b.index - a.index;
    })[0]?.item;
}
