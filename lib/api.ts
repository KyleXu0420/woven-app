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
  discussions,
  editProposals,
  edges,
  episodes,
  people,
  sources,
  spaces,
  spaceMembers,
  topics,
} from "./data";
import { agentRuns, agentCapabilities, decisionPoints } from "./data";
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
  Comment,
  CommentKind,
  Conn,
  Discussion,
  DiscussionTag,
  Edge,
  EditProposal,
  Episode,
  EvidenceItem,
  Freshness,
  GraphEdge,
  GraphRel,
  Neighborhood,
  GraphNode,
  NodeStat,
  NeedItem,
  PendingEdge,
  Proposed,
  Person,
  Ref,
  RefKind,
  Source,
  Space,
  Topic,
} from "./types";
import type { AgentRun, RunStatus, AgentCapability, AgentCapabilityId, DecisionPoint } from "./types";
import type { EdgeType, LearnedRule, SourceDecision } from "./types";

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

// ——————————————————————————————————————————— access (the real permission boundary)

// the space a node belongs to. Artifacts and collections carry space_id directly; a decision inherits
// its artifact's space; a person/topic/source derives it from any artifact/collection it's wired to.
// No derivable space → undefined (treated as visible by canView).
export function spaceOf(id: string): string | undefined {
  const kind = kindOf(id);
  if (kind === "artifact") return getArtifact(id)?.space_id;
  if (kind === "collection") return collectionById(id)?.space_id;
  if (kind === "decision") {
    const d = decisions.find((x) => x.id === id);
    const s = d ? getArtifact(d.artifact_id)?.space_id : undefined;
    if (s) return s;
  }
  for (const e of edges) {
    const other = e.from === id ? e.to : e.to === id ? e.from : undefined;
    if (!other) continue;
    const k = kindOf(other);
    if (k === "artifact") {
      const s = getArtifact(other)?.space_id;
      if (s) return s;
    } else if (k === "collection") {
      const s = collectionById(other)?.space_id;
      if (s) return s;
    }
  }
  return undefined;
}

// can `viewer` see this node? Visible iff its space is one the viewer is a member of. A node with no
// derivable space (or a space with no membership record) defaults to visible — only a node that lands in
// a space the viewer is NOT in is hidden. This is the boundary the search redacts against.
export function canView(id: string, viewer: string = "pe_maya"): boolean {
  const s = spaceOf(id);
  if (!s) return true;
  const members = spaceMembers[s];
  if (!members) return true;
  return members.includes(viewer);
}

// ——————————————————————————————————————————— ranked entity search

// the recency component of a hit's score. Artifacts read their own episodes; a person/topic/collection/
// decision/source has no episodes of its own (episodes are artifact-anchored) so it derives recency
// through its edges — the freshest connected artifact. Bucketed so it stays a small tie-breaker under degree.
function entityRecencyBoost(id: string): number {
  const kind = kindOf(id);
  const artifactMinutes = (aid: string): number | undefined => {
    const eps = episodes.filter((e) => e.artifactId === aid);
    return eps.length ? Math.min(...eps.map((e) => agoMinutes(e.at))) : undefined;
  };
  let minutes: number | undefined;
  if (kind === "artifact") {
    minutes = artifactMinutes(id);
  } else {
    const mins: number[] = [];
    for (const e of edges) {
      const other = e.from === id ? e.to : e.to === id ? e.from : undefined;
      if (!other || kindOf(other) !== "artifact") continue;
      const m = artifactMinutes(other);
      if (m !== undefined) mins.push(m);
    }
    if (mins.length) minutes = Math.min(...mins);
  }
  if (minutes === undefined) return 0;
  if (minutes <= 60) return 0.9;
  if (minutes <= 360) return 0.6;
  if (minutes <= 1440) return 0.4;
  if (minutes <= 4320) return 0.2;
  return 0;
}

// a hit's rank = degree + recency + prov. Prov only shifts artifacts (verified nudges up, still-proposed
// nudges down); non-artifact kinds get no prov term (they carry no ProvState of their own).
function entityScore(id: string, kind: RefKind): number {
  let prov = 0;
  if (kind === "artifact") {
    const a = getArtifact(id);
    if (a?.prov === "human_verified") prov = 0.5;
    else if (a?.prov === "ai_generated") prov = -0.5;
  }
  return relationCount(id) + entityRecencyBoost(id) + prov;
}

export type SearchHit = { id: string; label: string; kind: RefKind; restricted?: boolean };

// cross-kind entity search — the search's id resolver. Matches any node's label (people · topics ·
// collections · artifacts · decisions · sources), then RANKS the full match set by entityScore and slices
// to `limit` (no early-break, so the best hits win, not the first). An empty query returns the top-ranked
// "suggested" set. Access-aware: hits the `viewer` can't see are omitted, unless `includeRestricted`, in
// which case they come back as a redacted stub ({ restricted: true, label: "Restricted <kind>" }).
export function searchEntities(
  q: string,
  limit = 8,
  opts?: { kinds?: RefKind[]; includeRestricted?: boolean; viewer?: string },
): SearchHit[] {
  const ql = q.trim().toLowerCase();
  const viewer = opts?.viewer ?? "pe_maya";
  let ids = [
    ...people.map((p) => p.id),
    ...topics.map((t) => t.id),
    ...collections.map((c) => c.id),
    ...artifacts.map((a) => a.id),
    ...decisions.map((d) => d.id),
    ...sources.map((s) => s.id),
  ];
  if (opts?.kinds && opts.kinds.length) ids = ids.filter((id) => opts.kinds!.includes(kindOf(id)));

  const scored: { hit: SearchHit; score: number }[] = [];
  for (const id of ids) {
    const label = labelOf(id);
    if (ql && !label.toLowerCase().includes(ql)) continue;
    const kind = kindOf(id);
    const visible = canView(id, viewer);
    if (!visible && !opts?.includeRestricted) continue;
    const score = entityScore(id, kind);
    const hit: SearchHit = visible
      ? { id, label, kind }
      : { id, label: `Restricted ${kind}`, kind, restricted: true };
    scored.push({ hit, score });
  }
  scored.sort((a, b) => b.score - a.score || a.hit.id.localeCompare(b.hit.id));
  return scored.slice(0, limit).map((s) => s.hit);
}

// ——————————————————————————————————————————— artifacts (Today / Library)

