// Woven — the accessor layer. Mirrors the ARCHITECTURE §2.1 / §2.2 contracts, reading
// from lib/data.ts. Pages call these instead of holding inline arrays; swapping this file
// for real fetch() calls is the only change to go live.
//
// The point of the typed graph: the artifact rail, card connections, and Ask citations
// are *resolved from edges* here — not hand-listed in each page.

import {
  activity,
  artifactAnalytics,
  artifactPeek,
  artifacts,
  blocks,
  captureReviews,
  collectionCandidates,
  collectionAnalytics,
  collections,
  decisions,
  editProposals,
  edges,
  people,
  sources,
  spaces,
  topics,
} from "./data";
import { bumpGraph } from "./store";
import type {
  Activity,
  Analytics,
  Artifact,
  ArtifactGraph,
  ArtifactType,
  AskCite,
  ArtifactAsk,
  Block,
  CaptureReview,
  Collection,
  CollectionCandidate,
  CollectionKind,
  Conn,
  Edge,
  EditProposal,
  EvidenceItem,
  Freshness,
  GraphEdge,
  GraphRel,
  Neighborhood,
  GraphNode,
  NodeStat,
  PendingEdge,
  Person,
  Ref,
  RefKind,
  Space,
  Topic,
} from "./types";

// ——————————————————————————————————————————— node resolvers

const PREFIX: Record<string, RefKind> = {
  a_: "artifact",
  co_: "collection",
  src_: "source",
  pe_: "person",
  de_: "decision",
  to_: "topic",
};

function kindOf(id: string): RefKind {
  for (const p in PREFIX) if (id.startsWith(p)) return PREFIX[p];
  return "artifact";
}

export function getArtifact(id: string): Artifact | undefined {
  return artifacts.find((a) => a.id === id);
}
export function personById(id: string): Person | undefined {
  return people.find((p) => p.id === id);
}
export function spaceById(id: string): Space | undefined {
  return spaces.find((s) => s.id === id);
}
export function collectionById(id: string): Collection | undefined {
  return collections.find((c) => c.id === id);
}
export function collectionBySlug(slug: string): Collection {
  return collections.find((c) => c.slug === slug) ?? collections[0];
}

// label a node for a relation row — collections show their slug (matches the rail style)
function labelOf(id: string): string {
  const kind = kindOf(id);
  if (kind === "artifact") return getArtifact(id)?.title ?? id;
  if (kind === "collection") return collectionById(id)?.slug ?? id;
  if (kind === "source") return sources.find((s) => s.id === id)?.label ?? id;
  if (kind === "person") return personById(id)?.name ?? id;
  if (kind === "topic") return topicById(id)?.name ?? id;
  if (kind === "decision") return decisions.find((d) => d.id === id)?.text ?? id;
  return id;
}
export function refOf(id: string): Ref {
  return { id, label: labelOf(id), kind: kindOf(id) };
}

// cross-kind entity search for the graph explorer's focus picker — match any node's label, so the
// starting point is anything in the graph (person · topic · artifact · collection · decision), not a
// preset list. People/topics first so the common picks surface before the long tail of artifacts.
export function searchEntities(
  q: string,
  limit = 8,
): { id: string; label: string; kind: RefKind }[] {
  const ql = q.trim().toLowerCase();
  const ids = [
    ...people.map((p) => p.id),
    ...topics.map((t) => t.id),
    ...collections.map((c) => c.id),
    ...artifacts.map((a) => a.id),
    ...decisions.map((d) => d.id),
  ];
  const out: { id: string; label: string; kind: RefKind }[] = [];
  for (const id of ids) {
    const label = labelOf(id);
    if (ql && !label.toLowerCase().includes(ql)) continue;
    out.push({ id, label, kind: kindOf(id) });
    if (out.length >= limit) break;
  }
  return out;
}

// ——————————————————————————————————————————— artifacts (Today / Library)

export function listArtifacts(filter?: { type?: ArtifactType | "All"; collection?: string }): Artifact[] {
  return artifacts.filter((a) => {
    if (filter?.type && filter.type !== "All" && a.type !== filter.type) return false;
    if (filter?.collection) {
      const co = collectionBySlug(filter.collection);
      if (!a.collection_ids.includes(co.id)) return false;
    }
    return true;
  });
}

export function getBlocks(id: string): Block[] {
  return blocks.filter((b) => b.artifact_id === id);
}

