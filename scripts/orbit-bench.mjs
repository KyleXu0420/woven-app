// Scores the space field's layout (components/orbit-layout.ts) for the three defects the eye objects to — a spoke
// grazing a mark it does not end at, a spoke through a name, a collection sitting on a person's line to the centre
// (the bead) — plus determinism, ring gaps and bounds, over the fixtures in scripts/orbit-fixtures/.
//   node scripts/orbit-bench.mjs                       the shipped layout, every fixture
//   node scripts/orbit-bench.mjs --verbose             ...listing every hit
//   node scripts/orbit-bench.mjs <other.mjs|.ts>       a candidate (exports orbitLayout(nodes, edges, geom))
//   node scripts/orbit-bench.mjs --json '<fixture>'    one extra fixture inline, same shape as the files
// PASS = zero hard failures and zero hits on every fixture. Node ≥ 23.6 runs the .ts directly (types stripped).
// geom = { W: 520, H: 400, INNER: {rx:108, ry:76}, OUTER: {rx:200, ry:134} }.
// Rings are the design: centre pinned at (W/2,H/2); collections ON the inner ellipse; people ON the outer.
// The candidate chooses ANGLES for both rings — nothing else. Everything below mirrors components/local-graph.tsx.
import fs from "node:fs";
import path from "node:path";
const args = process.argv.slice(2);
const candPath = args.find((a) => /\.(mjs|js|ts)$/.test(a)) ?? path.join(path.dirname(new URL(import.meta.url).pathname), "..", "components", "orbit-layout.ts");
const verbose = args.includes("--verbose");
const inline = args.includes("--json") ? JSON.parse(args[args.indexOf("--json") + 1]) : null;
const fixtureFiles = args.filter((a) => a.endsWith(".json"));
const dir = path.dirname(new URL(import.meta.url).pathname);
const files = fixtureFiles.length ? fixtureFiles : fs.readdirSync(path.join(dir, "orbit-fixtures")).filter((f) => f.endsWith(".json")).sort().map((f) => path.join(dir, "orbit-fixtures", f));
// --random N [--seed S]: N seeded pseudo-random workspaces (1–6 collections, 0–16 people, 0–3 memberships each,
// 4–15-char names) — deterministic, so a failure can be re-run by seed.
const randomN = args.includes("--random") ? +args[args.indexOf("--random") + 1] : 0;
const seed0 = args.includes("--seed") ? +args[args.indexOf("--seed") + 1] : 1;
const lcg = (s) => () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
const randomFixture = (i) => {
  const r = lcg(seed0 * 7919 + i * 104729);
  const k = 1 + Math.floor(r() * 6), np = Math.floor(r() * 17);
  const name = (len) => Array.from({ length: len }, () => "abcdefghijklmnopqrstuvwxyz"[Math.floor(r() * 26)]).join("");
  const cols = Array.from({ length: k }, (_, j) => ({ id: `c${j}`, label: name(4 + Math.floor(r() * 12)), kind: "collection", depth: 1 }));
  const people = Array.from({ length: np }, (_, j) => ({ id: `p${j}`, label: name(4 + Math.floor(r() * 12)), kind: "person", depth: 2 }));
  const edges = cols.map((c) => ({ from: "space", to: c.id }));
  for (const p of people) { const m = Math.floor(r() * 4); const pick = new Set(); for (let q = 0; q < m; q++) pick.add(cols[Math.floor(r() * k)].id); for (const c of pick) edges.push({ from: p.id, to: c }); }
  return { name: `random #${i} (seed ${seed0}: ${k} collections, ${np} people)`, nodes: [{ id: "space", label: name(5 + Math.floor(r() * 10)), kind: "space", depth: 0 }, ...cols, ...people], edges };
};
const fixtures = randomN ? Array.from({ length: randomN }, (_, i) => randomFixture(i)) : [...files.map((f) => JSON.parse(fs.readFileSync(f, "utf8"))), ...(inline ? [inline] : [])];
const { orbitLayout } = await import(path.resolve(candPath));
const { labelBoxAt, chooseLabelSides } = await import(path.join(dir, "..", "components", "orbit-layout.ts"));
const GEOM = { W: 520, H: 400, INNER: { rx: 108, ry: 76 }, OUTER: { rx: 200, ry: 134 } };
const radius = (n) => (n.depth === 0 ? 8.5 : n.depth === 2 ? 4 : 6); // the renderer sizes by depth
const ringOf = (n) => (n.depth === 0 ? 0 : n.kind === "collection" ? 1 : 2); // the layout rings by kind (the live space graph is all depth 1)
// names are scored where the page puts them: each on the side chooseLabelSides picks (the renderer calls the
// same function), with the shared box model
const clipText = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const labelBoxes = (fx, pos) => {
  const rank = (n) => (n.depth === 0 ? 3 : n.kind === "collection" ? 2 : 1);
  const order = [...fx.nodes].filter((n) => n.label).sort((a, b) => rank(b) - rank(a) || a.id.localeCompare(b.id)).map((n) => ({ id: n.id, text: clipText(n.label, n.depth === 0 ? 22 : 16), fs: n.depth === 0 ? 12 : 10.5 }));
  const byId = new Map(fx.nodes.map((n) => [n.id, n]));
  const sides = chooseLabelSides(order, pos, (id) => radius(byId.get(id)), fx.edges, { W: GEOM.W, H: GEOM.H });
  return new Map(order.map((o) => [o.id, labelBoxAt(sides.get(o.id) ?? "below", pos.get(o.id).x, pos.get(o.id).y, radius(byId.get(o.id)), o.text, o.fs)]));
};
const segDist = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l2 = dx * dx + dy * dy; const t = l2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2)) : 0; return { d: Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy)), t }; };
const rectDist = (r, a, b) => { let min = Infinity; for (let k = 0; k <= 60; k++) { const t = k / 60, px = a.x + (b.x - a.x) * t, py = a.y + (b.y - a.y) * t; const dx = Math.max(r.x - px, 0, px - (r.x + r.w)), dy = Math.max(r.y - py, 0, py - (r.y + r.h)); min = Math.min(min, Math.hypot(dx, dy)); } return min; };
const cross = (a, b, c, d) => { const o = (p, q, r) => Math.sign((q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x)); return o(a, b, c) !== o(a, b, d) && o(c, d, a) !== o(c, d, b); };
const MARK_MIN = 14, NAME_MIN = 2, GAP_MIN_DEG = 20; // a ring of n nodes can only promise min(20°, 360/n)
const results = [];
for (const fx of fixtures) {
  const run = () => { const r = orbitLayout(fx.nodes.map((n) => ({ ...n })), fx.edges.map((e) => ({ ...e })), { ...GEOM }); return r instanceof Map ? r : new Map(Object.entries(r)); };
  const pos = run(); const pos2 = run();
  const byId = new Map(fx.nodes.map((n) => [n.id, n]));
  const cx = GEOM.W / 2, cy = GEOM.H / 2;
  const fail = [];
  for (const n of fx.nodes) { if (!pos.has(n.id)) fail.push(`missing ${n.id}`); }
  for (const [id, p] of pos) { const q = pos2.get(id); if (!q || Math.abs(q.x - p.x) > 1e-6 || Math.abs(q.y - p.y) > 1e-6) fail.push(`non-deterministic ${id}`); }
  for (const n of fx.nodes) { const p = pos.get(n.id); if (!p) continue; if (n.depth === 0 && (Math.abs(p.x - cx) > 1e-6 || Math.abs(p.y - cy) > 1e-6)) fail.push("centre not pinned");
    const e = ringOf(n) === 1 ? GEOM.INNER : ringOf(n) === 2 ? GEOM.OUTER : null;
    if (e) { const v = ((p.x - cx) / e.rx) ** 2 + ((p.y - cy) / e.ry) ** 2; if (Math.abs(v - 1) > 0.02) fail.push(`${n.id} off its ring (${v.toFixed(3)})`); }
    if (p.x < 8 || p.x > GEOM.W - 8 || p.y < 8 || p.y > GEOM.H - 8) fail.push(`${n.id} out of bounds`); }
  // angular gaps on each ring
  const gaps = {};
  for (const depth of [1, 2]) { const ring = fx.nodes.filter((n) => ringOf(n) === depth).map((n) => { const p = pos.get(n.id); return Math.atan2((p.y - cy) / (depth === 1 ? GEOM.INNER.ry : GEOM.OUTER.ry), (p.x - cx) / (depth === 1 ? GEOM.INNER.rx : GEOM.OUTER.rx)); }).sort((a, b) => a - b); let min = Infinity; for (let i = 0; i < ring.length; i++) { const d = i === ring.length - 1 ? ring[0] + 2 * Math.PI - ring[i] : ring[i + 1] - ring[i]; min = Math.min(min, d); } gaps[depth] = ring.length > 1 ? (min * 180) / Math.PI : 360; const promise = Math.min(GAP_MIN_DEG, 360 / ring.length) - 1e-3; if (ring.length > 1 && gaps[depth] < promise) fail.push(`ring ${depth} gap ${gaps[depth].toFixed(1)}° < ${promise.toFixed(1)}°`); }
  // clearances: every edge vs every node it does not end at (mark + name), and the bead test
  const edges = fx.edges.map((e) => ({ a: pos.get(e.from), b: pos.get(e.to), from: e.from, to: e.to })).filter((e) => e.a && e.b);
  let markMin = Infinity, nameMin = Infinity, beadMin = Infinity; const markHits = [], nameHits = [], beadHits = [];
  const boxes = labelBoxes(fx, pos);
  for (const e of edges) for (const n of fx.nodes) { if (n.id === e.from || n.id === e.to) continue; const p = pos.get(n.id); if (!p) continue;
    const { d, t } = segDist(p, e.a, e.b); if (t > 0.02 && t < 0.98) { markMin = Math.min(markMin, d); if (d < MARK_MIN) markHits.push(`${e.from}→${e.to} passes ${d.toFixed(1)} from ${n.id}`); }
    if (n.label && boxes.has(n.id)) { const dn = rectDist(boxes.get(n.id), e.a, e.b); nameMin = Math.min(nameMin, dn); if (dn < NAME_MIN) nameHits.push(`${e.from}→${e.to} through the name "${n.label}"`); } }
  for (const e of edges) { const pf = byId.get(e.from), pt = byId.get(e.to); const person = pf && ringOf(pf) === 2 ? e.a : pt && ringOf(pt) === 2 ? e.b : null; const col = pf && ringOf(pf) === 1 ? e.a : pt && ringOf(pt) === 1 ? e.b : null; if (!person || !col) continue; const { d, t } = segDist(col, person, { x: cx, y: cy }); if (t > 0.02 && t < 0.98) { beadMin = Math.min(beadMin, d); if (d < MARK_MIN) beadHits.push(`${e.from}→${e.to}: collection sits ${d.toFixed(1)} from the person→centre line (a bead)`); } }
  let crossings = 0; for (let i = 0; i < edges.length; i++) for (let j = i + 1; j < edges.length; j++) { const e = edges[i], f = edges[j]; if (e.from === f.from || e.from === f.to || e.to === f.from || e.to === f.to) continue; if (cross(e.a, e.b, f.a, f.b)) crossings++; }
  const spokes = edges.filter((e) => ringOf(byId.get(e.from) ?? {}) === 2 || ringOf(byId.get(e.to) ?? {}) === 2).map((e) => Math.hypot(e.a.x - e.b.x, e.a.y - e.b.y));
  const r = { fixture: fx.name, hard: fail, hits: markHits.length + nameHits.length + beadHits.length, markMin: +markMin.toFixed(1), nameMin: +nameMin.toFixed(1), beadMin: +beadMin.toFixed(1), crossings, spokeMax: +Math.max(0, ...spokes).toFixed(0), spokeMean: +(spokes.reduce((a, b) => a + b, 0) / Math.max(1, spokes.length)).toFixed(0), gapInner: +gaps[1].toFixed(1), gapOuter: +gaps[2].toFixed(1), detail: verbose ? [...markHits, ...nameHits, ...beadHits] : undefined };
  results.push(r);
}
const pass = results.every((r) => r.hard.length === 0 && r.hits === 0);
const score = results.reduce((s, r) => s + Math.min(r.markMin, r.nameMin + 12, r.beadMin), 0) / results.length;
if (randomN) { const bad = results.filter((r) => r.hard.length || r.hits); console.log(JSON.stringify({ candidate: path.basename(candPath), random: randomN, seed: seed0, failing: bad.length, rate: +(bad.length / randomN).toFixed(3), meanClearance: +score.toFixed(1), worst: bad.slice(0, 8).map((r) => `${r.fixture}: ${r.hard.join("; ") || ""} ${r.hits} hits (mark ${r.markMin} name ${r.nameMin} bead ${r.beadMin})`) }, null, 1)); process.exit(0); }
console.log(JSON.stringify({ candidate: path.basename(candPath), PASS: pass, meanClearance: +score.toFixed(1), totalHits: results.reduce((s, r) => s + r.hits, 0), totalCrossings: results.reduce((s, r) => s + r.crossings, 0), results }, null, verbose ? 1 : 0));
