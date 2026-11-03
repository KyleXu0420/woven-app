import assert from "node:assert/strict";
import test from "node:test";
import {
  activationConditionSatisfaction,
  activationEvidenceKindForObservation,
  activationEvidenceSatisfiesRequirement,
  activationSourceSupportsObservation,
  asActivationCandidate,
  selectActivationCandidate,
} from "../lib/activation.ts";

const decision = {
  id: "de_test",
  text: "Enable the production behavior",
  artifact_id: "a_test",
  evidence_ref_ids: ["er_test"],
  authority_id: "pe_authority",
  driver_id: "pe_driver",
  activation_condition: "The behavior is deployed to production.",
  activation_requirement: {
    kind: "deployment",
    target: "product-service",
    environment: "production",
  },
};

const evidence = {
  id: "ae_test",
  decision_id: decision.id,
  kind: "deployment",
  label: "Production deploy",
  system: "Deployments",
  external_id: "deploy-123",
  at: "now",
  recorded_by: "agent",
  prov: "ai_generated",
  target: "product-service",
  environment: "production",
  observation_type: "deployment_receipt",
  observed_at: "2026-08-13T12:00:00Z",
  assertion: { subject: "deployment_status", operator: "passes", expected: "passed", actual: "passed" },
  revision: { repo: "acme/product", commit_sha: "1234567890123456789012345678901234567890" },
  capture_mode: "connector",
};

test("an exact downstream match satisfies the activation requirement", () => {
  assert.equal(activationConditionSatisfaction(decision, evidence), "satisfied");
  assert.equal(activationEvidenceSatisfiesRequirement(decision, evidence), true);
});

test("a merge is only partial evidence for a production deployment requirement", () => {
  assert.equal(activationConditionSatisfaction(decision, { ...evidence, kind: "merge" }), "partial");
});

test("a staging deployment is only partial evidence for production", () => {
  assert.equal(activationConditionSatisfaction(decision, { ...evidence, environment: "staging" }), "partial");
});

test("the wrong connector target contradicts the requirement", () => {
  assert.equal(activationConditionSatisfaction(decision, { ...evidence, target: "other-service" }), "contradicted");
});

test("missing structured requirement cannot be confirmed", () => {
  assert.equal(activationConditionSatisfaction({ ...decision, activation_requirement: undefined }, evidence), "unknown");
});

test("missing stable downstream locator cannot be confirmed", () => {
  assert.equal(
    activationEvidenceSatisfiesRequirement(decision, { ...evidence, external_id: undefined, href: undefined }),
    false,
  );
});

test("a failed observed assertion contradicts the condition", () => {
  assert.equal(
    activationConditionSatisfaction(decision, { ...evidence, assertion: { ...evidence.assertion, actual: "failed" } }),
    "contradicted",
  );
});

test("manual evidence requires an exact captured evidence reference", () => {
  assert.equal(activationConditionSatisfaction(decision, { ...evidence, capture_mode: "manual_paste" }), "unknown");
  assert.equal(
    activationConditionSatisfaction(decision, { ...evidence, capture_mode: "manual_paste", evidence_ref_id: "er_exact" }),
    "satisfied",
  );
});

test("a deployment without revision mapping remains partial", () => {
  assert.equal(activationConditionSatisfaction(decision, { ...evidence, revision: undefined }), "partial");
});

test("an exact captured reference can be the stable locator for manual evidence", () => {
  assert.equal(
    activationConditionSatisfaction(decision, {
      ...evidence,
      external_id: undefined,
      href: undefined,
      evidence_ref_id: "er_exact",
      capture_mode: "manual_upload",
    }),
    "satisfied",
  );
});

test("candidate selection is shared and keeps a newer observation visible", () => {
  const satisfied = { ...evidence, id: "ae_satisfied" };
  const newerPartial = {
    ...evidence,
    id: "ae_newer_partial",
    environment: "staging",
  };
  assert.equal(
    selectActivationCandidate(decision, [satisfied, newerPartial])?.id,
    "ae_newer_partial",
  );
  assert.equal(
    selectActivationCandidate(decision, [
      { ...satisfied, prov: "human_verified" },
      newerPartial,
    ])?.id,
    "ae_newer_partial",
  );
});

test("candidate selection excludes an append-only dismissed observation", () => {
  const dismissed = { ...evidence, id: "ae_dismissed", disposition: "dismissed" };
  const open = { ...evidence, id: "ae_open", observed_at: "2026-08-13T11:00:00Z" };
  assert.equal(selectActivationCandidate(decision, [open, dismissed])?.id, "ae_open");
});

test("runtime observation construction always begins as an agent candidate", () => {
  const candidate = asActivationCandidate({
    ...evidence,
    id: "ae_runtime",
    recorded_by: "pe_authority",
    prov: "human_verified",
  });
  assert.equal(candidate.recorded_by, "agent");
  assert.equal(candidate.prov, "ai_generated");
});

test("observation type derives the evidence kind instead of borrowing the requirement kind", () => {
  assert.equal(activationEvidenceKindForObservation("code_change", "deployment"), "merge");
  assert.equal(activationEvidenceKindForObservation("deployment_receipt", "merge"), "deployment");
  assert.equal(activationEvidenceKindForObservation("product_state", "deployment"), "deployment");
  assert.equal(activationEvidenceKindForObservation("product_state", "merge"), "other");
});

test("source semantics keep code review and explanatory media separate from downstream proof", () => {
  assert.equal(activationSourceSupportsObservation("github", "merge", "code_change"), true);
  assert.equal(activationSourceSupportsObservation("github", "deployment", "deployment_receipt"), false);
  assert.equal(activationSourceSupportsObservation("loom", "deployment", "product_state"), false);
  assert.equal(activationSourceSupportsObservation("file", "deployment", "product_state"), true);
  assert.equal(activationSourceSupportsObservation("audit", "policy_change", "policy_state"), true);
});