// the artifact's resolved graph rail — everything comes from edges
export function getArtifactGraph(id: string): ArtifactGraph {
  const out = edges.filter((e) => e.from === id);
  const inc = edges.filter((e) => e.to === id);

  const proposed = out
    .filter((e) => e.type === "links_to" && kindOf(e.to) === "artifact" && e.prov === "ai_generated")
    .map((e) => ({ edge_id: e.id, label: labelOf(e.to), target_id: e.to, confidence: e.confidence, rationale: e.rationale }));

  const linkedTo = out
    .filter((e) => e.type === "links_to" && kindOf(e.to) !== "artifact")
    .map((e) => refOf(e.to));

  const linkedFrom = inc
    .filter((e) => e.type === "links_to" && e.prov !== "ai_generated")
    .map((e) => refOf(e.from));

  const sourceRefs = out.filter((e) => e.type === "sourced_from").map((e) => refOf(e.to));

  const peopleRefs = out
    .filter((e) => e.type === "mentions" && kindOf(e.to) === "person")
    .map((e) => personById(e.to))
    .filter((p): p is Person => !!p);

  const decisionRefs = out
    .filter((e) => e.type === "decided")
    .map((e) => decisions.find((d) => d.id === e.to))
    .filter((d): d is NonNullable<typeof d> => !!d);

  return { proposed, linkedTo, linkedFrom, sources: sourceRefs, people: peopleRefs, decisions: decisionRefs };
}

// the read-along evidence rail — every provenance edge resolved to a section-anchored item
// (block_id = the section it supports). The reader renders these beside the body and lights up
// the ones anchored to the section currently in view.
export function getArtifactEvidence(id: string): EvidenceItem[] {
  const out = edges.filter((e) => e.from === id);
  const inc = edges.filter((e) => e.to === id);
  const items: EvidenceItem[] = [];

  for (const e of out) {
    const to = e.to;
    if (e.type === "sourced_from") {
      items.push({ edge_id: e.id, group: "source", label: labelOf(to), target_id: to, kind: kindOf(to), prov: e.prov, block_id: e.anchor });
    } else if (e.type === "mentions" && kindOf(to) === "person") {
      items.push({ edge_id: e.id, group: "person", label: labelOf(to), target_id: to, kind: "person", prov: e.prov, block_id: e.anchor });
    } else if (e.type === "mentions" && kindOf(to) === "topic") {
      items.push({ edge_id: e.id, group: "topic", label: labelOf(to), target_id: to, kind: "topic", prov: e.prov, block_id: e.anchor });
    } else if (e.type === "decided") {
      const d = decisions.find((x) => x.id === to);
      items.push({ edge_id: e.id, group: "decision", label: d?.text ?? labelOf(to), target_id: to, kind: "decision", prov: e.prov, block_id: e.anchor });
    } else if (e.type === "links_to") {
      const isArtifact = kindOf(to) === "artifact";
      const isProposed = isArtifact && e.prov === "ai_generated";
      items.push({
        edge_id: e.id,
        group: isProposed ? "proposed" : "link",
        label: labelOf(to),
        target_id: to,
        kind: kindOf(to),
        prov: e.prov,
        rationale: e.rationale,
        block_id: e.anchor,
        href: isArtifact ? `/artifact/${to}` : undefined,
      });
    }
  }
  for (const e of inc) {
    if (e.type === "links_to" && e.prov !== "ai_generated") {
      const from = e.from;
      items.push({
        edge_id: e.id,
        group: "link",
        label: labelOf(from),
        target_id: from,
        kind: kindOf(from),
        prov: e.prov,
        block_id: e.anchor,
        href: kindOf(from) === "artifact" ? `/artifact/${from}` : undefined,
      });
    }
  }
  return items;
}

// graph-grounded Ask over one artifact — the answer cites real sections (block_id → scroll) and a
// neighborhood artifact (href → navigate). Prototype: grounded in the artifact's own blocks + its
// evidence; a real backend would retrieve the bounded neighborhood and synthesize with an LLM.
export function askArtifact(artifactId: string, question: string): ArtifactAsk {
  const bs = blocks.filter((b) => b.artifact_id === artifactId);
  const ev = getArtifactEvidence(artifactId);
  const words = question.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const matched = bs.filter((b) =>
    words.some((w) => b.heading.toLowerCase().includes(w) || b.text.toLowerCase().includes(w)),
  );
  const chosen = (matched.length ? matched : bs).slice(0, 2);
  const cites: AskCite[] = chosen.map((b) => ({ label: b.heading, block_id: b.id }));
  const link = ev.find((e) => e.href);
  if (link?.href) cites.push({ label: link.label, href: link.href });
  const lead = chosen.map((b) => "“" + b.heading + "”").join(" and ");
  const excerpt = chosen[0] ? chosen[0].text.split(/(?<=[.!?])\s/).slice(0, 2).join(" ") : "";
  const answer = `From ${lead}${link ? ", and the linked " + link.label : ""} — ${excerpt}`;
  return { answer, cites };
}