export function listArtifacts(
  filter?: { type?: ArtifactType | "All"; collection?: string },
  viewer: string = "pe_maya",
): Artifact[] {
  return artifacts.filter((a) => {
    if (!canView(a.id, viewer)) return false; // restricted-space artifacts (e.g. a_comp) never surface here
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

  // the Verify queue: any ai_generated edge awaiting confirmation — proposed links (artifact → artifact) plus
  // the editor's "Extract decision" / "Cite source" (decided / sourced_from) that mine the prose into the graph.
  const proposed = out
    .filter(
      (e) =>
        e.prov === "ai_generated" &&
        ((e.type === "links_to" && kindOf(e.to) === "artifact") ||
          e.type === "decided" ||
          e.type === "sourced_from" ||
          e.type === "mentions"), // voice/extraction proposes people + topics too — they verify in place, not auto-confirmed
    )
    .map((e) => ({ edge_id: e.id, label: labelOf(e.to), target_id: e.to, kind: kindOf(e.to), confidence: e.confidence, rationale: e.rationale }));

  const linkedTo = out
    .filter((e) => e.type === "links_to" && kindOf(e.to) !== "artifact")
    .map((e) => refOf(e.to));

  const linkedFrom = inc
    .filter((e) => e.type === "links_to" && e.prov !== "ai_generated")
    .map((e) => refOf(e.from));

  const sourceRefs = out
    .filter((e) => e.type === "sourced_from" && e.prov !== "ai_generated")
    .map((e) => refOf(e.to));

  const peopleRefs = out
    .filter((e) => e.type === "mentions" && e.prov !== "ai_generated" && kindOf(e.to) === "person")
    .map((e) => personById(e.to))
    .filter((p): p is Person => !!p);

  const decisionRefs = out
    .filter((e) => e.type === "decided" && e.prov !== "ai_generated")
    .map((e) => decisions.find((d) => d.id === e.to))
    .filter((d): d is NonNullable<typeof d> => !!d);

  return { proposed, linkedTo, linkedFrom, sources: sourceRefs, people: peopleRefs, decisions: decisionRefs };
}

// Extract decision / Cite source (from the editor): mine the selection into a NEW node + an ai_generated edge,
// so it lands in the Verify queue like any proposal. Confirming it (verifyEdge) flips prov → human_verified and
// records the "confirmed" episode — the same one loop, now reaching decisions + sources, not just links. Until
// confirmed the node is withheld from the Decisions / Sources lists (the ai_generated filter above).
let proposalSeq = 0;
function nextProposalId(prefix: string): string {
  proposalSeq += 1;
  return `${prefix}_p${proposalSeq}`;
}

export function proposeDecision(artifactId: string, text: string, blockId?: string | null): Proposed {
  const label = text.trim().replace(/\s+/g, " ").slice(0, 90) || "New decision";
  const id = nextProposalId("de");
  decisions.push({ id, text: label, artifact_id: artifactId });
  const edgeId = nextProposalId("e");
  const edge: Edge = {
    id: edgeId,
    type: "decided",
    from: artifactId,
    to: id,
    prov: "ai_generated",
    anchor: blockId ?? undefined,
    created_by: "agent",
    confidence: 0.85,
    rationale: "Extracted from the selection.",
  };
  edges.push(edge);
  // if an active rule + the floor auto-confirm it, admitProposedEdge records the "confirmed" episode; otherwise
  // it stays pending and we record the "proposed" episode.
  if (!admitProposedEdge(edge)) {
    recordEpisode({ artifactId, kind: "proposed", actor: "agent", at: "now", summary: label, edgeId, blockId: blockId ?? undefined });
  }
  bumpGraph();
  return { edge_id: edgeId, label, target_id: id, kind: "decision", rationale: "Extracted from the selection." };
}

export function proposeCite(artifactId: string, text: string, blockId?: string | null): Proposed {
  const label = text.trim().replace(/\s+/g, " ").slice(0, 90) || "Cited source";
  const id = nextProposalId("src");
  sources.push({ id, label, kind: "doc" });
  const edgeId = nextProposalId("e");
  const edge: Edge = {
    id: edgeId,
    type: "sourced_from",
    from: artifactId,
    to: id,
    prov: "ai_generated",
    anchor: blockId ?? undefined,
    created_by: "agent",
    confidence: 0.8,
    rationale: "Cited for the selection.",
  };
  edges.push(edge);
  if (!admitProposedEdge(edge)) {
    recordEpisode({ artifactId, kind: "proposed", actor: "agent", at: "now", summary: label, edgeId, blockId: blockId ?? undefined });
  }
  bumpGraph();
  return { edge_id: edgeId, label, target_id: id, kind: "source", rationale: "Cited for the selection." };
}

// Voice-capture spike — a recorded meeting becomes REAL nodes (this is the FIRST capture path that writes to
// the data layer; the file drop / paste flow is still simulated). The recording lands as a two-node
// {meeting Source ⊸ synthesized Artifact} pair with a sourced_from provenance edge, then an extraction pass
// proposes typed edges (a decision · attendee/topic mentions) as ai_generated → the Inbox Verify queue, where
// the confirm-is-episode loop runs unchanged. STT is STUBBED (the transcript is canned): this proves the
// graph-landing + verify loop, NOT the ASR. Returns the new artifact id + how many edges landed to verify.
export function captureMeeting(input: {
  title: string;
  gist: string;
  sections: { heading: string; text: string }[];
  attendeeIds: string[];
  topicIds: string[];
  decision?: string;
}): { artifactId: string; proposedCount: number } {
  const artifactId = nextProposalId("a");
  artifacts.push({
    id: artifactId,
    type: "MD",
    title: input.title,
    state: "living",
    prov: "ai_generated",
    space_id: "sp_product",
    collection_ids: [],
    author_id: "agent",
    public: false,
    gist: input.gist,
    updated: "now",
  });

  const blockIds: string[] = [];
  for (const s of input.sections) {
    const bid = nextProposalId("b");
    blocks.push({ id: bid, artifact_id: artifactId, anchor: s.heading.toLowerCase().replace(/\s+/g, "-"), heading: s.heading, text: s.text });
    blockIds.push(bid);
  }

  // the recording itself, as a Source; you don't verify what you just recorded → the sourced_from is verified
  const srcId = nextProposalId("src");
  sources.push({ id: srcId, label: input.title, kind: "meeting", at: "now", note: "Recorded — its transcript was woven into this doc." });
  edges.push({ id: nextProposalId("e"), type: "sourced_from", from: artifactId, to: srcId, prov: "human_verified", anchor: blockIds[0], created_by: "agent" });

  // extraction → ai_generated proposals (the Verify queue). Each carries a plain-language "why" + confidence, and
  // routes through admitProposedEdge: if an active rule + the floor already trust this shape it auto-confirms and
  // never queues (proposedCount counts only what stayed pending). A fresh meeting doc is un-filed, so nothing
  // auto-confirms until it's in a collection — but the interception is wired for when it is.
  let proposedCount = 0;
  const admit = (edge: Edge) => {
    edges.push(edge);
    if (!admitProposedEdge(edge)) proposedCount++;
  };
  if (input.decision) {
    const deId = nextProposalId("de");
    decisions.push({ id: deId, text: input.decision.trim().slice(0, 90), artifact_id: artifactId });
    admit({ id: nextProposalId("e"), type: "decided", from: artifactId, to: deId, prov: "ai_generated", anchor: blockIds[1] ?? blockIds[0], created_by: "agent", confidence: 0.72, rationale: "Stated aloud in the recording." });
  }
  for (const pid of input.attendeeIds) {
    if (!personById(pid)) continue;
    admit({ id: nextProposalId("e"), type: "mentions", from: artifactId, to: pid, prov: "ai_generated", created_by: "agent", confidence: 0.66, rationale: "Spoke during the meeting." });
  }
  for (const tid of input.topicIds) {
    if (!topicById(tid)) continue;
    admit({ id: nextProposalId("e"), type: "mentions", from: artifactId, to: tid, prov: "ai_generated", created_by: "agent", confidence: 0.6, rationale: "Discussed in the meeting." });
  }

  recordEpisode({ artifactId, kind: "captured", actor: "agent", at: "now", summary: `Wove the recording into ${input.title}` });
  bumpGraph();
  return { artifactId, proposedCount };
}

// a source's stored provenance (external — transcripts / meetings / audits); powers the source peek.
export function sourceById(id: string): Source | undefined {
  return sources.find((s) => s.id === id);
}

// a decision's provenance, resolved from its `decided` edge: who recorded it, which section it's anchored to,
// and whether it's been verified. Powers the decision peek.
export function decisionMeta(decisionId: string) {
  const e = edges.find((x) => x.type === "decided" && x.to === decisionId);
  if (!e) return { by: undefined as Person | undefined, anchor: undefined as string | undefined, anchorId: undefined as string | undefined, verified: false };
  const anchorId = e.anchor;
  const anchor = anchorId ? getBlocks(e.from).find((b) => b.id === anchorId)?.heading : undefined;
  return {
    by: e.created_by ? personById(e.created_by) : undefined,
    anchor,
    anchorId,
    verified: e.prov === "human_verified",
  };
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
  // the excerpt IS the answer (the doc's own words); the cited sections + link carry "from where", so we
  // don't prepend a "From X and Y —" frame that collides when the excerpt itself opens with "From".
  const answer = excerpt || (lead ? `Woven wove this from ${lead}.` : "Nothing in this artifact matches that yet.");
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

  // the version relationship — an old version reads "superseded by v3", the current one "supersedes v2".
  // Surfaces graph value on cards that have no collection/people/source links (e.g. a kept prior version).
  const supBy = edges.find((e) => e.to === id && e.type === "supersedes");
  const supersedes = edges.find((e) => e.from === id && e.type === "supersedes");
  if (supBy) {
    const m = labelOf(supBy.from).match(/\bv\d+\b/i);
    out2.push({ kind: "version", label: m ? `superseded by ${m[0]}` : "superseded" });
  } else if (supersedes) {
    const m = labelOf(supersedes.to).match(/\bv\d+\b/i);
    out2.push({ kind: "version", label: m ? `supersedes ${m[0]}` : "supersedes prior" });
  }

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

// who you are, for routing "your call" vs "the team's" in the Inbox. (A real build reads the session.)
export const VIEWER = "pe_maya";

// The showcase Ask questions — the FIRST thing a new ⌘K user is invited to try. Each is chosen to land on a
// DIFFERENT honest answer behavior (so one click reveals the range), and each is verified against the real
// engine (no cross-doc synthesis over-promises — see route.ts harness):
//   1. cited single-doc answer (askArtifact)  → "From nine first-run steps to four" · cites [Cuts, Agent assist]
//   2. owner lookup (deriveOwners → People)    → Jordan / Maya / Sara across the Launch topic
//   3. graph neighborhood (askGraph + Branch)  → the four things linked to the Q4 launch
// Shared by the ⌘K zero-state and the Today foot so the invitation never drifts from what actually answers.
export const ASK_SUGGESTIONS = [
  "What changed in the onboarding revamp?",
  "Who owns the launch?",
  "What's connected to the Q4 launch?",
];

// each suggestion + a DERIVED one-line grounding (what the question actually lands on) so the ⌘K zero-state
// doesn't just list questions — it shows why each is worth asking + hints its path (cited doc / people / graph
// + the verify-in-place moment). Counts read off the live graph, so the invitation never overstates what answers.
export function askSuggestions(): { q: string; sub: string }[] {
  const owners = deriveOwners("to_launch").length;
  const rels = nodeRelations("to_launch");
  const pending = rels.filter((r) => r.prov === "ai_generated").length;
  const onbChanges = episodes.filter((e) => e.artifactId === "a_onboarding").length;
  return [
    { q: ASK_SUGGESTIONS[0], sub: onbChanges ? `Cited from the onboarding notes · ${onbChanges} change${onbChanges === 1 ? "" : "s"} logged` : "Cited straight from the onboarding notes" },
    { q: ASK_SUGGESTIONS[1], sub: `${owners} people across the launch docs` },
    { q: ASK_SUGGESTIONS[2], sub: pending ? `${rels.length} links · ${pending} still proposed to confirm` : `${rels.length} links across its web` },
  ];
}

// the collection that governs a change about `artifactId` — the first (in the doc's OWN collection order) that
// has an owner, else the doc's first collection. This is the workstream stamp the Inbox shows on the change.
export function governingCollection(artifactId: string): Collection | undefined {
  const a = getArtifact(artifactId);
  if (!a) return undefined;
  for (const cid of a.collection_ids) {
    const c = collections.find((x) => x.id === cid);
    if (c?.owner_id) return c;
  }
  return a.collection_ids.length ? collections.find((x) => x.id === a.collection_ids[0]) : undefined;
}

// the person who holds the approve for a change about `artifactId`: its governing collection's owner, else the
// doc's human author, else the viewer. This is the default "whose call" — before any claim (see effectiveOwner).
export function changeOwner(artifactId: string): string {
  const c = governingCollection(artifactId);
  if (c?.owner_id) return c.owner_id;
  const a = getArtifact(artifactId);
  if (a?.author_id && a.author_id !== "agent") return a.author_id;
  return VIEWER;
}

// "take over" from the colleague monitor — you claim a change a teammate owns, pulling it into your Decisions.
// Session-scoped set of change ids (edge_id / suggestion id) the viewer has claimed.
const claimedChanges = new Set<string>();
export function claimChange(changeId: string): void {
  claimedChanges.add(changeId);
  bumpGraph();
}
export function unclaimChange(changeId: string): void {
  claimedChanges.delete(changeId);
  bumpGraph();
}
// the owner a change ROUTES to right now: the viewer if they've claimed it, otherwise its collection owner.
// Both the Decisions stream ("mine") and the colleague monitor read routing through this.
export function effectiveOwner(changeId: string, artifactId: string): string {
  return claimedChanges.has(changeId) ? VIEWER : changeOwner(artifactId);
}

// ─── judgment capture ──────────────────────────────────────────────────────────────────────────────────────
// The Vercel "teaching agents" loop, scoped small. As you decide, we tally each decision by its OBSERVABLE
// shape (relation × collection × confirm|dismiss). When a shape is confirmed consistently, it's a candidate you
// can PROMOTE to an auto-rule — Woven then handles that shape itself and just tells you. Rules are listed +
// revocable in Governance, so Decisions (where judgment is made) and Governance (where it's codified) are two
// ends of one loop.
type DecisionTally = { edgeType: EdgeType; collectionId: string; confirmed: number; dismissed: number };
const decisionTally: DecisionTally[] = [
  // seeded prior judgment — you've already confirmed several "links to" in Q4 Roadmap, so a candidate is ripe
  { edgeType: "links_to", collectionId: "co_q4", confirmed: 4, dismissed: 0 },
];
const learnedRules: LearnedRule[] = [
  // EARNED — promoted from your own consistent decisions; carried with track record so the ledger shows why it's trusted.
  { id: "lr_seed_mentions_growth", edgeType: "mentions", collectionId: "co_growth", origin: "earned", confirmed: 5, createdAt: "6d ago", active: true, mode: "auto", autoConfirmed: 12, undone: 1, paused: false },
  { id: "lr_seed_sources_research", edgeType: "sourced_from", collectionId: "co_research", origin: "earned", confirmed: 4, createdAt: "3d ago", active: true, mode: "auto", autoConfirmed: 5, undone: 0, paused: false },
  // GRANTED — you told Woven directly (the structured successor to free-text instructions). A grant may set either
  // posture: trust it now (auto) or keep watching (suggest) — "keep Growth links as proposals" is a granted WATCH.
  { id: "lr_grant_file_growth", edgeType: "in_collection", collectionId: "co_growth", origin: "granted", confirmed: 0, createdAt: "Jun 28", active: true, mode: "auto", autoConfirmed: 6, undone: 0, paused: false },
  { id: "lr_grant_links_growth", edgeType: "links_to", collectionId: "co_growth", origin: "granted", confirmed: 0, createdAt: "Jul 3", active: true, mode: "suggest", autoConfirmed: 0, undone: 0, paused: false },
];
let ruleSeq = 0; // sequential ids for responsibilities you grant this session
// the confirmed decisions that formed each EARNED rule — the provenance behind "From your Decisions · learned from N".
// Prototype-seeded (like the trajectory); a runtime-promoted rule would carry promoteRule()'s confirmed edges here.
const ruleSourceDecisions: Record<string, SourceDecision[]> = {
  lr_seed_mentions_growth: [
    { id: "sd_m1", artifactId: "a_notif", artifactTitle: "Notification Strategy v3", line: "mentions Maya Chen", at: "Jun 20" },
    { id: "sd_m2", artifactId: "a_press", artifactTitle: "Press Outreach — Q4", line: "mentions Theo Novak", at: "Jun 12" },
    { id: "sd_m3", artifactId: "a_notif", artifactTitle: "Notification Strategy v3", line: "mentions the Launch topic", at: "Jun 8" },
    { id: "sd_m4", artifactId: "a_onboarding", artifactTitle: "Onboarding revamp notes", line: "mentions Dan Lee", at: "Jun 3" },
    { id: "sd_m5", artifactId: "a_press", artifactTitle: "Press Outreach — Q4", line: "mentions Ana Sridhar", at: "May 28" },
  ],
  lr_seed_sources_research: [
    { id: "sd_s1", artifactId: "a_research", artifactTitle: "Customer Research — Q1", line: "sourced from the interview transcripts", at: "Jun 18" },
    { id: "sd_s2", artifactId: "a_research", artifactTitle: "Customer Research — Q1", line: "sourced from the pricing survey", at: "Jun 10" },
    { id: "sd_s3", artifactId: "a_research", artifactTitle: "Customer Research — Q1", line: "sourced from the support audit", at: "May 30" },
    { id: "sd_s4", artifactId: "a_research", artifactTitle: "Customer Research — Q1", line: "sourced from the onboarding calls", at: "May 22" },
  ],
};
export function sourceDecisionsForRule(ruleId: string): SourceDecision[] {
  return ruleSourceDecisions[ruleId] ?? [];
}
// the human label for a responsibility's capability — SHARED so the ledger (Governance) and the run ties (Activity)
// name the same thing the same way (one loop, one vocabulary).
export const RULE_CAPABILITY: Record<EdgeType, string> = {
  links_to: "Connect related docs",
  in_collection: "File into this area",
  mentions: "Note who's mentioned",
  sourced_from: "Trace sources",
  authored_by: "Attribute authorship",
  decided: "Log decisions",
  supersedes: "Track supersessions",
};
// the trusted responsibility a run acted under (set when Woven ran it autonomously) — the Activity→Governance tie.
export function ruleForRun(run: AgentRun): LearnedRule | undefined {
  return run.ruleId ? learnedRules.find((r) => r.id === run.ruleId && r.active) : undefined;
}
export function responsibilityLabel(rule: LearnedRule): string {
  const c = collectionById(rule.collectionId);
  return c ? `${RULE_CAPABILITY[rule.edgeType]} · ${c.name}` : RULE_CAPABILITY[rule.edgeType];
}
// the earned-trust TRAJECTORY — what Woven handled for you each week, with corrections. The point the ledger
// snapshot can't make: trust is EARNED over time (handled climbs, corrections stay near zero). Prototype-seeded
// but kept consistent with the live totals — handled sums to 23, corrections to 1 (= the rollup's numbers).
const trustActivity: WeeklyTrust[] = [
  { week: "May 19", handled: 1, corrected: 0 },
  { week: "May 26", handled: 1, corrected: 1 },
  { week: "Jun 2", handled: 2, corrected: 0 },
  { week: "Jun 9", handled: 2, corrected: 0 },
  { week: "Jun 16", handled: 3, corrected: 0 },
  { week: "Jun 23", handled: 4, corrected: 0 },
  { week: "Jun 30", handled: 4, corrected: 0 },
  { week: "Jul 7", handled: 6, corrected: 0 },
];
const ignoredPromotable = new Set<string>();
const PROMOTE_AT = 3; // a shape confirmed this many times, never dismissed, is promotable
const AUTO_CONFIRM_FLOOR = 0.7; // an active rule auto-confirms an arriving edge only AT/ABOVE this confidence
const ruleKey = (edgeType: string, collectionId: string) => `${edgeType}·${collectionId}`;

// Forward interception (doctrine: woven/doctrine/auto-rule-scope). A freshly-proposed ai_generated edge that
// matches an ACTIVE learned rule (relation × governing collection) AND clears the confidence floor is
// auto-confirmed ON ARRIVAL — told-not-asked, never entering the Verify queue; below the floor it stays pending
// for the human. Confidence can only WITHHOLD, never grant — the human's promotion is the sole consent. Mutates
// the edge in place; returns true if it auto-confirmed (so the caller counts only what stayed pending). Every
// proposal-creation path routes its new edges through this.
function admitProposedEdge(edge: Edge): boolean {
  if (edge.prov !== "ai_generated") return false;
  const co = governingCollection(edge.from);
  if (!co) return false; // an un-filed doc has no governing collection → no rule can apply
  // only an active, non-paused, AUTO-mode rule intercepts; a suggest-mode or paused rule leaves it for the human
  const rule = learnedRules.find(
    (r) => r.active && !r.paused && r.mode === "auto" && r.edgeType === edge.type && r.collectionId === co.id,
  );
  if (!rule) return false;
  if ((edge.confidence ?? 0) < AUTO_CONFIRM_FLOOR) return false; // veto: too shaky, keep the human on it
  edge.prov = "human_verified";
  rule.autoConfirmed += 1; // the rule's visible track record in Governance
  recordEpisode({
    artifactId: edge.from,
    kind: "confirmed",
    actor: VIEWER, // attributed to the human who promoted the rule (confirm-is-episode still holds)
    at: "now",
    summary: `Auto-confirmed ${edge.type.replace(/_/g, " ")} · your ${co.name} rule`,
    edgeId: edge.id,
  });
  return true;
}

function tallyFor(edgeType: EdgeType, collectionId: string): DecisionTally {
  let t = decisionTally.find((x) => x.edgeType === edgeType && x.collectionId === collectionId);
  if (!t) {
    t = { edgeType, collectionId, confirmed: 0, dismissed: 0 };
    decisionTally.push(t);
  }
  return t;
}

// record a decision's shape (called by the Inbox on confirm/dismiss of an edge). Dismissing breaks a shape's
// "always confirmed" streak, so it stops being a candidate — judgment has to be CONSISTENT to earn automation.
export function recordDecision(
  edgeType: EdgeType,
  collectionId: string | undefined,
  action: "confirm" | "discard",
): void {
  if (!collectionId) return;
  const t = tallyFor(edgeType, collectionId);
  if (action === "confirm") t.confirmed += 1;
  else t.dismissed += 1;
}

export type PromotableRule = { edgeType: EdgeType; collectionId: string; collectionName: string; confirmed: number };

// the shapes you've earned the right to automate: consistently confirmed (never dismissed), at threshold, not
// already a rule, not dismissed for this session.
export function listPromotable(): PromotableRule[] {
  return decisionTally
    .filter((t) => t.confirmed >= PROMOTE_AT && t.dismissed === 0)
    .filter((t) => !learnedRules.some((r) => r.active && r.edgeType === t.edgeType && r.collectionId === t.collectionId))
    .filter((t) => !ignoredPromotable.has(ruleKey(t.edgeType, t.collectionId)))
    .map((t) => ({
      edgeType: t.edgeType,
      collectionId: t.collectionId,
      collectionName: collections.find((c) => c.id === t.collectionId)?.name ?? "a collection",
      confirmed: t.confirmed,
    }));
}
export function ignorePromotable(edgeType: EdgeType, collectionId: string): void {
  ignoredPromotable.add(ruleKey(edgeType, collectionId));
  bumpGraph();
}

// promote a shape to an auto-rule: record it (with its evidence count), then immediately clear the pending
// changes of that shape by confirming them — visible automation, not a promise. Returns the auto-confirmed
// edges so the Inbox can drop them from the queue.
export function promoteRule(edgeType: EdgeType, collectionId: string): { ruleId: string; confirmed: Edge[] } {
  const t = tallyFor(edgeType, collectionId);
  // clear the shape's current pending first, then record the rule with that batch as its opening track record
  const matching = listPending().filter(
    (p) => p.type === edgeType && governingCollection(p.fromId)?.id === collectionId,
  );
  const confirmed = matching
    .map((p) => verifyEdge(p.edge_id, "confirm", VIEWER))
    .filter((e): e is Edge => Boolean(e));
  const ruleId = `lr_${edgeType}_${collectionId}_${learnedRules.length}`;
  learnedRules.push({
    id: ruleId,
    edgeType,
    collectionId,
    origin: "earned",
    confirmed: t.confirmed,
    createdAt: "just now",
    active: true,
    mode: "auto",
    autoConfirmed: confirmed.length,
    undone: 0,
    paused: false,
  });
  bumpGraph();
  return { ruleId, confirmed };
}
// a correction — you undid what a rule did, so it PAUSES (stays a rule, stops acting) until you review it in
// Governance. Correction is teaching too: a rule that over-reached should stop and let the human back in.
export function pauseRule(id: string, corrections = 1): void {
  const r = learnedRules.find((x) => x.id === id);
  if (r) {
    r.paused = true;
    r.undone += corrections;
    bumpGraph();
  }
}
export function revokeRule(id: string): void {
  const r = learnedRules.find((x) => x.id === id);
  if (r) {
    r.active = false;
    bumpGraph();
  }
}
// the per-rule dial: auto = auto-confirms matching arrivals; suggest = still pre-groups them but asks
export function setRuleMode(id: string, mode: "auto" | "suggest"): void {
  const r = learnedRules.find((x) => x.id === id);
  if (r) {
    r.mode = mode;
    bumpGraph();
  }
}
// clear the auto-pause after you've reviewed the correction that tripped it
export function resumeRule(id: string): void {
  const r = learnedRules.find((x) => x.id === id);
  if (r) {
    r.paused = false;
    bumpGraph();
  }
}
// ── the trust ledger (Governance) ──────────────────────────────────────────────────────────────────────────
// A responsibility's TRUST STATE is derived, never a separate field: paused → held back (you corrected it);
// mode "auto" → trusted here (it acts and tells you); mode "suggest" → watching (it proposes, you decide).
// Earned rules climb to trusted by your confirms; granted rules sit at whatever posture you set. One ladder.
export type TrustState = "trusted" | "watching" | "held_back";
export function ruleTrust(r: LearnedRule): TrustState {
  if (r.paused) return "held_back";
  return r.mode === "auto" ? "trusted" : "watching";
}

export type AreaHealth = { trusted: number; watching: number; held_back: number; handled: number };
export type AreaResponsibilities = { collection: Collection; rules: LearnedRule[]; health: AreaHealth };
// the ledger grouped by AREA (collection) — the scale spine. Areas with delegated responsibilities come back in
// `areas` (busiest first); collections with none are returned in `watching` so the UI folds them into one line
// instead of padding the page. Within an area, granted responsibilities list before earned (you set them by hand).
export function listResponsibilitiesByArea(): { areas: AreaResponsibilities[]; watching: Collection[] } {
  const active = learnedRules.filter((r) => r.active);
  const areas: AreaResponsibilities[] = [];
  const watching: Collection[] = [];
  for (const c of collections) {
    const rules = active
      .filter((r) => r.collectionId === c.id)
      .sort((a, b) => (a.origin === b.origin ? 0 : a.origin === "granted" ? -1 : 1));
    if (!rules.length) {
      watching.push(c);
      continue;
    }
    const health: AreaHealth = { trusted: 0, watching: 0, held_back: 0, handled: 0 };
    for (const r of rules) {
      health[ruleTrust(r)] += 1;
      health.handled += r.autoConfirmed;
    }
    areas.push({ collection: c, rules, health });
  }
  areas.sort((a, b) => b.rules.length - a.rules.length || b.health.handled - a.health.handled);
  return { areas, watching };
}

export type LedgerRollup = { areas: number; trusted: number; watching: number; held_back: number; handled: number; undone: number };
// the "state of the delegation" at a glance — what scale needs on top of the ledger.
export function ledgerRollup(): LedgerRollup {
  const active = learnedRules.filter((r) => r.active);
  const areaIds = new Set(active.map((r) => r.collectionId));
  const roll: LedgerRollup = { areas: areaIds.size, trusted: 0, watching: 0, held_back: 0, handled: 0, undone: 0 };
  for (const r of active) {
    roll[ruleTrust(r)] += 1;
    roll.handled += r.autoConfirmed;
    roll.undone += r.undone;
  }
  return roll;
}

// the trust trajectory — handled/corrected per week (oldest → newest), for the delegation panel's sparkline.
export type WeeklyTrust = { week: string; handled: number; corrected: number };
export function trustTrajectory(): WeeklyTrust[] {
  return trustActivity;
}

// grant Woven a responsibility DIRECTLY (the structured successor to free-text instructions): a capability
// (relation) × an area (collection) × the posture you want it to start at. Same object as a learned rule, only
// origin "granted" — so it flows through the same interception, correction-pause and revoke machinery.
export function grantResponsibility(edgeType: EdgeType, collectionId: string, posture: "trusted" | "watching"): string {
  const id = `lr_grant_${edgeType}_${collectionId}_${++ruleSeq}`;
  learnedRules.push({
    id,
    edgeType,
    collectionId,
    origin: "granted",
    confirmed: 0,
    createdAt: "just now",
    active: true,
    mode: posture === "trusted" ? "auto" : "suggest",
    autoConfirmed: 0,
    undone: 0,
    paused: false,
  });
  bumpGraph();
  return id;
}

export function listActivity(): Activity[] {
  return activity;
}

// the "Needs you" tier above the Recent feed on Today — derived (not stored) from the two things that
// pull a user in: the agent's proposed links (verify) and living artifacts gone stale (review). Decisions
// still happen in the Inbox / the artifact; this is the catch-up preview.
// The single source of truth for "what needs you" — every attention item across the app, so the Inbox
// badge and the Today "Needs you" tier are two views of one list (not parallel derivations).
export function needsYou(): NeedItem[] {
  const out: NeedItem[] = [];
  const stale = new Set<string>();

  // 1. stale — a living doc whose source moved under it (Review)
  for (const a of artifacts) {
    if (a.staleness) {
      stale.add(a.id);
      out.push({
        id: `need_stale_${a.id}`,
        kind: "stale",
        title: a.title,
        sub: `source “${a.staleness.source_label}” changed ${a.staleness.since}`,
        href: `/artifact/${a.id}`,
        action: "Review",
      });
    }
  }

  // 2. the agent's proposed links, grouped by source (Verify) — skip ones already flagged stale
  const byFrom = new Map<string, { label: string; n: number }>();
  for (const p of listPending()) {
    if (stale.has(p.fromId)) continue;
    const cur = byFrom.get(p.fromId) ?? { label: p.fromLabel, n: 0 };
    cur.n += 1;
    byFrom.set(p.fromId, cur);
  }
  for (const [fromId, { label, n }] of byFrom) {
    out.push({
      id: `need_prop_${fromId}`,
      kind: "proposal",
      title: label,
      sub: `Woven proposed ${n} link${n > 1 ? "s" : ""} to verify`,
      href: "/inbox",
      action: "Verify",
    });
  }

  // 3. smart-collection gathers awaiting approval, grouped by collection (Review)
  const byCol = new Map<string, { name: string; slug: string; n: number }>();
  for (const c of listCollectionCandidates()) {
    const co = collections.find((x) => x.id === c.collectionId);
    const cur = byCol.get(c.collectionId) ?? { name: c.collectionName, slug: co?.slug ?? "", n: 0 };
    cur.n += 1;
    byCol.set(c.collectionId, cur);
  }
  for (const [colId, { name, slug, n }] of byCol) {
    out.push({
      id: `need_cand_${colId}`,
      kind: "candidate",
      title: name,
      sub: `Woven gathered ${n} artifact${n > 1 ? "s" : ""} to review`,
      href: `/collection/${slug}`,
      action: "Review",
    });
  }

  // 4. fresh captures the agent needs a decision on (Review)
  for (const cr of listCaptureReviews()) {
    out.push({
      id: `need_cap_${cr.id}`,
      kind: "capture",
      title: cr.title,
      sub: cr.detail,
      href: "/inbox",
      action: "Review",
    });
  }

  return out;
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
  persistState();
  return c;
}

// file existing artifacts into a collection — backs the "Add documents" picker (collection page + create flow)
export function addArtifactsToCollection(collectionId: string, artifactIds: string[]): void {
  for (const id of artifactIds) {
    const a = artifacts.find((x) => x.id === id);
    if (a && !a.collection_ids.includes(collectionId)) a.collection_ids.push(collectionId);
  }
  persistState();
}

// un-file an artifact from a collection — backs the "Add to collection" toggle + member removal on the
// collection page. The inverse of a single addArtifactsToCollection entry.
export function removeArtifactFromCollection(collectionId: string, artifactId: string): void {
  const a = artifacts.find((x) => x.id === artifactId);
  if (a) a.collection_ids = a.collection_ids.filter((id) => id !== collectionId);
  // drop it from the curated order too, so a later re-add appends instead of resurrecting its old slot
  const co = collections.find((c) => c.id === collectionId);
  if (co?.member_order) co.member_order = co.member_order.filter((id) => id !== artifactId);
  persistState();
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
  persistState(); // persist the flag + slug so /a/[slug] survives reload (hydrateState restores p/h)
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
  persistState();
}

// ——————————————————————————————————————————— client persistence (prototype)
// The in-memory store resets on every page load. To make a published collection resolve at /c across
// reloads and new tabs (same browser), snapshot the mutable bits — collections + per-artifact
// membership/publish — to localStorage on each mutation, then re-apply on the client (StoreHydrator + /c).
const PERSIST_KEY = "woven:state:v1";

function persistState() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({
        collections,
        members: artifacts.map((a) => ({ id: a.id, c: a.collection_ids, p: a.public, h: a.hub_slug ?? null })),
      }),
    );
  } catch {
    /* storage unavailable — fall back to in-session state */
  }
}

