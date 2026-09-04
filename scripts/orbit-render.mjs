// Renders a layout on a fixture as an SVG in the field's grammar, so a candidate can be LOOKED at, not only scored.
//   node scripts/orbit-render.mjs components/orbit-layout.ts scripts/orbit-fixtures/team.json out.svg
//   node scripts/shot.mjs file://$PWD/out.svg out.png   → then open the PNG
import fs from "node:fs"; import path from "node:path";
const [cand, fx, out] = process.argv.slice(2);
const f = JSON.parse(fs.readFileSync(fx, "utf8"));
const { orbitLayout } = await import(path.resolve(cand));
const GEOM = { W: 520, H: 400, INNER: { rx: 108, ry: 76 }, OUTER: { rx: 200, ry: 134 } };
const r0 = orbitLayout(f.nodes, f.edges, GEOM); const pos = r0 instanceof Map ? r0 : new Map(Object.entries(r0));
const hue = ["#7b5c8a", "#b08a3a", "#4f8a7a", "#5a6fa8", "#a85a5a", "#6a8a4a"]; const colHue = new Map(f.nodes.filter((n) => ringOf(n) === 1).map((n, i) => [n.id, hue[i % hue.length]]));
const radius = (n) => (n.depth === 0 ? 8.5 : n.depth === 2 ? 4 : 6);
const ringOf = (n) => (n.depth === 0 ? 0 : n.kind === "collection" ? 1 : 2);
const clip = (s, n = 17) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 520 400" width="1040" height="800" style="background:#f3f2ee;font-family:Inter,system-ui,sans-serif">`;
for (const e of f.edges) { const a = pos.get(e.from), b = pos.get(e.to); if (!a || !b) continue; const col = f.nodes.find((n) => n.id === e.to && ringOf(n) === 1) || f.nodes.find((n) => n.id === e.from && ringOf(n) === 1); svg += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" stroke="${col ? colHue.get(col.id) : "#8a8a84"}" stroke-opacity="0.55" stroke-width="1.1"/>`; }
for (const n of f.nodes) { const p = pos.get(n.id); if (!p) continue; const r = radius(n); const fill = n.depth === 0 ? "#3a3a36" : ringOf(n) === 1 ? colHue.get(n.id) : (colHue.get(f.edges.find((e) => e.from === n.id)?.to) ?? "#9a9a94");
  svg += ringOf(n) === 2 ? `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${fill}"/>` : `<rect x="${p.x - r}" y="${p.y - r}" width="${2 * r}" height="${2 * r}" rx="${r * 0.2}" fill="${fill}"/>`;
  if (n.label) svg += `<text x="${p.x}" y="${p.y + r + 13}" text-anchor="middle" font-size="${n.depth === 0 ? 12 : 10.5}" font-weight="${n.depth === 0 ? 500 : 400}" fill="#2a2a26">${clip(n.label).replace(/&/g, "&amp;").replace(/</g, "&lt;")}</text>`; }
svg += `</svg>`; fs.writeFileSync(out, svg); console.log("wrote", out);