// card "connections" — up to 2 chips, derived from the artifact's edges
export function artifactConns(id: string): Conn[] {
  const out = edges.filter((e) => e.from === id);
  const out2: Conn[] = [];

  const coLink = out.find((e) => e.type === "links_to" && kindOf(e.to) === "collection");
  if (coLink) out2.push({ kind: "link", label: labelOf(coLink.to) });

  const mentions = out.filter((e) => e.type === "mentions" && kindOf(e.to) === "person").length;
  const srcs = out.filter((e) => e.type === "sourced_from").length;
  if (mentions >= 2) out2.push({ kind: "people", label: `${mentions} people` });
  else if (srcs > 0) out2.push({ kind: "sources", label: `${srcs} source${srcs > 1 ? "s" : ""}` });
  else if (mentions > 0) out2.push({ kind: "people", label: `${mentions} person` });

  return out2;
}

// degree — the relation count shown on Library rows
export function relationCount(id: string): number {
  return edges.filter((e) => e.from === id || e.to === id).length;
}

// living-artifact freshness — superseded (a newer artifact replaced this, from the supersedes edge) beats
// stale (a source/dependency this was woven from has since changed). Otherwise it reads as fresh.
export function getFreshness(id: string): Freshness {
  const sup = edges.find((e) => e.type === "supersedes" && e.to === id);
  if (sup) return { state: "superseded", by_id: sup.from, by_label: gLabel(sup.from) };
  const a = getArtifact(id);
  if (a?.staleness) return { state: "stale", source_label: a.staleness.source_label, since: a.staleness.since };
  return { state: "fresh" };
}

// workspace-level counts — the Team view's "collective brain" pulse
export function workspaceStats(): { people: number; collections: number; artifacts: number; links: number } {
  return {
    people: people.length,
    collections: collections.length,
    artifacts: artifacts.length,
    links: edges.length,
  };
}

// the artifact's primary collection (Library row swatch + name)
export function primaryCollection(id: string): Collection | undefined {
  const a = getArtifact(id);
  if (!a) return undefined;
  return collections.find((c) => a.collection_ids.includes(c.id));
}

export function listActivity(): Activity[] {
  return activity;
}

// the hero's recent-activity peek (Today)
export function getPeek(id: string): { t: string; s: string }[] {
  return artifactPeek[id] ?? [];
}

// ——————————————————————————————————————————— collections

export function listCollections(): Collection[] {
  return collections;
}

function slugify(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "collection";
}

// create a collection in the (in-memory) graph — the "New collection" flow. Pushes so the
// /collection/[slug] page resolves it; the sidebar appends its own optimistic copy for the live list.
export function createCollection(input: {
  name: string;
  color: string;
  kind: CollectionKind;
  intro?: string;
}): Collection {
  const base = slugify(input.name);
  let slug = base;
  let i = 2;
  while (collections.some((c) => c.slug === slug)) slug = `${base}-${i++}`;
  const c: Collection = {
    id: `co_${slug.replace(/-/g, "_")}`,
    slug,
    name: input.name.trim(),
    color: input.color,
    space_id: collections[0]?.space_id ?? "sp_acme",
    public: false,
    kind: input.kind,
    intro: input.intro?.trim() || undefined,
    public_member_ids: [],
  };
  collections.push(c);
  // a smart (typed) collection comes alive immediately — the agent proposes a few members to the Inbox
  if (c.kind === "typed") generateCollectionCandidates(c);
  return c;
}

// file existing artifacts into a collection — backs the "Add documents" picker (collection page + create flow)
export function addArtifactsToCollection(collectionId: string, artifactIds: string[]): void {
  for (const id of artifactIds) {
    const a = artifacts.find((x) => x.id === id);
    if (a && !a.collection_ids.includes(collectionId)) a.collection_ids.push(collectionId);
  }
}

// un-file an artifact from a collection — backs the "Add to collection" toggle + member removal on the
// collection page. The inverse of a single addArtifactsToCollection entry.
export function removeArtifactFromCollection(collectionId: string, artifactId: string): void {
  const a = artifacts.find((x) => x.id === artifactId);
  if (a) a.collection_ids = a.collection_ids.filter((id) => id !== collectionId);
}

// ——————————————————————————————————————————— publish (the in-memory prototype's persist)

export type Visibility = "workspace" | "link" | "public";

