import { canView, collectionById, getArtifact, getArtifactEvidence, getBlocks, nodeRelations } from "@/lib/api";
import { personTintVar, tintVar } from "@/lib/identity";
import { houseSeparators } from "@/lib/text";
import type { RefKind } from "@/lib/types";

// What a document's cloth is read from (components/neighbourhood-cover.tsx draws it, cover-cloth.ts weaves it).
// The document's own outline and its confirmed links, nothing else. No React, so the same reading can be checked
// outside the app.
//   - A section is a block heading, in reading order, callouts left out (the reader's outline). A heading that
//     only repeats the title is dropped; the words under it count toward the section before. A section's
//     length is its words, heading and text.
//   - A link is a neighbour joined by a confirmed edge (human_verified), once per neighbour, and only one the
//     viewer can open: nodeRelations takes no viewer, so canView is applied here, or the cover would tell a
//     reader that a restricted document exists. A proposal (ai_generated) is never read.
//   - A link is anchored in every section one of its outgoing edges has evidence in. Its weight in a section is
//     the evidence rows that anchor it there; the cloth floats the heaviest links first (cover-cloth.ts).
//   - The ground is the hue of the collection the card's own chip leads with, so the cloth and the chip beside
//     it are one colour; an unfiled document has none.

export const KIND_ORDER: RefKind[] = ["artifact", "collection", "decision", "topic", "person", "source"];

// weights: the evidence rows anchoring the link in each of its anchors, in the same order
export type ClothLink = { id: string; kind: RefKind; hue: string; anchors: number[]; weights: number[] };
export type ClothReading = {
  // the collection hue the card's own chip wears (the document's first), or undefined when unfiled
  ground: string | undefined;
  words: number[]; // one per section, reading order
  links: ClothLink[]; // kind order, then id
};

// The collection a document is filed in first: the one its card's chip leads with (CollectionTag keeps the
// document's own order).
function firstCollectionHue(id: string): string | undefined {
  const a = getArtifact(id);
  for (const cid of a?.collection_ids ?? []) {
    const c = collectionById(cid);
    if (c) return c.color;
  }
  return undefined;
}

// a neighbour's identity hue, the one its own mark wears
function hueOf(id: string, kind: RefKind, unfiled: string): string {
  if (kind === "artifact") return firstCollectionHue(id) ?? unfiled;
  if (kind === "collection") return collectionById(id)?.color ?? unfiled;
  if (kind === "person") return personTintVar(id);
  return tintVar(id);
}

const countWords = (s: string | undefined) => (s ? s.split(/\s+/).filter(Boolean).length : 0);

export function readCloth(id: string, title: string, unfiled: string): ClothReading {
  const name = houseSeparators(title).trim().toLowerCase();
  const sections: { id: string; words: number }[] = [];
  for (const b of getBlocks(id)) {
    if (b.callout) continue;
    const head = b.heading?.trim();
    if (head && houseSeparators(head).trim().toLowerCase() !== name) {
      sections.push({ id: b.id, words: countWords(head) + countWords(b.text) });
    } else if (sections.length) {
      sections[sections.length - 1].words += countWords(b.text);
    }
  }
  const index = new Map(sections.map((s, i) => [s.id, i]));
  const anchorOf = new Map<string, string>();
  for (const ev of getArtifactEvidence(id)) if (ev.block_id) anchorOf.set(ev.edge_id, ev.block_id);
  // per link, the evidence rows anchoring it in each section
  const seen = new Map<string, { id: string; kind: RefKind; anchors: Map<number, number> }>();
  for (const r of nodeRelations(id)) {
    if (r.prov !== "human_verified" || r.target_id === id || !canView(r.target_id)) continue;
    const link = seen.get(r.target_id) ?? { id: r.target_id, kind: r.kind, anchors: new Map<number, number>() };
    const b = r.dir === "out" ? anchorOf.get(r.edge_id) : undefined;
    if (b !== undefined && index.has(b)) {
      const s = index.get(b)!;
      link.anchors.set(s, (link.anchors.get(s) ?? 0) + 1);
    }
    seen.set(r.target_id, link);
  }
  const links = [...seen.values()]
    .sort((x, y) => KIND_ORDER.indexOf(x.kind) - KIND_ORDER.indexOf(y.kind) || (x.id < y.id ? -1 : x.id > y.id ? 1 : 0))
    .map((l) => {
      const anchors = [...l.anchors.keys()].sort((a, b) => a - b);
      return { id: l.id, kind: l.kind, hue: hueOf(l.id, l.kind, unfiled), anchors, weights: anchors.map((s) => l.anchors.get(s)!) };
    });
  return { ground: firstCollectionHue(id), words: sections.map((s) => s.words), links };
}