export function hydrateState() {
  if (typeof window === "undefined") return;
  let snap:
    | { collections: typeof collections; members: { id: string; c: string[]; p: boolean; h: string | null }[] }
    | null = null;
  try {
    const raw = localStorage.getItem(PERSIST_KEY);
    snap = raw ? JSON.parse(raw) : null;
  } catch {
    snap = null;
  }
  if (!snap) return;
  for (const pc of snap.collections) {
    const existing = collections.find((c) => c.id === pc.id);
    if (existing) Object.assign(existing, pc);
    else collections.push(pc);
  }
  for (const m of snap.members) {
    const a = artifacts.find((x) => x.id === m.id);
    if (a) {
      a.collection_ids = m.c;
      a.public = m.p;
      a.hub_slug = m.h ?? undefined;
    }
  }
}

// archive artifacts — the bulk "Archive" action; sets state so they drop out of the working Library.
export function archiveArtifacts(ids: string[]): void {
  for (const id of ids) {
    const a = artifacts.find((x) => x.id === id);
    if (a) a.state = "archived";
  }
  bumpGraph();
}

// merge two duplicate artifacts (the Inbox "Merge" valve). Folds ALL of the loser's relationships onto
// the survivor and archives the loser, leaving no dangling reference to it. Symmetric — the caller picks
// which id survives as canonical. The loser's connections live in three places, all reconciled here:
//   • collection_ids (a field on the artifact) → unioned + deduped onto the survivor
//   • decisions' artifact_id backref + collections' public_member_ids → repointed to the survivor
//   • edges (links · sources · people · decisions · topics) → every edge referencing the loser is
//     repointed to the survivor; a self-edge the repoint creates (e.g. a supersedes between the two) is
//     dropped, and edges that collapse to the same (type · from · to) are deduped, keeping the more
//     trusted prov (a human_verified edge wins over a still-pending ai_generated one).
export function mergeArtifacts(survivorId: string, loserId: string): void {
  if (survivorId === loserId) return;
  const survivor = artifacts.find((a) => a.id === survivorId);
  const loser = artifacts.find((a) => a.id === loserId);
  if (!survivor || !loser) return;

  // 1. union collection membership onto the survivor
  for (const cid of loser.collection_ids) {
    if (!survivor.collection_ids.includes(cid)) survivor.collection_ids.push(cid);
  }

  // 2. keep the decision backref in sync (the `decided` edges are repointed in step 4)
  for (const d of decisions) {
    if (d.artifact_id === loserId) d.artifact_id = survivorId;
  }

  // 3. no dangling published reference — repoint the loser out of every public-member list
  for (const c of collections) {
    if (c.public_member_ids.includes(loserId)) {
      c.public_member_ids = [...new Set(c.public_member_ids.map((id) => (id === loserId ? survivorId : id)))];
    }
  }

  // 4. repoint + dedupe every edge that touches the loser
  const rank = (p: Edge["prov"]) => (p === "ai_generated" ? 0 : 1);
  const byKey = new Map<string, Edge>();
  for (const e of edges) {
    const from = e.from === loserId ? survivorId : e.from;
    const to = e.to === loserId ? survivorId : e.to;
    if (from === to) continue; // self-edge from the repoint (e.g. survivor supersedes loser) — drop it
    const moved: Edge = from === e.from && to === e.to ? e : { ...e, from, to };
    const key = `${moved.type}|${from}|${to}`;
    const existing = byKey.get(key);
    if (!existing || rank(moved.prov) > rank(existing.prov)) byKey.set(key, moved);
  }
  edges.length = 0;
  edges.push(...byKey.values());

  // 5. archive the loser (same state change as archiveArtifacts)
  loser.state = "archived";

  bumpGraph();
  persistState();
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
    const id = `cand_${c.id}_${a.id}`;
    if (collectionCandidates.some((x) => x.id === id)) continue; // idempotent — safe to re-run on rescan
    collectionCandidates.push({
      id,
      collectionId: c.id,
      collectionName: c.name,
      artifactId: a.id,
      artifactTitle: a.title,
      rationale: hit ? `Mentions “${hit}” — fits your rule` : `Looks related to ${c.name}`,
    });
  }
}