// publish an artifact — persist the public flag + a stable hub slug so /a/[slug] resolves and the
// reader/library reflect it. "workspace" keeps it internal-only (no public hub).
export function publishArtifact(id: string, visibility: Visibility): void {
  const a = artifacts.find((x) => x.id === id);
  if (!a) return;
  a.public = visibility !== "workspace";
  if (a.public && !a.hub_slug) a.hub_slug = slugify(a.title);
}

// public artifacts resolve their hub by slug (or id); /a/[slug] uses this to find the artifact.
export function artifactByHubSlug(slug: string): Artifact | undefined {
  return artifacts.find((a) => a.public && (a.hub_slug === slug || a.id === slug));
}

// publish a collection — persist which members go public + the public flag, so /c/[slug] and the
// collection page's Published state reflect the real choice.
export function publishCollection(slug: string, memberIds: string[], visibility: Visibility): void {
  const c = collections.find((x) => x.slug === slug);
  if (!c) return;
  c.public = visibility !== "workspace";
  c.public_member_ids = [...new Set(memberIds)];
}

// archive artifacts — the bulk "Archive" action; sets state so they drop out of the working Library.
export function archiveArtifacts(ids: string[]): void {
  for (const id of ids) {
    const a = artifacts.find((x) => x.id === id);
    if (a) a.state = "archived";
  }
  bumpGraph();
}

// ——————————————————————————————————————————— smart-collection candidates (the Inbox membership valve)

// the agent's first pass at "what belongs here" — match the rule's keywords against artifact title+gist,
// fall back to the freshest few. Pushes Inbox candidates; confirming one files the artifact into the collection.
export function generateCollectionCandidates(c: Collection): void {
  const rule = (c.intro ?? c.name).toLowerCase();
  const keywords = rule.split(/[^a-z0-9]+/).filter((w) => w.length > 3);
  const pool = artifacts.filter((a) => !a.collection_ids.includes(c.id));
  const scored = pool.map((a) => {
    const hay = `${a.title} ${a.gist ?? ""}`.toLowerCase();
    return { a, hit: keywords.find((k) => hay.includes(k)) };
  });
  const matched = scored.filter((s) => s.hit);
  const chosen = (matched.length ? matched : scored).slice(0, 3);
  for (const { a, hit } of chosen) {
    collectionCandidates.push({
      id: `cand_${c.id}_${a.id}`,
      collectionId: c.id,
      collectionName: c.name,
      artifactId: a.id,
      artifactTitle: a.title,
      rationale: hit ? `Mentions “${hit}” — fits your rule` : `Looks related to ${c.name}`,
    });
  }
}

export function listCollectionCandidates(): CollectionCandidate[] {
  return collectionCandidates;
}
export function collectionCandidateCount(): number {
  return collectionCandidates.length;
}

// resolve a candidate — "add" files the artifact into the collection (real membership via collection_ids);
// "skip" just clears it. Returns the candidate for Undo.
export function resolveCollectionCandidate(id: string, action: "add" | "skip"): CollectionCandidate | undefined {
  const i = collectionCandidates.findIndex((c) => c.id === id);
  if (i < 0) return undefined;
  const cand = collectionCandidates[i];
  collectionCandidates.splice(i, 1);
  if (action === "add") {
    const a = artifacts.find((x) => x.id === cand.artifactId);
    if (a && !a.collection_ids.includes(cand.collectionId)) a.collection_ids.push(cand.collectionId);
  }
  bumpGraph();
  return cand;
}

// undo a resolve — re-insert the candidate, and if it had been added, un-file the artifact.
export function restoreCollectionCandidate(cand: CollectionCandidate, wasAdded: boolean): void {
  if (wasAdded) {
    const a = artifacts.find((x) => x.id === cand.artifactId);
    if (a) a.collection_ids = a.collection_ids.filter((id) => id !== cand.collectionId);
  }
  collectionCandidates.unshift(cand);
  bumpGraph();
}
export function collectionMembers(slug: string): Artifact[] {
  const co = collectionBySlug(slug);
  return artifacts.filter((a) => a.collection_ids.includes(co.id));
}
export function collectionContents(slug: string): { artifact: Artifact; pub: boolean }[] {
  const co = collectionBySlug(slug);
  return collectionMembers(slug).map((a) => ({ artifact: a, pub: co.public_member_ids.includes(a.id) }));
}
export function collectionPublicMembers(slug: string): Artifact[] {
  return collectionContents(slug).filter((c) => c.pub).map((c) => c.artifact);
}

// ——————————————————————————————————————————— analytics

export function getAnalytics(
  scope: "artifact" | "collection",
  id: string,
  audience: "internal" | "public" = "public",
): Analytics | undefined {
  if (scope === "artifact") return artifactAnalytics[id];
  return collectionAnalytics[`${id}:${audience}`];
}

// ——————————————————————————————————————————— verify queue (the three-state trust valve)

