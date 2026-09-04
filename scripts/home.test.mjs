import assert from "node:assert/strict";
import test from "node:test";
// node --test scripts/home.test.mjs — the home page's pure decisions (lib/home.ts), the string rules and the away window.
// Lives beside the orbit bench: tests/ is the other line's directory.
import { KIND, needsSummary, pickHeroId, rankNeeds, ruleSentence, agentDigest } from "../lib/home.ts";
import { nameList, houseSeparators, plural } from "../lib/text.ts";
import { windowLabel, windowMinutes } from "../lib/last-seen.ts";

const need = (kind, id, href = `/inbox#${id}`) => ({ id, kind, title: id, sub: "", href, action: "Review" });
const run = (id, status, extra = {}) => ({ id, kind: "link", title: `Did ${id}`, status, at: "1h", ...extra });

test("the hero doc's staleness is absorbed, never the nudge, but stays counted", () => {
  const needs = [need("stale", "s1", "/artifact/a_notif"), need("approval", "d1"), need("proposal", "p1")];
  const { ranked, absorbed } = rankNeeds(needs, [], "a_notif");
  assert.equal(absorbed.length, 1);
  assert.deepEqual(ranked.map((n) => n.id), ["d1", "p1"]);
  const s = needsSummary(needs, [], "a_notif", 3);
  assert.equal(s.top.id, "d1");
  assert.equal(1 + s.more, 3, "1 shown + N more is the badge");
  assert.equal(s.breakdown, "1 stale doc, 1 link proposal to verify");
});

test("the breakdown is printed only when the kinds add up to N", () => {
  const needs = [need("approval", "d1"), need("capture", "c1")];
  assert.equal(needsSummary(needs, [], "x", 2).breakdown, "1 capture review");
  assert.equal(needsSummary(needs, [], "x", 5).breakdown, "", "a badge the page cannot account for prints no breakdown");
  assert.equal(needsSummary(needs, [], "x", 5).more, 4, "but N still reconciles with the badge");
});

test("runs blocked on the viewer join the queue below people's edits", () => {
  const { ranked } = rankNeeds([need("capture", "c1"), need("candidate", "e1")], [run("r1", "needs_you"), run("r2", "done")], "x");
  assert.deepEqual(ranked.map((n) => n.kind), ["candidate", "run", "capture"]);
});

test("equal weights keep the queue's own order", () => {
  const { ranked } = rankNeeds([need("approval", "a"), need("candidate", "b"), need("approval", "c")], [], "x");
  assert.deepEqual(ranked.map((n) => n.id), ["a", "b", "c"]);
});

test("the printed rule is generated from the table, in weight order", () => {
  const s = ruleSentence();
  assert.equal(s, "Re-checks first, then stale docs, then people's edits and approvals, then proofs to add, then the agent, then drops to review.");
  const order = Object.keys(KIND).sort((a, b) => KIND[a].weight - KIND[b].weight);
  assert.equal(order[0], "revalidation");
  assert.equal(needsSummary([], [], "x", 1).rule, undefined, "one item needs no rule");
});

test("the hero is the first artifact in the recents, else the seed", () => {
  assert.equal(pickHeroId([{ id: "p1", kind: "person" }, { id: "a2", kind: "artifact" }]), "a2");
  assert.equal(pickHeroId([]), "a_notif");
});

test("the agent digest names n objects and counts the autonomous ones", () => {
  const done = [run("a", "done", { title: "Wove X" }), run("b", "done", { title: "Filed Y", ruleId: "r" }), run("c", "done", { title: "Noted Z" })];
  assert.deepEqual(agentDigest(done, 2), { objects: "wove X, filed Y and 1 more", own: "1 of them on its own" });
  assert.deepEqual(agentDigest(done, 1).objects, "wove X and 2 more");
  assert.equal(agentDigest([], 2), null);
});

test("string rules", () => {
  assert.equal(nameList(["Ana"]), "Ana");
  assert.equal(nameList(["Ana", "Theo"]), "Ana and Theo");
  assert.equal(nameList(["Ana", "Theo"], 4), "Ana, Theo and 4 others");
  assert.equal(houseSeparators("a · b·c"), "a, b, c");
  assert.equal(plural(1, "run", "runs"), "1 run");
});

test("the away window", () => {
  const now = new Date("2026-09-03T10:00:00");
  assert.equal(windowMinutes(null, now), 1440);
  assert.equal(windowLabel(null, now), "the last 24 hours");
  assert.equal(windowMinutes(new Date("2026-09-03T09:30:00"), now), 30);
  assert.match(windowLabel(new Date("2026-09-02T18:40:00"), now), /^since 18:40 yesterday$/);
  assert.match(windowLabel(new Date("2026-08-27T09:00:00"), now), /7 days away$/);
});