// re-run the agent's gather for a smart collection — surfaces any new matches as fresh candidates. Idempotent
// (never duplicates ones already pending); returns how many NEW candidates it found, for the toast.
export function rescanCollection(slug: string): number {
  const c = collectionBySlug(slug);
  const mine = () => collectionCandidates.filter((x) => x.collectionId === c.id).length;
  const before = mine();
  generateCollectionCandidates(c);
  return mine() - before;
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
    persistState(); // filing via the Inbox/Approve valve must survive reload, same as addArtifactsToCollection
  }
  bumpGraph();
  return cand;
}

// undo a resolve — re-insert the candidate, and if it had been added, un-file the artifact.
export function restoreCollectionCandidate(cand: CollectionCandidate, wasAdded: boolean): void {
  if (wasAdded) {
    const a = artifacts.find((x) => x.id === cand.artifactId);
    if (a) a.collection_ids = a.collection_ids.filter((id) => id !== cand.collectionId);
    persistState(); // mirror the resolve() persist so the undo survives reload too
  }
  collectionCandidates.unshift(cand);
  bumpGraph();
}
export function collectionMembers(slug: string): Artifact[] {
  const co = collectionBySlug(slug);
  const members = artifacts.filter((a) => a.collection_ids.includes(co.id));
  const order = co.member_order;
  if (!order || order.length === 0) return members;
  // curated order first (by rank); anything not in the list keeps its default position after
  const rank = new Map(order.map((id, i) => [id, i]));
  return members
    .map((a, i) => ({ a, i }))
    .sort((x, y) => (rank.get(x.a.id) ?? order.length + x.i) - (rank.get(y.a.id) ?? order.length + y.i))
    .map(({ a }) => a);
}