// every ai_generated edge awaiting human verification — the Inbox, resolved + sorted by confidence
export function listPending(): PendingEdge[] {
  return edges
    .filter((e) => e.prov === "ai_generated")
    .map((e) => ({
      edge_id: e.id,
      type: e.type,
      fromId: e.from,
      fromLabel: gLabel(e.from),
      fromKind: kindOf(e.from),
      toId: e.to,
      toLabel: gLabel(e.to),
      toKind: kindOf(e.to),
      confidence: e.confidence ?? 0.5,
      rationale: e.rationale,
    }))
    .sort((a, b) => b.confidence - a.confidence);
}

export function pendingCount(): number {
  return edges.filter((e) => e.prov === "ai_generated").length;
}

// the post-capture review queue — the agent's dupe / naming / archive / extraction decisions
export function listCaptureReviews(): CaptureReview[] {
  return captureReviews;
}

// resolve a capture review — clear it from the queue so the Inbox count + sidebar badge drop. (The
// per-kind effect — merge / rename / archive — is prototype-stubbed; clearing the review is the real part.)
export function resolveCaptureReview(id: string): CaptureReview | undefined {
  const i = captureReviews.findIndex((r) => r.id === id);
  if (i < 0) return undefined;
  const [r] = captureReviews.splice(i, 1);
  bumpGraph();
  return r;
}
export function restoreCaptureReview(r: CaptureReview): void {
  captureReviews.unshift(r);
  bumpGraph();
}
export function captureReviewCount(): number {
  return captureReviews.length;
}

// ——————————————————————————————————————————— verify (mutates in-memory — the Verify valve)

export function verifyEdge(id: string, action: "confirm" | "discard"): Edge | undefined {
  const i = edges.findIndex((e) => e.id === id);
  if (i < 0) return undefined;
  const prev = edges[i];
  if (action === "discard") edges.splice(i, 1);
  else edges[i] = { ...prev, prov: "human_verified" };
  bumpGraph();
  return prev; // snapshot — pass to restoreEdge to undo
}

// undo a verify — re-insert a discarded edge, or revert a confirmed one to its prior state
export function restoreEdge(edge: Edge): void {
  const i = edges.findIndex((e) => e.id === edge.id);
  if (i < 0) edges.push(edge);
  else edges[i] = edge;
  bumpGraph();
}

// ——————————————————————————————————————————— KG-viz (focused neighborhoods, never global)

export function listPeople(): Person[] {
  return people;
}
export function listTopics(): Topic[] {
  return topics;
}
export function topicById(id: string): Topic | undefined {
  return topics.find((t) => t.id === id);
}

// graph label — collections read nicer by name here than by slug
function gLabel(id: string): string {
  return kindOf(id) === "collection" ? (collectionById(id)?.name ?? id) : labelOf(id);
}

function nodeBase(id: string, depth: number): GraphNode {
  const a = kindOf(id) === "artifact" ? getArtifact(id) : undefined;
  return { id, label: gLabel(id), kind: kindOf(id), type: a?.type, state: a?.state, prov: a?.prov, depth };
}

// the focused neighborhood — BFS over edges (undirected) to `depth`. Never the global graph.
export function getNeighborhood(centerId: string, depth = 1): Neighborhood {
  const seen = new Map<string, number>([[centerId, 0]]);
  let frontier = [centerId];
  const picked = new Map<string, (typeof edges)[number]>();
  for (let d = 1; d <= depth; d++) {
    const next: string[] = [];
    for (const nid of frontier) {
      for (const e of edges) {
        if (e.from !== nid && e.to !== nid) continue;
        picked.set(e.id, e);
        const other = e.from === nid ? e.to : e.from;
        if (!seen.has(other)) {
          seen.set(other, d);
          next.push(other);
        }
      }
    }
    frontier = next;
  }
  const nodes = [...seen.entries()].map(([id, d]) => nodeBase(id, d));
  const gedges = [...picked.values()]
    .filter((e) => seen.has(e.from) && seen.has(e.to))
    .map((e) => ({ id: e.id, from: e.from, to: e.to, type: e.type, prov: e.prov, confidence: e.confidence }));
  return { centerId, nodes, edges: gedges };
}

