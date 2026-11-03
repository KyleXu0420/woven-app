import assert from "node:assert/strict";
import test from "node:test";
import {
  VIEWER,
  answerQuery,
  confirmActivationEvidence,
  decisionRecord,
  decisionState,
  decisionTruth,
  evidenceRefById,
  getArtifact,
  listDecisionActions,
  listDecisionRecords,
  reviewPacket,
} from "../lib/api.ts";

const STATES = {
  de_digest: "needs_approval",
  de_sms: "waiting_activation",
  de_embargo: "in_effect",
  de_cadence: "needs_revalidation",
  de_sms_v1: "superseded",
};

// API reads expose live records in this prototype. Vary one fixture field only inside a synchronous
// test and always restore it; no test imports the seed or introduces a production mutation bypass.
function withField(record, key, value, check) {
  assert.ok(record, "the fixture record must exist");
  const previous = record[key];
  record[key] = value;
  try {
    check();
  } finally {
    record[key] = previous;
  }
}

test("all five seeded Decision states remain available to recall and static route enumeration", () => {
  const records = listDecisionRecords();
  assert.deepEqual(records.map(({ decision }) => decision.id).sort(), Object.keys(STATES).sort());
  for (const [id, state] of Object.entries(STATES)) {
    const record = decisionRecord(id);
    assert.equal(record?.decision.id, id);
    assert.equal(record.state, state);
    assert.equal(decisionState(id), state);
  }
  assert.equal(decisionRecord("de_does_not_exist"), undefined);
});

test("legacy observations without snapshots preserve the Decision but cannot claim exact activation proof", () => {
  for (const id of ["de_sms", "de_cadence"]) {
    const record = decisionRecord(id);
    const truth = decisionTruth(id);
    assert.ok(record.activation.length > 0, "history remains available");
    assert.equal(truth.state, STATES[id]);
    assert.equal(truth.verification, "verified");
    assert.equal(truth.authorization, "approved");
    assert.equal(truth.activation, "candidate");
    assert.equal(truth.hedged, true);
    const proof = truth.cites.find((cite) => cite.activation_evidence_id);
    assert.equal(proof?.trust, "unavailable");
    assert.equal(proof.href, undefined);
    assert.equal(proof.evidence_ref_id, undefined);
  }
  assert.equal(decisionTruth("de_cadence").freshness, "changed");
  assert.equal(decisionRecord("de_cadence").activation.find((item) => item.id === "ae_cadence_production").prov, "human_verified");
});

test("visible confirmed proof keeps its exact version and four independent truth axes", () => {
  const truth = decisionTruth("de_embargo");
  assert.equal(truth.state, "in_effect");
  assert.equal(truth.verification, "verified");
  assert.equal(truth.authorization, "approved");
  assert.equal(truth.activation, "confirmed");
  assert.equal(truth.freshness, "current");
  assert.equal(truth.hedged, false);
  const proof = truth.cites.find((cite) => cite.activation_evidence_id);
  assert.equal(proof.trust, "verified");
  assert.equal(proof.href, "/artifact/a_launch_calendar_state/version/v4#b_launch_calendar_state");
});

test("restricted activation proof is redacted per viewer without losing confirmation history or leaking its ref", () => {
  withField(getArtifact("a_launch_calendar_state"), "space_id", "sp_leadership", () => {
    const record = decisionRecord("de_embargo", VIEWER);
    const observation = record.activation.find((item) => item.id === "ae_embargo_publish");
    assert.equal(record.state, "in_effect", "permission does not rewrite canonical lifecycle history");
    assert.equal(observation.prov, "human_verified");
    assert.equal(observation.evidence_ref_id, undefined);

    const truth = decisionTruth("de_embargo", VIEWER);
    const proof = truth.cites.find((cite) => cite.activation_evidence_id === observation.id);
    assert.equal(truth.activation, "confirmed");
    assert.equal(truth.hedged, true, "the answer cannot assert current truth without reachable proof");
    assert.equal(proof.trust, "unavailable");
    assert.equal(proof.href, undefined);
    assert.equal(proof.evidence_ref_id, undefined, "confirmed selection must not reintroduce the raw hidden ref");

    const allowedRecord = decisionRecord("de_embargo", "pe_theo");
    assert.equal(allowedRecord.activation[0].evidence_ref_id, "er_embargo_publish_state");
    const allowedTruth = decisionTruth("de_embargo", "pe_theo");
    assert.equal(allowedTruth.hedged, false, "redaction must not mutate the canonical observation");
    assert.equal(allowedTruth.cites.find((cite) => cite.activation_evidence_id).trust, "verified");
  });
});

test("a dangling activation reference degrades only that observation and cannot keep the Decision in effect", () => {
  withField(evidenceRefById("er_embargo_publish_state"), "id", "er_test_missing_activation", () => {
    const record = decisionRecord("de_embargo");
    assert.ok(record);
    assert.equal(record.activation[0].id, "ae_embargo_publish");
    assert.equal(record.activation[0].evidence_ref_id, undefined);
    assert.notEqual(record.state, "in_effect");
  });
  assert.equal(decisionRecord("de_embargo").activation[0].evidence_ref_id, "er_embargo_publish_state");
});

test("the Decision's own visibility and supporting-evidence access gates still fail closed", () => {
  withField(getArtifact("a_notif"), "space_id", "sp_leadership", () => {
    assert.equal(decisionRecord("de_sms", VIEWER), undefined);
    assert.equal(decisionTruth("de_sms", VIEWER), undefined);
    assert.equal(reviewPacket("de_sms", VIEWER), undefined);
    assert.ok(decisionRecord("de_sms", "pe_theo"));
  });
  withField(evidenceRefById("er_notif_sms"), "artifact_id", "a_comp", () => {
    assert.equal(decisionRecord("de_sms", VIEWER), undefined);
  });
  withField(evidenceRefById("er_notif_sms"), "id", "er_test_missing_decision", () => {
    assert.equal(decisionRecord("de_sms", VIEWER), undefined);
  });
});

test("focused review, scoped Ask and the actionable queue share the recovered Decision identities", () => {
  for (const id of Object.keys(STATES)) {
    const truth = decisionTruth(id);
    const packet = reviewPacket(id);
    const answer = answerQuery("What is the current status?", { centerId: id });
    assert.equal(packet.record.decision.id, id);
    assert.deepEqual(packet.current_truth, truth);
    assert.equal(answer.mode, "decision");
    assert.equal(answer.centerId, id);
    assert.equal(answer.answer, truth.answer);
    assert.deepEqual(answer.cites, truth.cites);
    for (const { href } of packet.evidence) {
      if (href) assert.match(href, /^\/artifact\/[^/]+\/version\//);
    }
  }
  assert.deepEqual(
    listDecisionActions().map(({ decision_id, kind }) => [decision_id, kind]),
    [["de_cadence", "revalidate"], ["de_sms", "confirm_activation"], ["de_digest", "approve"]],
  );
});

test("making legacy observations readable does not make them confirmable", () => {
  const before = decisionRecord("de_sms");
  assert.equal(confirmActivationEvidence("ae_sms_merge", "confirm"), undefined);
  assert.equal(confirmActivationEvidence("ae_cadence_production", "confirm"), undefined);
  assert.equal(decisionState("de_sms"), "waiting_activation");
  assert.deepEqual(decisionRecord("de_sms").activation_dispositions, before.activation_dispositions);
});