// curate the member order (drag-to-reorder on the collection page). Persists on the collection so the
// order survives reloads; ids not passed keep their default position after the curated ones.
export function reorderCollectionMembers(slug: string, orderedIds: string[]): void {
  const co = collectionBySlug(slug);
  co.member_order = orderedIds;
  persistState();
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

// The one number the DECISIONS TAB promises: how many decisions THIS viewer must make — exactly the rows the
// Decisions section renders (pending edges + open suggestions the viewer owns, plus their own capture reviews),
// so badge === list (design-rule woven/component/count-badge). The sidebar Inbox badge is a SUPERSET of this —
// see inboxBadgeCount, which also stands for the Activity tab. pendingCount() above is the owner-blind store
// total and must NOT gate a viewer-facing badge.
export function inboxDecisionCount(viewer: string = VIEWER): number {
  const edgesMine = listPending().filter((p) => effectiveOwner(p.edge_id, p.fromId) === viewer).length;
  const sugsMine = listOpenSuggestions().filter((s) => effectiveOwner(s.id, s.artifactId) === viewer).length;
  return edgesMine + sugsMine + listCaptureReviews().length;
}

// The sidebar Inbox badge stands for the WHOLE console, so it sums the viewer-actionable rows of every Inbox tab
// that has them: Decisions (inboxDecisionCount) + the agent runs the viewer is personally blocking (Activity's
// needs_you rows, needsYouRunCount). It is deliberately a SUPERSET of the Decisions-tab badge — a run you're
// blocking would otherwise hide behind the Decisions-only count. Still a summed selector over rendered rows,
// never a raw store total (design-rule woven/component/count-badge). A decision surfaced in BOTH tabs counts
// once per tab by design (per-surface rows), matching each tab's own badge.
export function inboxBadgeCount(viewer: string = VIEWER): number {
  return inboxDecisionCount(viewer) + needsYouRunCount();
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

export function verifyEdge(id: string, action: "confirm" | "discard", actor: string = "pe_maya"): Edge | undefined {
  const i = edges.findIndex((e) => e.id === id);
  if (i < 0) return undefined;
  const prev = edges[i];
  if (action === "discard") {
    edges.splice(i, 1);
  } else {
    edges[i] = { ...prev, prov: "human_verified" };
    // THE CONFIRM-EVENT IS AN EPISODE — verifying a proposed edge writes the semantic change (prov →
    // human_verified, above) and its episodic record in one flow. This is the single confirm path for edges
    // (both the artifact-page Verify card and the Inbox verify queue call verifyEdge), so hooking it here
    // covers both. Actor is Maya, the demo's confirming PM. The episode hangs off whichever end is an
    // artifact (proposed links_to run artifact → target).
    const artifactId = kindOf(prev.from) === "artifact" ? prev.from : prev.to;
    const other = artifactId === prev.from ? prev.to : prev.from;
    recordEpisode({
      artifactId,
      kind: "confirmed",
      actor, // whoever confirmed — defaults to Maya (the demo PM) but the search can attribute the real actor
      at: "now",
      summary: gLabel(other), // terse — the "Confirmed" label in the Story carries the kind
      edgeId: prev.id,
      blockId: prev.anchor,
    });
  }
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

// ——————————————————————————————————————————— episodic memory (the narrative over the graph)
// The complement to the semantic graph: the time-stamped "what happened, when, who, why". The confirm-event
// (verifyEdge, above) is the join point — confirming an edge writes a "confirmed" episode carrying that
// edgeId, so the semantic and episodic records share one flow.

let episodeSeq = 0;

// an artifact's episodes, chronological (oldest first) — the caller reverses for a newest-first feed.
export function artifactEpisodes(artifactId: string): Episode[] {
  return episodes.filter((e) => e.artifactId === artifactId);
}

// parse a relative time label ("now" / "17m" / "2h" / "3d") to minutes-ago, for ordering across artifacts
export function agoMinutes(at: string): number {
  if (at === "now") return 0;
  const m = at.match(/^(\d+)\s*(m|h|d)$/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const n = Number(m[1]);
  return m[2] === "m" ? n : m[2] === "h" ? n * 60 : n * 1440;
}

// the Inbox "catch-up" feed — recent episodes across the whole space, EXCLUDING the viewer's own actions
// (you don't catch up on what you did), newest-first. The cross-space complement to a doc's StoryStrip.
export function recentEpisodes(limit = 6, viewer = "pe_maya"): Episode[] {
  return episodes
    .filter((e) => e.actor !== viewer)
    .slice()
    .sort((a, b) => agoMinutes(a.at) - agoMinutes(b.at))
    .slice(0, limit);
}

// a person's own recent episodes across ALL artifacts — the context-free person peek (a Find result has no
// single artifact to scope to). Newest-first, each carrying the artifact it touched.
export function personEpisodes(
  personId: string,
  limit = 3,
): { summary: string; at: string; artifactTitle: string }[] {
  return episodes
    .filter((e) => e.actor === personId)
    .slice()
    .sort((a, b) => agoMinutes(a.at) - agoMinutes(b.at))
    .slice(0, limit)
    .map((e) => ({ summary: e.summary, at: e.at, artifactTitle: getArtifact(e.artifactId)?.title ?? "an artifact" }));
}

// append an episode (assigning an id if missing). Session-scoped in-memory like archiveArtifacts /
// mergeArtifacts — episodes are NOT snapshotted to persistState (they'd need the schema extended), so they
// live only for the session, same as the other narrative mutations.
export function recordEpisode(e: Omit<Episode, "id"> & { id?: string }): void {
  episodes.push({ ...e, id: e.id ?? `ep_new_${++episodeSeq}` });
  bumpGraph();
}

// the durable, human-fingerprinted record on a verified edge — WHO confirmed it, WHEN. The confirm wrote a
// "confirmed" episode carrying the edgeId (verifyEdge → recordEpisode), so a verified link is not just solid,
// it REMEMBERS the gesture that made it trusted — the ledger no plain graph/notes tool produces. Returns null
// for edges verified without an episode (seed data), so only real gestures carry a stamp.
export function edgeConfirmation(edgeId: string): { name: string; seed: string; at: string } | null {
  const ep = [...episodes].reverse().find((e) => e.kind === "confirmed" && e.edgeId === edgeId);
  if (!ep) return null;
  const name = ep.actor === "agent" ? "Woven" : personById(ep.actor)?.name ?? "Someone";
  return { name, seed: ep.actor, at: ep.at };
}

// ——————————————————————————————————————————— discussions (durable, rebuilt from ephemeral chat)
// Comments persist as Discussion objects instead of transient chat. A `decision`-tagged thread is the
// provenance for a decision. All mutations bumpGraph(); like episodes they are session-scoped (in-memory,
// not persistState) — consistent with the archive/merge pattern.

let discussionSeq = 0;
let commentSeq = 0;

export function listDiscussions(artifactId: string): Discussion[] {
  return discussions.filter((d) => d.artifactId === artifactId);
}

export function discussionsForBlock(artifactId: string, blockId: string): Discussion[] {
  return discussions.filter((d) => d.artifactId === artifactId && d.blockId === blockId);
}

export function openDiscussionCount(artifactId: string): number {
  return discussions.filter((d) => d.artifactId === artifactId && d.status === "open").length;
}

// start a thread — opens with its author as the first participant and no comments yet.
export function startDiscussion(input: {
  artifactId: string;
  blockId?: string;
  tag?: DiscussionTag;
  title: string;
  author: string;
}): Discussion {
  const d: Discussion = {
    id: `dis_${++discussionSeq}`,
    artifactId: input.artifactId,
    blockId: input.blockId,
    status: "open",
    tag: input.tag,
    title: input.title,
    participants: [input.author],
    createdAt: "now",
    comments: [],
  };
  discussions.push(d);
  bumpGraph();
  return d;
}

// add a comment (or a suggestion — a before/after on a block) to a thread; keeps the participant set current.
export function addComment(
  discussionId: string,
  input: { author: string; text: string; kind?: CommentKind; suggestion?: { blockId: string; before: string; after: string } },
): void {
  const d = discussions.find((x) => x.id === discussionId);
  if (!d) return;
  const c: Comment = {
    id: `cm_new_${++commentSeq}`,
    author: input.author,
    text: input.text,
    at: "now",
    kind: input.kind ?? "comment",
    suggestion: input.suggestion,
  };
  d.comments.push(c);
  if (!d.participants.includes(input.author)) d.participants.push(input.author);
  bumpGraph();
}

// settle a thread — flips it to resolved AND writes a "resolved" episode (settling a discussion is an
// episode, same as confirming an edge). No resolver is passed, so the demo attributes it to Maya, the PM.
export function resolveDiscussion(id: string): void {
  const d = discussions.find((x) => x.id === id);
  if (!d) return;
  d.status = "resolved";
  recordEpisode({
    artifactId: d.artifactId,
    kind: "resolved",
    actor: "pe_maya",
    at: "now",
    summary: `Maya resolved “${d.title}”.`,
    discussionId: d.id,
    blockId: d.blockId,
  });
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

// the proposed-links graph — the pending (unverified) artifact↔artifact edges AS a graph, so the verify
// queue has a map of its own (the space graph shows collections + people; these live one level down).
// A fresh call after confirm/dismiss drops the resolved edge, so the picture tracks the queue live.
export function pendingGraph(): Neighborhood {
  const pend = listPending();
  const depthOf = new Map<string, number>();
  for (const p of pend) {
    if (!depthOf.has(p.fromId)) depthOf.set(p.fromId, depthOf.size === 0 ? 0 : 1);
    if (!depthOf.has(p.toId)) depthOf.set(p.toId, 1);
  }
  const nodes: GraphNode[] = [...depthOf.entries()].map(([id, d]) => nodeBase(id, d));
  const gedges: GraphEdge[] = pend.map((p) => ({
    id: p.edge_id,
    from: p.fromId,
    to: p.toId,
    type: p.type,
    prov: "ai_generated",
    confidence: p.confidence,
  }));
  const centerId = [...depthOf.entries()].find(([, d]) => d === 0)?.[0] ?? "";
  return { centerId, nodes, edges: gedges };
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

// Per-version block content for the diff view (demo doc only). The evolution: v1 = raw first draft (rough
// Goals · verbose Channels · an Assumptions section · no Key insight); v2 = the agent refined Goals, wove in
// the Key insight, and dropped Assumptions; v3 = Maya tightened Channels. So v2-vs-v1 exercises added +
// removed + modified, and v3-vs-v2 a word-level edit. Other artifacts have no mocked history → current blocks.
const CHANNELS_VERBOSE =
  "Push carries time-sensitive nudges only — a teammate replied, or your draft finished weaving. Email carries the weekly digest and a separate re-engagement sequence for dormant users. In-app carries everything contextual, including the bell, the Today banner, and the inline cue.";

export function versionBlocks(id: string, label: string): Block[] {
  const cur = getBlocks(id);
  if (id !== "a_notif") return cur;
  const by = new Map(cur.map((b) => [b.id, b]));
  const b = (k: string) => by.get(k)!;
  if (label === "v2") {
    return [b("b_goals"), { ...b("b_channels"), text: CHANNELS_VERBOSE }, b("b_insight"), b("b_cadence"), b("b_open")];
  }
  if (label === "v1") {
    return [
      { ...b("b_goals"), text: "Lift activation-week retention — give new workspaces a reason to come back in the first week." },
      { ...b("b_channels"), text: CHANNELS_VERBOSE },
      {
        id: "b_assumptions",
        artifact_id: "a_notif",
        anchor: "assumptions",
        heading: "Assumptions",
        text: "Assumes most drop-off is attention, not value — the product lands, users just forget to return.",
      },
      b("b_cadence"),
      b("b_open"),
    ];
  }
  return cur; // v3 = current
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

// ——————————————————————————————————————————— Ask this web (mock graph Q&A)
// A deterministic, LLM-free answerer over a bounded neighborhood — the graph's "ask" affordance.
// It reads the same typed graph the KG-viz does (getNeighborhood + nodeRelations), lowercase-matches
// the question against node labels/kinds and edge types, and returns a one-line natural answer plus the
// `path`: the ids to light up on the graph (the center, the entities the question implies, and the edge
// ids between them). No Math.random / Date, so the same question over the same graph always resolves the
// same way — a real backend would swap this for a bounded-neighborhood retrieval + LLM synthesis.

export type GraphAnswer = { answer: string; path: string[] };

// "A" · "A and B" · "A, B, and C"
function askListOf(xs: string[]): string {
  if (xs.length <= 1) return xs[0] ?? "";
  if (xs.length === 2) return `${xs[0]} and ${xs[1]}`;
  return `${xs.slice(0, -1).join(", ")}, and ${xs[xs.length - 1]}`;
}

// tokens worth matching a question against — drop the words that would match half the graph
const ASK_STOP = new Set([
  "the", "and", "for", "from", "with", "this", "that", "are", "was", "its",
  "q1", "q2", "q3", "q4", "may", "how", "who", "what", "where", "does", "did", "about",
]);
function askTokens(label: string): string[] {
  return label.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3 && !ASK_STOP.has(w));
}

// how strongly a question names a label. A match on more of the label's tokens wins first (so a typed
// "launch plan" beats the one-word topic "Launch"), then longer matched text, then an exact full-label
// hit as a tie-break. ≥4-char tokens match on a prefix (so "notifications" catches "notification"). Tokens
// the center already carries are ignored (`echoed`) so restating the focus doesn't outrank a real intent.
function askMentionScore(q: string, label: string, echoed: (w: string) => boolean): number {
  const L = label.toLowerCase();
  const live = askTokens(label).filter((w) => !echoed(w));
  if (!live.length) return 0;
  let count = 0;
  let len = 0;
  for (const w of live) {
    const re = w.length >= 4 ? new RegExp(`\\b${w}`) : new RegExp(`\\b${w}\\b`);
    if (re.test(q)) {
      count += 1;
      len += w.length;
    }
  }
  if (!count) return 0;
  const full = L.length >= 4 && q.includes(L) ? 1 : 0;
  return count * 1000 + len * 10 + full;
}

// the neighbor the question most clearly names (people/topics before the long tail of artifacts, then the
// nearest ring, then id — all deterministic tie-breaks)
function askBestEntity(hood: Neighborhood, centerId: string, centerLabel: string, q: string): string | null {
  const order: RefKind[] = ["person", "topic", "collection", "source", "decision", "artifact"];
  const centerTokens = askTokens(centerLabel);
  const echoed = (w: string) => centerTokens.some((c) => c.startsWith(w) || w.startsWith(c));
  let best: { id: string; score: number; kp: number; depth: number } | null = null;
  for (const n of hood.nodes) {
    if (n.id === centerId) continue;
    const score = askMentionScore(q, n.label, echoed);
    if (score <= 0) continue;
    const kp = order.indexOf(n.kind);
    const better =
      !best ||
      score > best.score ||
      (score === best.score && kp < best.kp) ||
      (score === best.score && kp === best.kp && n.depth < best.depth) ||
      (score === best.score && kp === best.kp && n.depth === best.depth && n.id < best.id);
    if (better) best = { id: n.id, score, kp, depth: n.depth };
  }
  return best?.id ?? null;
}

// BFS shortest path center → target through the neighborhood, as [node, edge, node, …, target]
function askWalk(hood: Neighborhood, from: string, to: string): string[] {
  if (from === to) return [from];
  const adj = new Map<string, { edge: string; node: string }[]>();
  const link = (a: string, edge: string, b: string) => {
    const list = adj.get(a) ?? [];
    list.push({ edge, node: b });
    adj.set(a, list);
  };
  for (const e of hood.edges) {
    link(e.from, e.id, e.to);
    link(e.to, e.id, e.from);
  }
  const prev = new Map<string, { via: string; edge: string }>();
  const seen = new Set<string>([from]);
  let frontier = [from];
  while (frontier.length && !prev.has(to)) {
    const next: string[] = [];
    for (const n of frontier) {
      for (const step of adj.get(n) ?? []) {
        if (seen.has(step.node)) continue;
        seen.add(step.node);
        prev.set(step.node, { via: n, edge: step.edge });
        next.push(step.node);
      }
    }
    frontier = next;
  }
  if (!prev.has(to)) return [from, to];
  const out: string[] = [to];
  let cur = to;
  while (cur !== from) {
    const p = prev.get(cur)!;
    out.unshift(p.via, p.edge);
    cur = p.via;
  }
  return out;
}

// a natural verb for an edge, given direction + what it points at
function askVerb(edgeType: Edge["type"], dir: "out" | "in", targetKind: RefKind): string {
  switch (edgeType) {
    case "sourced_from":
      return dir === "out" ? "is sourced from" : "is a source for";
    case "mentions":
      return targetKind === "person" ? "mentions" : "is tagged with";
    case "decided":
      return "records the decision";
    case "supersedes":
      return dir === "out" ? "supersedes" : "is superseded by";
    case "in_collection":
      return "sits in";
    case "authored_by":
      return "was authored by";
    case "links_to":
      if (dir === "in") return "is linked from";
      return targetKind === "collection" ? "sits in" : "links to";
    default:
      return "connects to";
  }
}

// Mock graph Q&A. Heuristic, in priority order:
//   1. the question names an entity in the web → path is the walk center → that entity (nodes + edges).
//   2. provenance intent ("source/based on/where from") → the source-kind neighbors.
//   3. "who" intent → the author + the people it mentions.
//   4. "depends/downstream" intent → the nodes the center links_to.
//   5. fallback → the strongest-connected few, plus the total link count.
// e.g. askGraph("a_notif", "who wrote this?") →
//   { answer: "Woven's agent drafted Notification Strategy v3; it mentions Maya Chen and Dan Lee.",
//     path: ["a_notif","e6","pe_maya","e7","pe_dan"] }
export function askGraph(centerId: string, question: string): GraphAnswer {
  const q = question.trim().toLowerCase();
  const rels = nodeRelations(centerId);
  const hood = getNeighborhood(centerId, 2);
  const center = gLabel(centerId);
  const nodeLabel = (id: string) => hood.nodes.find((n) => n.id === id)?.label ?? gLabel(id);

  // dedupe relations by the node on the other end (nodeRelations is edge-ordered — keep the first)
  const seenT = new Set<string>();
  const uniqRels = rels.filter((r) => (seenT.has(r.target_id) ? false : (seenT.add(r.target_id), true)));

  // ── 1. the question names an entity in the web → light the path to it ──
  const namedId = askBestEntity(hood, centerId, center, q);
  if (namedId) {
    const path = askWalk(hood, centerId, namedId);
    const direct = uniqRels.find((r) => r.target_id === namedId);
    if (direct) {
      const v = askVerb(direct.edgeType, direct.dir, direct.kind);
      const pend = direct.prov === "ai_generated" ? " — a link Woven proposed, still to verify" : "";
      return { answer: `${center} ${v} ${nodeLabel(namedId)}${pend}.`, path };
    }
    // a multi-hop match — name the bridge node(s) the path threads through
    const bridge = path.filter((_, i) => i % 2 === 0).slice(1, -1).map(nodeLabel);
    const via = bridge.length ? ` through ${askListOf(bridge)}` : "";
    return { answer: `${center} connects to ${nodeLabel(namedId)}${via}.`, path };
  }

  // ── 2. provenance — "where is this from / based on / its sources" ──
  if (/\b(sources?|sourced|provenance|based|derived?|evidence|cited?|origin)\b|where.*\bfrom\b|comes?\s+from/.test(q)) {
    const srcs = uniqRels.filter((r) => r.kind === "source");
    if (srcs.length) {
      const path = [centerId, ...srcs.flatMap((r) => [r.edge_id, r.target_id])];
      return { answer: `${center} is woven from ${askListOf(srcs.map((r) => r.label))}.`, path };
    }
  }

  // ── 3. who — the author + the people it names ──
  if (/\bwho\b|\bauthor|\bowns?\b|\bowner\b|\bwrote\b|by whom|\bpeople\b|\bperson\b|\bmention/.test(q)) {
    const persons = uniqRels.filter((r) => r.kind === "person");
    const a = getArtifact(centerId);
    const authorId = a && a.author_id !== "agent" ? a.author_id : undefined;
    const authorName = authorId ? personById(authorId)?.name ?? gLabel(authorId) : undefined;
    if (persons.length || a) {
      const path = [centerId];
      const named: string[] = [];
      for (const r of persons) {
        path.push(r.edge_id, r.target_id);
        if (r.target_id !== authorId) named.push(r.label);
      }
      // the author is a node too — include it even if no edge carries the authorship
      if (authorId && !persons.some((r) => r.target_id === authorId) && hood.nodes.some((n) => n.id === authorId)) {
        path.push(authorId);
      }
      let answer: string;
      if (a) {
        const lead = authorName ? `${authorName} authored ${center}` : `Woven's agent drafted ${center}`;
        answer = named.length ? `${lead}; it mentions ${askListOf(named)}.` : `${lead}.`;
      } else {
        const all = [...(authorName ? [authorName] : []), ...named];
        answer = all.length ? `${center} involves ${askListOf(all)}.` : `${center} names no people yet.`;
      }
      return { answer, path };
    }
  }

  // ── 4. downstream — "what does this depend on / link to / lead to" ──
  if (/\bdepends?\b|depend on|\bdownstream\b|leads?\s+to|links?\s+to|\blinked\b|\bconnect|\brelated?\b|\baffect|\bfeeds?\b|points?\s+to/.test(q)) {
    const outLinks = uniqRels.filter((r) => r.dir === "out" && r.edgeType === "links_to");
    if (outLinks.length) {
      const path = [centerId, ...outLinks.flatMap((r) => [r.edge_id, r.target_id])];
      return { answer: `${center} links out to ${askListOf(outLinks.map((r) => r.label))}.`, path };
    }
  }

  // ── 5. fallback — the strongest-connected few + the total (verified before proposed, then confidence) ──
  const provRank = (p: Edge["prov"]) => (p === "ai_generated" ? 1 : 0);
  const strong = [...uniqRels].sort(
    (a, b) =>
      provRank(a.prov) - provRank(b.prov) ||
      (b.confidence ?? 1) - (a.confidence ?? 1) ||
      a.target_id.localeCompare(b.target_id),
  );
  const top = strong.slice(0, 3);
  const path = [centerId, ...top.flatMap((r) => [r.edge_id, r.target_id])];
  const more = uniqRels.length - top.length;
  const answer = top.length
    ? `${center} connects to ${askListOf(top.map((r) => r.label))}${more > 0 ? `, plus ${more} more` : ""} — ${uniqRels.length} link${uniqRels.length === 1 ? "" : "s"} in all.`
    : `${center} has no links in its web yet.`;
  return { answer, path };
}

// ——————————————————————————————————————————— the reconceived ⌘K search (Stage A engine)

// words the search should not resolve a center from — wh-words + generic connectives. Anything else in the
// question is a candidate label to match an entity against.
const SEARCH_STOP = new Set([
  "who", "what", "where", "when", "why", "how", "which", "whose", "whom",
  "the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "about",
  "is", "are", "was", "were", "does", "did", "do", "own", "owns", "owner", "owned",
  "this", "that", "these", "those", "it", "its", "my", "our", "your", "me", "we",
  "can", "should", "would", "will", "has", "have", "had", "into", "from", "by",
]);
function salientWords(question: string): string[] {
  return question
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !SEARCH_STOP.has(w));
}

// who "owns" a topic — the people who author or are named on the artifacts that carry the topic. Hops
// topic →(mentions | links_to, either direction)→ artifact →(author_id field + authored_by/mentions edges)→
// person, counting each contribution. Deliberately NOT routed through askGraph: a topic has no direct person
// edge, so askGraph would fall through to a generic count-sentence. This is the honest ownership resolver.
export function deriveOwners(topicId: string): { person: Person; count: number }[] {
  const artIds = new Set<string>();
  for (const e of edges) {
    if (e.type !== "mentions" && e.type !== "links_to") continue;
    if (e.from === topicId && kindOf(e.to) === "artifact") artIds.add(e.to);
    if (e.to === topicId && kindOf(e.from) === "artifact") artIds.add(e.from);
  }
  const counts = new Map<string, number>();
  const bump = (pid: string) => counts.set(pid, (counts.get(pid) ?? 0) + 1);
  for (const aid of artIds) {
    const a = getArtifact(aid);
    if (a && a.author_id !== "agent" && personById(a.author_id)) bump(a.author_id);
    for (const e of edges) {
      if (e.from !== aid) continue;
      if ((e.type === "authored_by" || e.type === "mentions") && kindOf(e.to) === "person") bump(e.to);
    }
  }
  return [...counts.entries()]
    .map(([id, count]) => ({ person: personById(id), count }))
    .filter((x): x is { person: Person; count: number } => !!x.person)
    .sort((a, b) => b.count - a.count || a.person.id.localeCompare(b.person.id));
}

// resolve the entity a question is "about" — the center the answer hangs off. An explicit docId wins; else
// the salient words are searched (ranked, viewer-scoped) and the top visible entity is the center. Returns
// undefined when nothing matches (the honest "no center" the answerer hedges on).
export function resolveCenter(
  question: string,
  opts?: { scopeId?: string; docId?: string },
): { id: string; kind: RefKind } | undefined {
  if (opts?.docId) return { id: opts.docId, kind: kindOf(opts.docId) };
  const words = salientWords(question);
  if (!words.length) return undefined;
  // a collection scope narrows the answerable universe to that collection's graph (the SAME node set Find is
  // scoped by) — asking inside "Q4 Roadmap" resolves a center only from Q4 Roadmap, else honestly hedges.
  const co = opts?.scopeId ? collectionById(opts.scopeId) : undefined;
  const scopeSet = co ? new Set(collectionGraph(co.slug).nodes.map((n) => n.id)) : null;
  const seen = new Map<string, SearchHit>();
  for (const w of words) {
    for (const h of searchEntities(w, 8, { viewer: "pe_maya" })) {
      if (h.restricted || seen.has(h.id) || (scopeSet && !scopeSet.has(h.id))) continue;
      seen.set(h.id, h);
    }
  }
  if (!seen.size) return undefined;
  const best = [...seen.values()].sort(
    (a, b) => entityScore(b.id, b.kind) - entityScore(a.id, a.kind) || a.id.localeCompare(b.id),
  )[0];
  return { id: best.id, kind: best.kind };
}

// the honest answer assembler — single-center, NOT cross-doc synthesis (that's deliberately out of scope;
// we don't fabricate a stitched-together answer). Resolve the center, then: an artifact center is answered
// by its own cited blocks (askArtifact); a topic/person/collection/decision/source center is answered from
// the graph (askGraph), with cites read off the path's node ids. No center (or an empty underlying answer)
// → a hedged "not in your reachable graph" rather than a made-up one.
const HEDGE = "I couldn't find this in your reachable graph.";
export function answerQuery(
  question: string,
  opts?: { scopeId?: string; docId?: string; viewer?: string },
): {
  mode: "artifact" | "graph" | "none";
  centerId?: string;
  centerLabel?: string;
  centerKind?: RefKind;
  answer: string;
  cites: AskCite[];
  path?: string[];
  hedged?: boolean;
} {
  const viewer = opts?.viewer ?? "pe_maya";
  const center = resolveCenter(question, { scopeId: opts?.scopeId, docId: opts?.docId });
  if (!center || !canView(center.id, viewer)) {
    return { mode: "none", answer: HEDGE, cites: [], hedged: true };
  }
  const centerLabel = gLabel(center.id);
  const base = { centerId: center.id, centerLabel, centerKind: center.kind };

  if (center.kind === "artifact") {
    if (!getBlocks(center.id).length) return { mode: "none", ...base, answer: HEDGE, cites: [], hedged: true };
    const ask = askArtifact(center.id, question);
    if (!ask.answer.trim()) return { mode: "none", ...base, answer: HEDGE, cites: [], hedged: true };
    return { mode: "artifact", ...base, answer: ask.answer, cites: ask.cites };
  }

  const g = askGraph(center.id, question);
  if (!g.answer.trim()) return { mode: "none", ...base, answer: HEDGE, cites: [], hedged: true };
  // cites = the path's nodes (even indices), each tagged with the edge that reached it (the odd index before it).
  // A still-proposed (ai_generated) edge makes the cite VERIFIABLE — the answer is cited AND its proposed links
  // can be confirmed in place (the ✓/✕ valve differentiator).
  const cited = new Set<string>();
  const cites: AskCite[] = [];
  for (let i = 0; i < g.path.length; i += 2) {
    const nid = g.path[i];
    if (cited.has(nid)) continue;
    cited.add(nid);
    const e = i > 0 ? edges.find((x) => x.id === g.path[i - 1]) : undefined;
    cites.push(e?.prov === "ai_generated" ? { label: gLabel(nid), edge_id: e.id, pending: true } : { label: gLabel(nid) });
  }
  // surface up to two PENDING links in the center's web the sentence didn't already name — the proposed
  // connections you can confirm right from the answer, not buried under "plus N more".
  let extra = 0;
  for (const r of nodeRelations(center.id)) {
    if (extra >= 2) break;
    if (r.prov === "ai_generated" && !cited.has(r.target_id)) {
      cited.add(r.target_id);
      cites.push({ label: r.label, edge_id: r.edge_id, pending: true });
      extra++;
    }
  }
  return { mode: "graph", ...base, answer: g.answer, cites, path: g.path };
}

// the "jump back in" signal — what the viewer themselves recently touched. The OPPOSITE filter from
// recentEpisodes (which excludes the viewer for catch-up): here we KEEP the viewer's own episodes, mapped to
// their artifact, and fold in artifacts the viewer authored. Deduped by artifact, freshest first, capped.
export function viewerRecents(
  viewer: string = "pe_maya",
  limit = 6,
): { id: string; label: string; kind: RefKind; at: string }[] {
  const freshest = new Map<string, string>(); // artifact id → most-recent relative label
  const note = (id: string, at: string) => {
    const cur = freshest.get(id);
    if (cur === undefined || agoMinutes(at) < agoMinutes(cur)) freshest.set(id, at);
  };
  for (const e of episodes) if (e.actor === viewer) note(e.artifactId, e.at);
  for (const a of artifacts) if (a.author_id === viewer) note(a.id, a.updated);
  return [...freshest.entries()]
    .filter(([id]) => canView(id, viewer))
    .sort((a, b) => agoMinutes(a[1]) - agoMinutes(b[1]))
    .slice(0, limit)
    .map(([id, at]) => ({ id, label: labelOf(id), kind: kindOf(id), at }));
}

// ——————————————————————————————————————————— agent runs + governance (the Inbox console)
// Runs are the Activity monitor's rows (what the agent is doing / did). Governance holds the per-capability
// intervention levels + decision-points the user controls. Session-scoped mutations, like episodes.

export function listRuns(): AgentRun[] {
  return agentRuns.slice().sort((a, b) => agoMinutes(a.at) - agoMinutes(b.at));
}
export function runCounts(): Record<RunStatus, number> {
  const c: Record<RunStatus, number> = { running: 0, done: 0, needs_you: 0, failed: 0 };
  for (const r of agentRuns) c[r.status]++;
  return c;
}
// runs still in motion or awaiting the user — the Activity tab's badge count
export function liveRunCount(): number {
  return agentRuns.filter((r) => r.status === "running" || r.status === "needs_you").length;
}

// the runs the viewer must personally act on — Activity's needs_you rows only (running is in-motion, awaiting no
// one). Folded into the sidebar Inbox badge (inboxBadgeCount) so a blocked run isn't hidden behind the
// Decisions-only count. agentRuns carry no per-run owner in the prototype — the Inbox is the viewer's own
// console, so a needs_you run is by definition blocked on the viewer.
export function needsYouRunCount(): number {
  return agentRuns.filter((r) => r.status === "needs_you").length;
}

export function listCapabilities(): AgentCapability[] {
  return agentCapabilities;
}
export function toggleCapability(id: AgentCapabilityId): void {
  const c = agentCapabilities.find((x) => x.id === id);
  if (c) c.enabled = !c.enabled;
  bumpGraph();
}
export function listDecisionPoints(): DecisionPoint[] {
  return decisionPoints;
}
export function toggleDecisionPoint(id: string): void {
  const d = decisionPoints.find((x) => x.id === id);
  if (d) d.enabled = !d.enabled;
  bumpGraph();
}

// colleague suggestions (Inbox · Decisions) — the OPEN discussion-suggestions across every doc, unified into
// the approve queue alongside the agent's proposals. Accept applies the before→after to the block; either way
// the thread resolves and it leaves the queue.
export function listOpenSuggestions(): {
  id: string;
  discussionId: string;
  artifactId: string;
  artifactTitle: string;
  blockId: string;
  blockHeading: string;
  author: string;
  at: string;
  text: string;
  before: string;
  after: string;
}[] {
  const out: {
    id: string;
    discussionId: string;
    artifactId: string;
    artifactTitle: string;
    blockId: string;
    blockHeading: string;
    author: string;
    at: string;
    text: string;
    before: string;
    after: string;
  }[] = [];
  for (const d of discussions) {
    if (d.status !== "open") continue;
    for (const c of d.comments) {
      if (c.kind === "suggestion" && c.suggestion) {
        const sug = c.suggestion;
        const block = blocks.find((b) => b.id === sug.blockId);
        out.push({
          id: c.id,
          discussionId: d.id,
          artifactId: d.artifactId,
          artifactTitle: getArtifact(d.artifactId)?.title ?? "an artifact",
          blockId: sug.blockId,
          blockHeading: block?.heading ?? "a section",
          author: c.author,
          at: c.at,
          text: c.text,
          before: sug.before,
          after: sug.after,
        });
      }
    }
  }
  return out;
}
// accept (apply the edit to the block) or dismiss a colleague suggestion — either way its thread resolves.
export function applySuggestion(discussionId: string, apply: boolean): void {
  const d = discussions.find((x) => x.id === discussionId);
  if (apply && d) {
    for (const c of d.comments) {
      if (c.kind === "suggestion" && c.suggestion) {
        const b = blocks.find((x) => x.id === c.suggestion!.blockId);
        if (b) b.text = c.suggestion.after;
      }
    }
  }
  resolveDiscussion(discussionId);
  bumpGraph();
}