// the collection-scoped graph — its members + the links among them, plus the people/topics they touch.
// The "Map" view of a collection (and the seed of its emergent KG-mark). Centre = the collection itself.
export function collectionGraph(slug: string): Neighborhood {
  const co = collectionBySlug(slug);
  const members = collectionMembers(slug);
  const memberIds = new Set(members.map((a) => a.id));
  const depthOf = new Map<string, number>([[co.id, 0]]);
  for (const a of members) depthOf.set(a.id, 1);

  const picked = new Map<string, (typeof edges)[number]>();
  for (const e of edges) {
    const fromM = memberIds.has(e.from);
    const toM = memberIds.has(e.to);
    if (fromM && toM) {
      picked.set(e.id, e); // member ↔ member
    } else if (fromM || toM) {
      const other = fromM ? e.to : e.from;
      const k = kindOf(other);
      if (k === "person" || k === "topic") {
        if (!depthOf.has(other)) depthOf.set(other, 2);
        picked.set(e.id, e); // member → person / topic
      }
    }
  }

  const nodes = [...depthOf.entries()].map(([id, d]) => nodeBase(id, d));
  const real = [...picked.values()]
    .filter((e) => depthOf.has(e.from) && depthOf.has(e.to))
    .map((e) => ({ id: e.id, from: e.from, to: e.to, type: e.type, prov: e.prov, confidence: e.confidence }));
  // synthetic collection → member spokes, so the collection sits at the centre of its own map
  const spokes: GraphEdge[] = members.map((a) => ({
    id: `coedge-${co.id}-${a.id}`,
    from: co.id,
    to: a.id,
    type: "in_collection",
    prov: "user_created",
  }));
  return { centerId: co.id, nodes, edges: [...spokes, ...real] };
}

// the team/space-scoped graph — the collective brain one tier up from a collection: the space's
// collections + people, wired by participation (a person touches a collection if they touch any of its
// artifacts). The space sits at the centre. Still bounded (no global star-map) — just the high-level set.
export function teamGraph(spaceId: string): Neighborhood {
  const sp = spaceById(spaceId);
  const cols = listCollections();
  const ppl = listPeople();
  const nodes: GraphNode[] = [
    { id: spaceId, label: sp?.name ?? "Workspace", kind: "collection", depth: 0 },
    ...cols.map((c) => nodeBase(c.id, 1)),
    ...ppl.map((p) => nodeBase(p.id, 1)),
  ];
  const gedges: GraphEdge[] = [];
  // space → each collection (the workspace holds its collections)
  for (const c of cols) {
    gedges.push({ id: `sp-${c.id}`, from: spaceId, to: c.id, type: "in_collection", prov: "user_created" });
  }
  // person ↔ collection — wired if the person touches any artifact in the collection
  for (const c of cols) {
    const members = new Set(collectionMembers(c.slug).map((a) => a.id));
    for (const p of ppl) {
      const touches = edges.some(
        (e) => (e.from === p.id && members.has(e.to)) || (e.to === p.id && members.has(e.from)),
      );
      if (touches) {
        gedges.push({ id: `part-${p.id}-${c.id}`, from: p.id, to: c.id, type: "authored_by", prov: "human_verified" });
      }
    }
  }
  return { centerId: spaceId, nodes, edges: gedges };
}

// the paired Links list — every relation of the focused node, typed + prov-flagged
export function nodeRelations(centerId: string): GraphRel[] {
  return edges
    .filter((e) => e.from === centerId || e.to === centerId)
    .map((e) => {
      const dir: "out" | "in" = e.from === centerId ? "out" : "in";
      const other = dir === "out" ? e.to : e.from;
      return { edge_id: e.id, target_id: other, label: gLabel(other), kind: kindOf(other), edgeType: e.type, prov: e.prov, dir, confidence: e.confidence };
    });
}

// node-preview stats (the inspector) — shape depends on node kind
export function nodeStats(centerId: string): NodeStat[] {
  const kind = kindOf(centerId);
  const incident = edges.filter((e) => e.from === centerId || e.to === centerId);

  if (kind === "person") {
    const authored = artifacts.filter((a) => a.author_id === centerId);
    const mentioned = edges.filter((e) => e.type === "mentions" && e.to === centerId);
    const cos = new Set(authored.flatMap((a) => a.collection_ids));
    return [
      { label: "Authored", value: String(authored.length) },
      { label: "Mentioned in", value: String(mentioned.length) },
      { label: "Collections", value: String(cos.size) },
    ];
  }
  if (kind === "topic") {
    const arts = edges.filter((e) => e.type === "mentions" && e.to === centerId);
    const proposed = arts.filter((e) => e.prov === "ai_generated").length;
    return [
      { label: "Artifacts", value: String(arts.length) },
      { label: "Proposed", value: String(proposed) },
    ];
  }
  if (kind === "collection") {
    const slug = collectionById(centerId)?.slug ?? "";
    return [{ label: "Members", value: String(collectionMembers(slug).length) }];
  }
  if (kind === "artifact") {
    const a = getArtifact(centerId);
    const an = artifactAnalytics[centerId];
    const out: NodeStat[] = [];
    if (a) out.push({ label: "Type", value: a.type });
    out.push({ label: "Relations", value: String(incident.length) });
    out.push({ label: "Sections", value: String(getBlocks(centerId).length) });
    if (an) out.push({ label: "Reads", value: an.stats[0]?.v ?? "—" });
    return out;
  }
  return [{ label: "Relations", value: String(incident.length) }];
}

