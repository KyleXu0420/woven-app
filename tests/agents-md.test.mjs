// Guards the hand-off manual. Codex reads AGENTS.md into its context up to project_doc_max_bytes (32,768 by
// default, shared across the AGENTS.md chain) and cuts it silently at a byte offset, so the budget is checked in
// bytes, not characters. The budget here is 28,000, which leaves room for a nested AGENTS.md. The manual
// sends agents to docs/ on demand, so a path it names that does not exist is a dead end the agent cannot see.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const BUDGET_BYTES = 28000;
const PATH_ROOTS = ["app/", "components/", "lib/", "scripts/", "tests/", "docs/", "hooks/", "public/", ".claude/"];
const FILE_NAME = /^[\w-][\w.-]*\.(tsx?|mjs|css|md|json)$/;
const SKIP_DIRS = new Set(["node_modules", ".next", ".git", ".vercel"]);

function repoFiles(dir = ROOT, found = new Set()) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) repoFiles(path, found);
    else found.add(name);
  }
  return found;
}

// A glob such as tests/*.test.mjs passes when its directory holds at least one file that matches.
function globMatches(token) {
  const slash = token.lastIndexOf("/");
  const dir = join(ROOT, token.slice(0, slash));
  if (!existsSync(dir)) return false;
  const pattern = new RegExp(`^${token.slice(slash + 1).replace(/[.]/g, "\\.").replace(/\*/g, ".*")}$`);
  return readdirSync(dir).some((name) => pattern.test(name));
}

// Paths in the prose sit in code spans, and in the shell block as bare tokens. A trailing :69 is a line number.
function namedPaths(markdown) {
  const fenced = [...markdown.matchAll(/^```[^\n]*\n([\s\S]*?)^```/gm)].map((m) => m[1].replace(/#.*$/gm, ""));
  const prose = markdown.replace(/^```[^\n]*\n[\s\S]*?^```/gm, "");
  const spans = [...prose.matchAll(/`([^`\n]+)`/g)].map((m) => m[1]);
  const tokens = [...spans, ...fenced].flatMap((text) => text.split(/\s+/));
  return tokens.map((token) => token.replace(/[:,;.]+$/, "").replace(/:\d+(-\d+)?$/, "").replace(/#.*$/, "")).filter(Boolean);
}

test("AGENTS.md fits the agent's byte budget", () => {
  const bytes = readFileSync(join(ROOT, "AGENTS.md")).byteLength;
  assert.ok(bytes <= BUDGET_BYTES, `AGENTS.md is ${bytes} bytes, over the ${BUDGET_BYTES} byte budget`);
});

test("every repo path AGENTS.md names exists", () => {
  const files = repoFiles();
  const missing = [];
  let checked = 0;
  for (const token of namedPaths(readFileSync(join(ROOT, "AGENTS.md"), "utf8"))) {
    if (PATH_ROOTS.some((root) => token.startsWith(root))) {
      checked += 1;
      if (!(token.includes("*") ? globMatches(token) : existsSync(join(ROOT, token)))) missing.push(token);
    } else if (FILE_NAME.test(token)) {
      checked += 1;
      if (!files.has(token) && !existsSync(join(ROOT, token))) missing.push(token);
    }
  }
  assert.ok(checked > 20, `only ${checked} paths were found, so the parser is probably broken`);
  assert.deepEqual(missing, []);
});

test("every relative link in docs/README.md exists", () => {
  const readme = readFileSync(join(ROOT, "docs/README.md"), "utf8");
  const links = [...readme.matchAll(/\]\(([^)\s]+)\)/g)].map((m) => m[1]).filter((href) => !/^[a-z]+:/.test(href));
  assert.ok(links.length > 5, `only ${links.length} links were found, so the parser is probably broken`);
  const missing = links.filter((href) => !existsSync(join(ROOT, "docs", href.replace(/#.*$/, ""))));
  assert.deepEqual(missing, []);
});
