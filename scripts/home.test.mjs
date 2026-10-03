import assert from "node:assert/strict";
import test from "node:test";
// node --test scripts/home.test.mjs — the home page's pure decisions (lib/home.ts), the string rules and the away window.
// Lives beside the orbit bench: tests/ is the other line's directory.
import { KIND, needsSummary, pickHeroId, rankNeeds, ruleSentence, agentSentences, agentNowSentences, teamSentences } from "../lib/home.ts";
import { nameList, houseSeparators, plural } from "../lib/text.ts";
import { markSeen, readWindow, windowLabel, windowMinutes } from "../lib/last-seen.ts";

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

// The digest's sentence builders (orient.tsx renders them). A Sentence is (string | number)[]: a number is a count
// the sentence reports (full ink at 500 on the page), a string is prose. The rules the page depends on:
// one fact per sentence, every count carried as a number (never folded into the prose), and the builders' own
// words never write the middle dot or the em dash. Titles here are plain on purpose, so any dot or dash found
// in the output is the builder's.
const text = (s) => s.join("");
const numbers = (s) => s.filter((p) => typeof p === "number");
// one fact = one sentence: capitalised (or a count), one terminal period, no clause joined on with a dash, a
// semicolon or a second sentence inside it
function assertOneFact(s) {
  const t = text(s);
  assert.match(t, /^([A-Z]|\d)/, `opens a sentence: ${t}`);
  assert.match(t, /\.$/, `ends on its period: ${t}`);
  assert.equal((t.match(/\.(\s|$)/g) || []).length, 1, `one sentence, not two: ${t}`);
  assert.doesNotMatch(t, /[;\u2014\u2013]|\s-\s/, `no clause tacked on: ${t}`);
}
function assertHouseCopy(sentences) {
  for (const s of sentences) {
    assert.doesNotMatch(text(s), /\u00b7/, `no middle dot: ${text(s)}`);
    assert.doesNotMatch(text(s), /\u2014/, `no em dash: ${text(s)}`);
  }
}

test("agentSentences: the count leads, autonomy counts against it, then the named runs, one fact each", () => {
  const done = [
    run("a", "done", { title: "Wove the audit into the strategy", ruleId: "r1" }),
    run("b", "done", { title: "Noted Maya on the outreach plan." }),
    run("c", "done", { title: "Filed the deck", ruleId: "r2" }),
    run("d", "done"),
    run("e", "done"),
    run("f", "done"),
  ];
  const out = agentSentences(done, 2);
  assert.deepEqual(out, [
    ["Woven finished ", 6, " runs."],
    ["It did ", 2, " of them on its own."],
    ["It wove the audit into the strategy."],
    ["It noted Maya on the outreach plan."], // the title's own period is not doubled
  ]);
  out.forEach(assertOneFact);
  assertHouseCopy(out);
  assert.deepEqual(numbers(out[0]), [6], "the total is a count, carried as a number");
  assert.deepEqual(numbers(out[1]), [2], "the autonomy is a count against the total, not against the unnamed runs");
  assert.equal(out.length, 2 + 2, "n names exactly n runs");
});

test("agentSentences: the autonomy sentence's branches, and nothing for an empty window", () => {
  const own = (id) => run(id, "done", { title: `Filed ${id}`, ruleId: "r" });
  assert.deepEqual(agentSentences([own("a"), own("b"), own("c")], 0), [["Woven finished ", 3, " runs."], ["It did all ", 3, " on its own."]]);
  assert.deepEqual(agentSentences([own("a")], 0), [["Woven finished ", 1, " run."], ["It did it on its own."]]);
  assert.deepEqual(agentSentences([run("a", "done")], 0), [["Woven finished ", 1, " run."]], "no autonomy, no sentence about it");
  assert.deepEqual(agentSentences([], 2), []);
  for (const s of agentSentences([own("a"), own("b"), run("c", "done")], 3)) assertOneFact(s);
});

test("agentNowSentences: one sentence per running run, then one per failed run", () => {
  const out = agentNowSentences([run("r1", "running", { title: "Linking the pricing notes" })], [run("f1", "failed", { title: "Couldn't parse the transcript", at: "2h" })]);
  assert.deepEqual(out, [["Linking the pricing notes now."], ["Couldn't parse the transcript 2h ago, will retry."]]);
  out.forEach(assertOneFact);
  assertHouseCopy(out);
  assert.deepEqual(agentNowSentences([], []), []);
});

test("teamSentences: who moved what, then who the team waits on, the counts carried as numbers", () => {
  const out = teamSentences(["Ana", "Theo"], 4, 8, 7, { n: 4, name: "Jordan" });
  assert.deepEqual(out, [
    ["Ana, Theo and 4 others", " made ", 8, " changes across ", 7, " docs."],
    [4, " pending changes are waiting on ", "Jordan."],
  ]);
  out.forEach(assertOneFact);
  assertHouseCopy(out);
  assert.deepEqual(numbers(out[0]), [8, 7], "the 4 in 'and 4 others' is part of WHO and stays prose");
  assert.deepEqual(numbers(out[1]), [4]);
  assert.match(text(out[1]), /pending changes/, "the second sentence names its own noun");
  assert.deepEqual(teamSentences(["Ana"], 0, 1, 1, { n: 1, name: "Jo" }), [["Ana", " made ", 1, " change across ", 1, " doc."], [1, " pending change is waiting on ", "Jo."]]);
  assert.equal(teamSentences([], 4, 2, 2)[0][0], "4 people", "no name to print is a count of people, never a sentence opening on ' and'");
  assert.equal(teamSentences([], 1, 2, 2)[0][0], "1 person");
  assert.equal(teamSentences(["Ana"], 0, 3, 2).length, 1, "no one waited on, no second sentence");
  assert.deepEqual(teamSentences(["Ana"], 0, 0, 0), [], "no changes, no row");
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

test("away is a session gap, not a page change", () => {
  const mem = new Map();
  const store = { get: (k) => mem.get(k) ?? null, set: (k, v) => mem.set(k, v) };
  const t = (h, m = 0) => new Date(2026, 8, 4, h, m);
  assert.equal(readWindow(t(10), store), null, "first visit");
  markSeen(t(10, 5), store); // left at 10:05 …
  assert.equal(readWindow(t(10, 7), store)?.getTime(), t(10, 5).getTime(), "… back at 10:07 with no earlier session: the stamp itself");
  markSeen(new Date(2026, 8, 3, 18, 40), store); // yesterday evening's leave
  assert.equal(readWindow(t(9), store)?.getTime(), new Date(2026, 8, 3, 18, 40).getTime(), "a new session opens on last night's stamp");
  markSeen(t(9, 20), store); // opened the Inbox and came back
  assert.equal(readWindow(t(9, 22), store)?.getTime(), new Date(2026, 8, 3, 18, 40).getTime(), "same session: the window holds");
  markSeen(t(9, 30), store);
  assert.equal(readWindow(t(11), store)?.getTime(), t(9, 30).getTime(), "90 minutes later: a new session, the window moves");
});