// docked-profile metadata — a plausible created / viewed / edited trio (mock; modified is the real
// `updated` label, created/viewed vary a little per artifact). Non-artifact nodes have no file meta.
const CREATED = ["6 weeks ago", "3 weeks ago", "2 months ago", "9 days ago", "5 weeks ago"];
const VIEWED = ["1h ago", "3h ago", "yesterday", "2d ago", "20m ago"];
export function nodeMeta(id: string): { created: string; viewed: string; modified: string } | null {
  const a = getArtifact(id);
  if (!a) return null;
  const k = a.id.length;
  return { created: CREATED[k % CREATED.length], viewed: VIEWED[k % VIEWED.length], modified: `${a.updated} ago` };
}

// the entity's time axis — the "Timeline" view (the relationship graph's complement: what it has been
// through, not what it connects to). Events newest-first; `actor` draws a person avatar, `agent` marks
// a Woven action. Mock for now — real history would come from the activity log.
export type TimelineEvent = {
  id: string;
  at: string;
  kind: "created" | "edited" | "mentioned" | "linked" | "confirmed" | "proposed";
  text: string;
  actor?: string;
  agent?: boolean;
};

export function nodeTimeline(id: string): TimelineEvent[] {
  const a = getArtifact(id);
  if (a) {
    const m = nodeMeta(id);
    return [
      { id: `${id}-t1`, at: m?.modified ?? "17m ago", kind: "edited", text: "Maya Chen refined the rollout section", actor: "pe_maya" },
      { id: `${id}-t2`, at: "2h ago", kind: "confirmed", text: "You confirmed the link to Q4 Launch Plan" },
      { id: `${id}-t3`, at: "yesterday", kind: "proposed", text: "Woven proposed 3 links from a mention sweep", agent: true },
      { id: `${id}-t4`, at: "4 days ago", kind: "mentioned", text: "Cited in Growth sync — May", actor: "pe_dan" },
      { id: `${id}-t5`, at: m?.created ?? "2 weeks ago", kind: "created", text: "Created by Maya Chen", actor: "pe_maya" },
    ];
  }
  const p = personById(id);
  if (p) {
    return [
      { id: `${id}-t1`, at: "1h ago", kind: "edited", text: "Updated the Notification audit", actor: id },
      { id: `${id}-t2`, at: "yesterday", kind: "mentioned", text: "Mentioned across 3 interview transcripts" },
      { id: `${id}-t3`, at: "1 week ago", kind: "created", text: "Authored “Embargo lifts on EU”", actor: id },
      { id: `${id}-t4`, at: "3 weeks ago", kind: "linked", text: `Joined the ${p.role} space` },
    ];
  }
  return [
    { id: `${id}-t1`, at: "2 days ago", kind: "mentioned", text: "Referenced in recent work" },
    { id: `${id}-t2`, at: "2 weeks ago", kind: "linked", text: "Woven connected it into the graph", agent: true },
    { id: `${id}-t3`, at: "1 month ago", kind: "created", text: "First seen in the workspace" },
  ];
}

// ——————————————————————————————————————————— conversational edit (instruct → proposed diff)

export function getProposals(artifactId: string): EditProposal[] {
  return editProposals.filter((p) => p.artifact_id === artifactId);
}

// crude "tightening" — drop a trailing em-dash clause, else drop the last sentence
function tighten(t: string): string {
  const dash = t.indexOf(" — ");
  if (dash > 40) return t.slice(0, dash) + ".";
  const sents = t.match(/[^.]+\./g);
  if (sents && sents.length > 1) return sents.slice(0, -1).join(" ").trim();
  return t;
}

