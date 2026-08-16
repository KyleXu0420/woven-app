#!/usr/bin/env node
// The lint tier, made mechanical.
//
// AGENTS.md tiers its rules, and ~50 of them are marked "lint — mechanical; enforce every time, no
// judgment". Nothing enforced them: eslint.config.mjs is stock. A rule that claims to be mechanical
// and is not checked trains everyone to distrust the tier, which is how the doctrine layer drifted
// from describing the code to describing the intention.
//
// This is deliberately a grep, not a plugin. Tailwind v4 arbitrary values have no dependable
// off-the-shelf rule, and a hundred honest lines beat a plugin that half-matches.
//
//   node scripts/check-design-rules.mjs           # error on `error` rules, report `warn`
//   node scripts/check-design-rules.mjs --all     # treat warn as error too (post-codemod)
//
// Exemptions are NAMED, with the reason. An unexplained exemption is a hole.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const ROOTS = ["app", "components", "lib"];
const STRICT = process.argv.includes("--all");

const RULES = [
  {
    id: "no-raw-hex",
    level: "error",
    re: /#[0-9a-fA-F]{3,8}\b/,
    why: "colour comes from a token, never a literal",
    exempt: (f) =>
      // computed art: per-artifact SVG luminance washes, not a UI surface
      f === "components/cover-art.tsx" ||
      // a standalone exported HTML document — it is read outside the app and cannot reach a token
      f === "lib/export.ts" ||
      // seed CONTENT, not styling ("PR #184" is an external id that looks like a hex triplet)
      f === "lib/data.ts" ||
      // documented fallback for when getComputedStyle returns empty on a detached canvas
      f === "components/weave-backdrop.tsx",
  },
  {
    id: "no-pure-black-white",
    level: "error",
    re: /\b(?:bg|text|border|fill|stroke)-(?:white|black)\b/,
    why: "the ramp is warm paper and warm charcoal; pure #fff/#000 belongs to neither",
    exempt: (f) =>
      // type set OVER a generated cover image — white reads against the art, not against a theme
      f === "components/cover-art.tsx" ||
      // a modal scrim is black-alpha in both themes by convention; it dims, it is not a surface
      f === "components/ui/dialog.tsx" ||
      f === "components/ui/sheet.tsx",
  },
  {
    id: "no-palette-colour",
    level: "error",
    re: /\b(?:bg|text|border|ring|fill|stroke|from|to|via)-(?:gray|slate|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/,
    why: "Tailwind's palette is not Woven's palette",
  },
  {
    id: "weight-cap-400-500",
    level: "error",
    re: /\bfont-(?:semibold|bold|extrabold|black|light|thin)\b|\bfont-\[\d+\]/,
    why: "AGENTS.md:128 — emphasis by SIZE, never a 600/700 weight",
  },
  {
    id: "no-fractional-px",
    // every remaining site is inside a line-A file; flip to error once line A lands
    level: "warn",
    re: /\[\d+\.\d+px\]/,
    why: "AGENTS.md:128 — no fractional px (15.5 -> 15)",
  },
  {
    id: "off-scale-box",
    // AGENTS.md:136 governs icon BUTTONS; grep cannot see whether a size-[Npx] sits on a <button>.
    // All four current sites are checkbox/tick SHAPES at 18px, off the named 16/20/24 glyph scale —
    // real, but a visual decision rather than cleanup, so it reports instead of blocking.
    level: "warn",
    re: /\bsize-\[\d+px\]/,
    why: "off the 16/20/24 glyph scale (AGENTS.md:136)",
  },
  {
    id: "no-unnamed-text-size",
    // warn until line A lands and the remaining ~239 sites can be migrated
    level: "warn",
    re: /\btext-\[\d+(?:\.\d+)?px\]/,
    why: "the type ladder is text-xs/sm/base/lg/xl/2xl/3xl/4xl",
    // a monogram is a MARK sized against a shape, like an icon — not text on the reading scale.
    // Folding it would re-crowd the documented 0.42-0.45 ratio in identity.tsx.
    exempt: (f) => f === "components/identity.tsx",
  },
  {
    id: "no-unnamed-radius",
    level: "warn",
    re: /\brounded-\[\d+px\]/,
    why: "the radius ladder is sm 4 (mark) / md 10 (control) / lg 16 (surface) / rounded-full (shape)",
    // entity-profile encodes entity KIND in the corner; tooltip's arrow is a rotated needle tip that
    // 4px would blunt. Both are shapes carrying meaning, not surfaces picking a rung.
    exempt: (f) => f === "components/entity-profile.tsx" || f === "components/ui/tooltip.tsx",
  },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name)) out.push(p);
  }
  return out;
}

const files = ROOTS.flatMap((r) => {
  try { return walk(join(ROOT, r)); } catch { return []; }
});

const findings = [];
for (const abs of files) {
  const f = relative(ROOT, abs);
  // globals.css IS the token layer — it is where the literals are supposed to live
  const isTokenSource = f === "app/globals.css";
  const lines = readFileSync(abs, "utf8").split("\n");
  lines.forEach((line, i) => {
    // a rule cannot be violated by the comment explaining the rule
    const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
    for (const rule of RULES) {
      if (isTokenSource && rule.id === "no-raw-hex") continue;
      if (rule.exempt?.(f)) continue;
      if (rule.re.test(code)) {
        findings.push({ rule, file: f, line: i + 1, text: line.trim().slice(0, 110) });
      }
    }
  });
}

const errors = findings.filter((x) => x.rule.level === "error" || STRICT);
const warns = findings.filter((x) => x.rule.level === "warn" && !STRICT);

const byRule = (list) => {
  const m = new Map();
  for (const x of list) (m.get(x.rule.id) ?? m.set(x.rule.id, []).get(x.rule.id)).push(x);
  return m;
};

for (const [id, list] of byRule(warns)) {
  console.log(`\n  warn  ${id} — ${list[0].rule.why}  (${list.length})`);
  for (const x of list.slice(0, 3)) console.log(`        ${x.file}:${x.line}`);
  if (list.length > 3) console.log(`        … and ${list.length - 3} more`);
}

for (const [id, list] of byRule(errors)) {
  console.log(`\n  ERROR ${id} — ${list[0].rule.why}  (${list.length})`);
  for (const x of list) console.log(`        ${x.file}:${x.line}  ${x.text}`);
}

console.log(
  `\n${files.length} files · ${errors.length} error · ${warns.length} warn` +
    (STRICT ? " · --all (warn treated as error)" : ""),
);
process.exit(errors.length ? 1 : 0);
