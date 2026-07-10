// Format-agnostic document diff. Woven normalizes every artifact — HTML, Markdown, PDF, DOC — into the
// same Block[] (heading + text), so ONE block-level diff covers all of them: we diff the normalized
// document, never the raw file. Two passes: block-level (added / removed / modified / unchanged, aligned
// by an LCS over block ids), then a word-level diff inside each modified block.

import type { Block } from "@/lib/types";

export type WordOp = { op: "keep" | "del" | "ins"; text: string };

// word-level diff via LCS. Tokens keep their trailing whitespace so the text reassembles losslessly.
export function diffWords(before: string, after: string): WordOp[] {
  const a = before.match(/\S+\s*/g) ?? [];
  const b = after.match(/\S+\s*/g) ?? [];
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops: WordOp[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      ops.push({ op: "keep", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ op: "del", text: a[i] });
      i++;
    } else {
      ops.push({ op: "ins", text: b[j] });
      j++;
    }
  }
  while (i < n) ops.push({ op: "del", text: a[i++] });
  while (j < m) ops.push({ op: "ins", text: b[j++] });
  // coalesce runs of the same op so the render is a handful of spans, not one per word
  const out: WordOp[] = [];
  for (const o of ops) {
    const last = out[out.length - 1];
    if (last && last.op === o.op) last.text += o.text;
    else out.push({ ...o });
  }
  return out;
}

export type BlockStatus = "added" | "removed" | "modified" | "unchanged";
export type BlockChange = {
  status: BlockStatus;
  block: Block; // the "after" block — or, for "removed", the block as it last existed
  words?: WordOp[]; // present for "modified": the word diff of the body text
  headingChanged?: boolean;
};

// block-level diff, aligned by an LCS over block ids so unchanged anchors stay put and an inserted or
// removed section lands in its real position (not shoved to the end).
export function diffBlocks(before: Block[], after: Block[]): BlockChange[] {
  const aIds = before.map((b) => b.id);
  const bIds = after.map((b) => b.id);
  const beforeById = new Map(before.map((b) => [b.id, b]));
  const afterById = new Map(after.map((b) => [b.id, b]));
  const n = aIds.length;
  const m = bIds.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = aIds[i] === bIds[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: BlockChange[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (aIds[i] === bIds[j]) {
      const prev = beforeById.get(aIds[i])!;
      const cur = afterById.get(bIds[j])!;
      const headingChanged = prev.heading !== cur.heading;
      if (prev.text !== cur.text || headingChanged) {
        out.push({ status: "modified", block: cur, words: diffWords(prev.text, cur.text), headingChanged });
      } else {
        out.push({ status: "unchanged", block: cur });
      }
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ status: "removed", block: beforeById.get(aIds[i])! });
      i++;
    } else {
      out.push({ status: "added", block: afterById.get(bIds[j])! });
      j++;
    }
  }
  while (i < n) out.push({ status: "removed", block: beforeById.get(aIds[i++])! });
  while (j < m) out.push({ status: "added", block: afterById.get(bIds[j++])! });
  return out;
}

// a one-line tally for the diff header ("2 edited · 1 added")
export function diffSummary(changes: BlockChange[]): string {
  const n = { added: 0, removed: 0, modified: 0, unchanged: 0 };
  for (const c of changes) n[c.status]++;
  const parts: string[] = [];
  if (n.modified) parts.push(`${n.modified} edited`);
  if (n.added) parts.push(`${n.added} added`);
  if (n.removed) parts.push(`${n.removed} removed`);
  return parts.length ? parts.join(" · ") : "No changes";
}