function titleFrom(instruction: string): string {
  const words = instruction
    .replace(/^(add|include|insert|write|draft)\s+(a|an|the)?\s*/i, "")
    .replace(/\bsection\b/i, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3);
  const s = words.join(" ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : "New section";
}

// scoped variant — the selection-aware editor targets a specific block (the one the user selected /
// put their cursor in). Produces a rewrite diff on THAT block, whatever the instruction says (the
// prototype "applies" every text action as a tighten; the point is the inline diff + valve loop).
export function proposeBlockEdit(artifactId: string, instruction: string, blockId: string): EditProposal {
  const b = getBlocks(artifactId).find((x) => x.id === blockId);
  if (!b) return proposeEdit(artifactId, instruction);
  return {
    id: `prop_${blockId}`,
    artifact_id: artifactId,
    instruction,
    kind: "rewrite",
    block_id: b.id,
    heading: b.heading,
    before: b.text,
    after: tighten(b.text),
  };
}

// refine a live proposal without leaving the loop — transforms the CURRENT proposed text (before stays
// the original block, so the diff shows the cumulative change). Mirrors an agent tightening / rewording /
// citing its own draft on a follow-up instruction.
export function refineProposal(p: EditProposal, instruction: string): EditProposal {
  const lower = instruction.toLowerCase();
  let after = p.after;
  if (/formal|tone|reword/.test(lower)) {
    after = after
      .replace(/\bwe\b/g, "the team")
      .replace(/\bdon't\b/gi, "do not")
      .replace(/\bit's\b/gi, "it is")
      .replace(/\bwon't\b/gi, "will not");
  } else if (/source|cite|evidence/.test(lower)) {
    after = after.replace(/[.\s]*$/, "") + " — grounded in the customer transcripts and the Q4 audit.";
  } else {
    after = tighten(after);
  }
  return { ...p, instruction, after };
}

// the instruct endpoint (mock of POST /artifacts/:id/instruct → { proposed_diff }).
// Free-text routes to a preset by keyword; otherwise synthesizes a proposal.
export function proposeEdit(artifactId: string, instruction: string): EditProposal {
  const lower = instruction.toLowerCase();
  const preset = getProposals(artifactId).find((p) => (p.keywords ?? []).some((k) => lower.includes(k)));
  if (preset) return preset;

  const bs = getBlocks(artifactId);
  if (/\b(add|new|include|insert|section|summary|recommend)\b/.test(lower) || bs.length === 0) {
    return {
      id: "prop_add",
      artifact_id: artifactId,
      instruction,
      kind: "add",
      block_id: "prop_pending",
      heading: titleFrom(instruction),
      after: "First draft for review — refine the specifics with the team and the linked sources.",
    };
  }
  const b = bs[0];
  return {
    id: "prop_rw",
    artifact_id: artifactId,
    instruction,
    kind: "rewrite",
    block_id: b.id,
    heading: b.heading,
    before: b.text,
    after: tighten(b.text),
  };
}

// ——————————————————————————————————————————— version history (P3 — versioning-as-dialogue)

// an artifact version — a turn in the document's dialogue: who moved it, and what changed.
export type ArtifactVersion = {
  id: string;
  label: string; // v3 · v2 · v1
  by: string; // person id | "agent"
  byName: string;
  summary: string;
  changes: string[];
  at: string; // relative
  current?: boolean;
};

export function artifactVersions(id: string): ArtifactVersion[] {
  const a = getArtifact(id);
  return [
    {
      id: `${id}-v3`,
      label: "v3",
      by: "pe_maya",
      byName: personById("pe_maya")?.name ?? "Maya Chen",
      summary: "Refined the rollout section",
      changes: ["Tightened Channels for concision", "Confirmed the link to Q4 Launch Plan"],
      at: `${a?.updated ?? "17m"} ago`,
      current: true,
    },
    {
      id: `${id}-v2`,
      label: "v2",
      by: "agent",
      byName: "Woven agent",
      summary: "Wove in sources, proposed links",
      changes: ["Extracted 3 decisions from the growth sync", "Proposed links to Q4 OKRs and the Launch Plan"],
      at: "yesterday",
    },
    {
      id: `${id}-v1`,
      label: "v1",
      by: "agent",
      byName: "Woven agent",
      summary: "First draft from the drop",
      changes: ["Parsed the dropped file into four sections", "Set provisional metadata"],
      at: "3 days ago",
    },
  ];
}

// ——————————————————————————————————————————— block-level comments (P3)

export type BlockComment = { id: string; by: string; byName: string; text: string; at: string };

const BLOCK_COMMENTS: Record<string, BlockComment[]> = {
  b_cadence: [
    { id: "cm_1", by: "pe_dan", byName: "Dan Lee", text: "Cap at two a day, or make it configurable per space?", at: "1d" },
    { id: "cm_2", by: "pe_maya", byName: "Maya Chen", text: "Per space — moved it to the open questions.", at: "1d" },
  ],
  b_open: [{ id: "cm_3", by: "pe_dan", byName: "Dan Lee", text: "Let's settle the agent-nudge question before launch.", at: "3h" }],
};

export function blockComments(blockId: string): BlockComment[] {
  return BLOCK_COMMENTS[blockId] ?? [];
}
