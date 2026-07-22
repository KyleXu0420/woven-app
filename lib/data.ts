// Woven — the mock graph. A small, internally-consistent knowledge graph that
// implements the lib/types.ts shapes. Edges reference real node ids, so the artifact
// rail, the card connections, and the Ask citations are all *derived*, not hand-listed.
// This is the §5 "prototype bridge" from ARCHITECTURE.md.

import type {
  Activity,
  Analytics,
  Artifact,
  Block,
  Collection,
  Decision,
  Discussion,
  Edge,
  Episode,
  Person,
  EditProposal,
  CaptureReview,
  CollectionCandidate,
  Source,
  Space,
  Topic,
  AgentRun,
  AgentCapability,
  DecisionPoint,
} from "./types";

// ——————————————————————————————————————————— spaces

export const spaces: Space[] = [
  { id: "sp_product", name: "Acme · Product", kind: "team", visibility: "closed" },
  // a second, restricted space — Maya is NOT a member, so its one artifact (a_comp) is the demo
  // "you can't see this" target for the search's canView filter.
  { id: "sp_leadership", name: "Leadership", kind: "team", visibility: "closed" },
];

// space membership — the real access boundary the search's canView() reads. A node is visible to a
// viewer iff its space is one the viewer belongs to. Maya ∈ sp_product but NOT sp_leadership; Theo ∈ both.
export const spaceMembers: Record<string, string[]> = {
  sp_product: ["pe_maya", "pe_dan", "pe_jordan", "pe_priya", "pe_lee", "pe_sara", "pe_ana", "pe_theo", "pe_sam"],
  sp_leadership: ["pe_theo"],
};

// ——————————————————————————————————————————— people

export const people: Person[] = [
  { id: "pe_maya", name: "Maya Chen", role: "Product", initial: "M" },
  { id: "pe_dan", name: "Dan Lee", role: "Eng", initial: "D" },
  { id: "pe_jordan", name: "Jordan", role: "Growth", initial: "J" },
  { id: "pe_priya", name: "Priya", role: "Eng", initial: "P" },
  { id: "pe_lee", name: "Lee", role: "Design", initial: "L" },
  { id: "pe_sara", name: "Sara", role: "Product", initial: "S" },
  { id: "pe_ana", name: "Ana Sridhar", role: "Product · new joiner", initial: "A" },
  { id: "pe_theo", name: "Theo Novak", role: "Engineering lead", initial: "T" },
  { id: "pe_sam", name: "Sam Park", role: "Design", initial: "S" },
];

// ——————————————————————————————————————————— external sources (provenance)

export const sources: Source[] = [
  {
    id: "src_transcripts",
    label: "3 interview transcripts",
    kind: "transcript",
    at: "3d",
    note: "Activation interviews — the three-nudge cadence and the SMS pushback both trace back here.",
  },
  {
    id: "src_growthsync",
    label: "Growth sync — May",
    kind: "meeting",
    at: "5d",
    note: "Where the weekly-digest call and the power-user noise concern were raised.",
  },
  {
    id: "src_audit",
    label: "Notification audit",
    kind: "audit",
    at: "2d",
    note: "Current-state channel inventory — the baseline this plan revises. Changed since it was woven in.",
  },
];

// ——————————————————————————————————————————— decisions

export const decisions: Decision[] = [
  { id: "de_embargo", text: "Embargo lifts on the 14th", artifact_id: "a_notif" },
  { id: "de_sms", text: "Drop SMS for Q4", artifact_id: "a_notif" },
];

// ——————————————————————————————————————————— topics (entity / tag nodes)

export const topics: Topic[] = [
  { id: "to_activation", name: "Activation" },
  { id: "to_notifications", name: "Notifications" },
  { id: "to_launch", name: "Launch" },
  { id: "to_pricing", name: "Pricing" },
  { id: "to_onboarding", name: "Onboarding" },
];

// ——————————————————————————————————————————— collections

export const collections: Collection[] = [
  {
    id: "co_q4",
    slug: "q4-roadmap",
    name: "Q4 Roadmap",
    color: "var(--chart-1)",
    space_id: "sp_product",
    public: true,
    owner_id: "pe_maya",
    kind: "simple",
    intro:
      "How Acme is shipping Q4 — the strategy, the launch plan, and the bets behind them. A living collection: it updates as the work moves.",
    public_member_ids: ["a_notif", "a_okrs"],
  },
  {
    id: "co_growth",
    slug: "growth",
    name: "Growth",
    color: "var(--chart-2)",
    space_id: "sp_product",
    public: false,
    owner_id: "pe_jordan",
    kind: "simple",
    public_member_ids: [],
  },
  {
    id: "co_research",
    slug: "research",
    name: "Research",
    color: "var(--chart-3)",
    space_id: "sp_product",
    public: false,
    owner_id: "pe_sara",
    kind: "simple",
    public_member_ids: [],
  },
];

// ——————————————————————————————————————————— artifacts

export const artifacts: Artifact[] = [
  {
    id: "a_notif",
    type: "HTML",
    title: "Notification Strategy v3",
    state: "living",
    prov: "ai_generated",
    space_id: "sp_product",
    collection_ids: ["co_q4", "co_growth", "co_research"],
    author_id: "agent",
    public: true,
    hub_slug: "notification-strategy-v3",
    gist: "Multi-channel engagement plan — push, email, in-app.",
    updated: "17m",
    staleness: { source_label: "Notification audit", since: "2d ago" },
  },
  {
    id: "a_notif_v2",
    type: "HTML",
    title: "Notification Strategy v2",
    state: "archived",
    prov: "ai_generated",
    space_id: "sp_product",
    collection_ids: ["co_research"],
    author_id: "agent",
    public: false,
    gist: "The earlier single-channel plan — kept for the record, superseded by v3.",
    updated: "2mo",
  },
  {
    id: "a_press",
    type: "MD",
    title: "Press Outreach — Q4",
    state: "living",
    prov: "ai_generated",
    space_id: "sp_product",
    collection_ids: ["co_growth", "co_q4"],
    author_id: "agent",
    public: false,
    gist: "Tier-1 media plan timed to the launch window.",
    summary:
      "A tier-1 media plan: eight target outlets, a newsletter-swap calendar, and three podcast pitches timed to the launch window. Embargo set for the 14th.",
    scale: "820 words · 3 sections",
    updated: "2h",
  },
  {
    id: "a_research",
    type: "HTML",
    title: "Customer Research — Q1",
    state: "living",
    prov: "human_verified",
    space_id: "sp_product",
    collection_ids: ["co_research"],
    author_id: "pe_maya",
    public: false,
    gist: "22 interviews · 4 hypotheses.",
    updated: "5h",
  },
  {
    id: "a_pricing",
    type: "DOC",
    title: "Pricing rework",
    state: "living",
    prov: "user_created",
    space_id: "sp_product",
    collection_ids: ["co_growth"],
    author_id: "pe_dan",
    public: false,
    gist: "Three tiers, usage-based add-ons, six-week migration.",
    summary:
      "Three tiers with usage-based add-ons, a grandfathering plan for legacy seats, and a six-week migration timeline across billing and comms.",
    scale: "1.2k words · 5 sections",
    updated: "1d",
  },
  {
    id: "a_onboarding",
    type: "MD",
    title: "Onboarding revamp notes",
    state: "processing",
    prov: "ai_generated",
    space_id: "sp_product",
    collection_ids: ["co_growth"],
    author_id: "agent",
    public: false,
    gist: "Reworking first-run — fewer steps, clearer cues.",
    summary:
      "Cut the first-run from nine steps to four, move workspace setup after the first artifact lands, and let the agent pre-fill tags from the import.",
    scale: "draft · weaving…",
    updated: "1d",
  },
  {
    id: "a_okrs",
    type: "HTML",
    title: "Q4 OKRs",
    state: "living",
    prov: "human_verified",
    space_id: "sp_product",
    collection_ids: ["co_q4"],
    author_id: "pe_jordan",
    public: true,
    hub_slug: "q4-okrs",
    gist: "The five objectives for the quarter and how we'll measure them.",
    updated: "2d",
  },
  {
    id: "a_launch",
    type: "HTML",
    title: "Launch Plan — Q4",
    state: "living",
    prov: "ai_generated",
    space_id: "sp_product",
    collection_ids: ["co_q4"],
    author_id: "agent",
    public: false,
    gist: "Sequenced rollout, owners, and the go/no-go gates.",
    updated: "3d",
  },
  {
    id: "a_retro",
    type: "MD",
    title: "Launch retro — Q3",
    state: "living",
    prov: "user_created",
    space_id: "sp_product",
    collection_ids: ["co_q4"],
    author_id: "pe_sara",
    public: false,
    gist: "What shipped, what slipped, and why — Q3.",
    summary:
      "The Q3 launch landed two weeks late but hit its activation target. Three process fixes for Q4: earlier copy freeze, a single owner per surface, and a dry-run the week before.",
    scale: "640 words · 4 sections",
    updated: "4d",
  },
  {
    id: "a_budget",
    type: "DOC",
    title: "Budget — internal",
    state: "living",
    prov: "user_created",
    space_id: "sp_product",
    collection_ids: ["co_q4"],
    author_id: "pe_dan",
    public: false,
    gist: "Headcount and spend plan — internal only.",
    summary:
      "Q4 headcount holds flat; the marketing line shifts toward the launch window. Two contractor renewals pending sign-off.",
    scale: "5 line items",
    updated: "6d",
  },

  // a freshly-dropped duplicate the agent flagged against Pricing rework (the rv_dupe capture review).
  // Still processing; the Inbox "Merge" valve reconciles it with a_pricing via the merge sheet.
  {
    id: "a_pricing_deck",
    type: "DOC",
    title: "Pricing deck",
    state: "processing",
    prov: "ai_generated",
    space_id: "sp_product",
    collection_ids: ["co_growth"],
    author_id: "agent",
    public: false,
    gist: "A just-dropped pricing deck — overlaps the existing Pricing rework.",
    updated: "just now",
  },

  // the RESTRICTED demo target — lives in sp_leadership, which Maya is not a member of. It exists in the
  // graph but canView() hides it from Maya's Library/Today/search (returned only as a redacted stub when the
  // search explicitly opts into restricted hits). Authored by Theo, who IS a leadership member.
  {
    id: "a_comp",
    type: "DOC",
    title: "Compensation bands 2026",
    state: "living",
    prov: "human_verified",
    space_id: "sp_leadership",
    collection_ids: [],
    author_id: "pe_theo",
    public: false,
    gist: "Leveling and salary bands for 2026 — leadership only.",
    updated: "3d",
  },

];

// ——————————————————————————————————————————— blocks (sub-nodes of a_notif)

// demo figures for the selection-aware editor — two self-contained SVGs so "Replace" visibly swaps the
// image (v1 channel-mix bars ↔ v2 funnel). Kept as data-URIs to avoid a media pipeline in the prototype.
const FIG_CHANNELS_V1 = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 700 340'><rect width='700' height='340' fill='#fafaf8'/><text x='40' y='52' font-family='ui-monospace,monospace' font-size='12' letter-spacing='3' fill='#a8a294'>CHANNEL MIX — V1</text><g font-family='ui-sans-serif,system-ui' font-size='15' fill='#1f1d1b'><text x='40' y='104'>Push</text><text x='40' y='176'>Email</text><text x='40' y='248'>In-app</text></g><g><rect x='150' y='90' width='510' height='20' rx='10' fill='#1f3c1d' opacity='0.08'/><rect x='150' y='90' width='200' height='20' rx='10' fill='#1f3c1d'/><rect x='150' y='162' width='510' height='20' rx='10' fill='#1f3c1d' opacity='0.08'/><rect x='150' y='162' width='360' height='20' rx='10' fill='#1f3c1d'/><rect x='150' y='234' width='510' height='20' rx='10' fill='#1f3c1d' opacity='0.08'/><rect x='150' y='234' width='500' height='20' rx='10' fill='#1f3c1d'/></g><line x1='40' y1='292' x2='660' y2='292' stroke='#e3e2dc'/><text x='40' y='318' font-family='ui-sans-serif,system-ui' font-size='12' fill='#a8a294'>Daily reach by channel · illustrative</text></svg>`,
)}`;
const FIG_CHANNELS_V2 = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 700 340'><rect width='700' height='340' fill='#fafaf8'/><text x='40' y='52' font-family='ui-monospace,monospace' font-size='12' letter-spacing='3' fill='#a8a294'>FUNNEL — V2</text><g fill='#1f3c1d'><path d='M180 86 H520 L470 140 H230 Z' opacity='0.9'/><path d='M230 150 H470 L430 204 H270 Z' opacity='0.6'/><path d='M270 214 H430 L398 268 H302 Z' opacity='0.35'/></g><g font-family='ui-sans-serif,system-ui' font-size='14' fill='#1f1d1b'><text x='540' y='118'>Sent · 248</text><text x='540' y='182'>Opened · 171</text><text x='540' y='246'>Acted · 92</text></g><text x='40' y='318' font-family='ui-sans-serif,system-ui' font-size='12' fill='#a8a294'>Notification funnel · illustrative</text></svg>`,
)}`;

export const blocks: Block[] = [
  {
    id: "b_goals",
    artifact_id: "a_notif",
    anchor: "goals",
    heading: "Goals",
    text: "Lift activation-week retention by giving every new workspace a reason to come back three times in the first five days — without adding noise for power users who already live in the product.",
  },
  {
    id: "b_channels",
    artifact_id: "a_notif",
    anchor: "channels",
    heading: "Channels",
    text: "Push carries time-sensitive nudges only (a teammate replied, your draft finished weaving). Email carries the weekly digest and re-engagement. In-app carries everything contextual — the bell, the Today banner, the inline cue.",
    image: {
      src: FIG_CHANNELS_V1,
      altSrc: FIG_CHANNELS_V2,
      caption: "Daily reach by channel — push stays lean, in-app carries the long tail.",
      alt: "Bar chart of daily notification reach across push, email, and in-app channels.",
    },
  },
  {
    id: "b_insight",
    artifact_id: "a_notif",
    anchor: "insight",
    heading: "Key insight",
    text: "Retention lifts most when the first nudge lands within 24h of signup — later sends barely move the curve. Front-load the welcome sequence.",
    callout: { tone: "insight" },
  },
  {
    id: "b_cadence",
    artifact_id: "a_notif",
    anchor: "cadence",
    heading: "Cadence",
    text: "Cap at two pushes per day, one digest per week, and suppress any channel a user has muted for a given space. Quiet hours follow the workspace timezone.",
  },
  {
    id: "b_open",
    artifact_id: "a_notif",
    anchor: "open",
    heading: "Open questions",
    text: "Do we let space admins override the per-user cap? And should the agent itself be allowed to send a nudge when it finishes weaving a long artifact?",
  },

  // a_press
  {
    id: "b_press_outlets",
    artifact_id: "a_press",
    anchor: "outlets",
    heading: "Outlets",
    text: "Eight tier-1 targets across tech and business press, ranked by reach and fit. Three are warm intros; the rest go through the agency.",
  },
  {
    id: "b_press_calendar",
    artifact_id: "a_press",
    anchor: "calendar",
    heading: "Calendar",
    text: "A newsletter-swap calendar pairs launch week with two partner sends. Podcast pitches go out ten days ahead to clear booking lead times.",
  },
  {
    id: "b_press_embargo",
    artifact_id: "a_press",
    anchor: "embargo",
    heading: "Embargo",
    text: "The embargo lifts on the 14th at 9am ET. Assets, quotes, and the demo link are pre-loaded in the press kit.",
  },

  // a_research
  {
    id: "b_research_method",
    artifact_id: "a_research",
    anchor: "method",
    heading: "Method",
    text: "Twenty-two interviews across three segments — new workspaces, power users, and churned accounts — run over four weeks.",
  },
  {
    id: "b_research_hypotheses",
    artifact_id: "a_research",
    anchor: "hypotheses",
    heading: "Hypotheses",
    text: "Four going in: activation hinges on the first artifact; power users want the graph; churn follows notification fatigue; pricing blocks teams.",
  },
  {
    id: "b_research_findings",
    artifact_id: "a_research",
    anchor: "findings",
    heading: "Findings",
    text: "The first-artifact hypothesis held strongest. Notification fatigue was real but secondary to unclear value in the first week.",
  },

  // a_pricing
  {
    id: "b_pricing_tiers",
    artifact_id: "a_pricing",
    anchor: "tiers",
    heading: "Tiers",
    text: "Three tiers — Solo, Team, Org — with usage-based add-ons for storage and agent runs above the included pool.",
  },
  {
    id: "b_pricing_migration",
    artifact_id: "a_pricing",
    anchor: "migration",
    heading: "Migration",
    text: "A six-week migration: legacy seats are grandfathered for two cycles, with billing and comms sequenced to avoid surprise invoices.",
  },
  {
    id: "b_pricing_risks",
    artifact_id: "a_pricing",
    anchor: "risks",
    heading: "Risks",
    text: "The main risk is sticker shock on the Org tier; a grandfathering window and a usage estimator are the mitigations.",
  },

  // a_onboarding
  {
    id: "b_onb_cuts",
    artifact_id: "a_onboarding",
    anchor: "cuts",
    heading: "Cuts",
    text: "From nine first-run steps to four. Workspace setup moves after the first artifact lands, so value comes before configuration.",
  },
  {
    id: "b_onb_agent",
    artifact_id: "a_onboarding",
    anchor: "agent-assist",
    heading: "Agent assist",
    text: "The agent pre-fills tags and a collection guess from the first import, so the workspace isn't empty on arrival.",
  },

  // a_okrs
  {
    id: "b_okrs_objectives",
    artifact_id: "a_okrs",
    anchor: "objectives",
    heading: "Objectives",
    text: "Five objectives for the quarter, each with a single owner and a measurable key result reviewed weekly.",
  },
  {
    id: "b_okrs_measurement",
    artifact_id: "a_okrs",
    anchor: "measurement",
    heading: "Measurement",
    text: "Activation-week retention, published-artifact count, and org-Ask usage are the three headline metrics.",
  },

  // a_launch
  {
    id: "b_launch_sequence",
    artifact_id: "a_launch",
    anchor: "sequence",
    heading: "Sequence",
    text: "A staged rollout — internal dogfood, then a partner cohort, then general availability — each gated by a go/no-go review.",
  },
  {
    id: "b_launch_owners",
    artifact_id: "a_launch",
    anchor: "owners",
    heading: "Owners",
    text: "One owner per surface: product marketing, growth, and eng each carry a lane with a named backup.",
  },

  // a_retro
  {
    id: "b_retro_shipped",
    artifact_id: "a_retro",
    anchor: "shipped",
    heading: "What shipped",
    text: "The Q3 launch landed two weeks late but hit its activation target within the first ten days.",
  },
  {
    id: "b_retro_slipped",
    artifact_id: "a_retro",
    anchor: "slipped",
    heading: "What slipped",
    text: "Copy froze too late and ownership was split across three people, which cost a week of rework.",
  },
  {
    id: "b_retro_fixes",
    artifact_id: "a_retro",
    anchor: "fixes",
    heading: "Fixes for Q4",
    text: "Three changes: an earlier copy freeze, a single owner per surface, and a dry-run the week before.",
  },

  // a_budget
  {
    id: "b_budget_headcount",
    artifact_id: "a_budget",
    anchor: "headcount",
    heading: "Headcount",
    text: "Q4 headcount holds flat. No new reqs; two contractor renewals are pending sign-off.",
  },
  {
    id: "b_budget_spend",
    artifact_id: "a_budget",
    anchor: "spend",
    heading: "Spend",
    text: "The marketing line shifts toward the launch window, with a small reserve held for paid amplification.",
  },

];

// ——————————————————————————————————————————— edges
// prov: human_verified = confirmed · ai_generated = pending the Verify queue (shows as "proposed")

export const edges: Edge[] = [
  // a_notif — the detail artifact, fully wired
  { id: "e1", type: "links_to", from: "a_notif", to: "co_q4", prov: "human_verified", created_by: "pe_maya" },
  { id: "e2", type: "links_to", from: "a_notif", to: "co_growth", prov: "human_verified", created_by: "pe_maya" },
  { id: "e3", type: "sourced_from", from: "a_notif", to: "src_transcripts", prov: "human_verified", anchor: "b_goals", created_by: "agent" },
  { id: "e4", type: "sourced_from", from: "a_notif", to: "src_growthsync", prov: "human_verified", anchor: "b_channels", created_by: "agent" },
  { id: "e5", type: "sourced_from", from: "a_notif", to: "src_audit", prov: "human_verified", anchor: "b_cadence", created_by: "agent" },
  { id: "e6", type: "mentions", from: "a_notif", to: "pe_maya", prov: "human_verified", anchor: "b_goals", created_by: "agent" },
  { id: "e7", type: "mentions", from: "a_notif", to: "pe_dan", prov: "human_verified", anchor: "b_channels", created_by: "agent" },
  { id: "e8", type: "decided", from: "a_notif", to: "de_embargo", prov: "human_verified", anchor: "b_open", created_by: "pe_maya" },
  { id: "e9", type: "decided", from: "a_notif", to: "de_sms", prov: "human_verified", anchor: "b_channels", created_by: "pe_maya" },
  // the pending agent-proposed edge (the Verify card on the artifact page)
  { id: "e10", type: "links_to", from: "a_notif", to: "a_launch", prov: "ai_generated", confidence: 0.86, rationale: "Both hinge on the Q4 launch embargo lifting on the 14th.", anchor: "b_open", created_by: "agent" },
  { id: "e13", type: "links_to", from: "a_notif", to: "a_press", prov: "ai_generated", confidence: 0.64, rationale: "The press embargo and the notification launch share the Q4 timing.", anchor: "b_channels", created_by: "agent" },
  // linked-FROM a_notif (reverse links_to)
  { id: "e11", type: "links_to", from: "a_research", to: "a_notif", prov: "human_verified", created_by: "agent" },
  { id: "e12", type: "links_to", from: "a_okrs", to: "a_notif", prov: "human_verified", created_by: "pe_jordan" },
  // a_notif supersedes its earlier version — the living-artifact lineage (v2 now reads as superseded)
  { id: "e14", type: "supersedes", from: "a_notif", to: "a_notif_v2", prov: "human_verified", created_by: "pe_maya" },

  // a_press
  { id: "e20", type: "links_to", from: "a_press", to: "co_growth", prov: "human_verified", created_by: "agent" },
  { id: "e21", type: "mentions", from: "a_press", to: "pe_maya", prov: "human_verified", created_by: "agent" },
  { id: "e22", type: "sourced_from", from: "a_press", to: "src_transcripts", prov: "human_verified", created_by: "agent" },
  { id: "e23", type: "sourced_from", from: "a_press", to: "src_growthsync", prov: "ai_generated", confidence: 0.6, rationale: "The outreach calendar reuses dates from the May growth sync.", created_by: "agent" },
  { id: "e24", type: "sourced_from", from: "a_press", to: "src_audit", prov: "human_verified", created_by: "agent" },

  // a_research
  { id: "e30", type: "links_to", from: "a_research", to: "co_research", prov: "human_verified", created_by: "pe_maya" },
  { id: "e31", type: "mentions", from: "a_research", to: "pe_maya", prov: "human_verified", created_by: "agent" },
  { id: "e32", type: "mentions", from: "a_research", to: "pe_priya", prov: "human_verified", created_by: "agent" },
  { id: "e33", type: "mentions", from: "a_research", to: "pe_theo", prov: "human_verified", created_by: "agent" },
  { id: "e34", type: "mentions", from: "a_research", to: "pe_sam", prov: "human_verified", created_by: "agent" },

  // a_pricing — four people mentioned
  { id: "e40", type: "links_to", from: "a_pricing", to: "co_growth", prov: "human_verified", created_by: "pe_dan" },
  { id: "e41", type: "mentions", from: "a_pricing", to: "pe_dan", prov: "human_verified", created_by: "pe_dan" },
  { id: "e42", type: "mentions", from: "a_pricing", to: "pe_lee", prov: "human_verified", created_by: "agent" },
  { id: "e43", type: "mentions", from: "a_pricing", to: "pe_maya", prov: "human_verified", created_by: "agent" },
  { id: "e44", type: "mentions", from: "a_pricing", to: "pe_jordan", prov: "ai_generated", confidence: 0.55, rationale: "The migration section names Jordan as the owner.", created_by: "agent" },

  // a_onboarding
  { id: "e50", type: "links_to", from: "a_onboarding", to: "co_growth", prov: "ai_generated", confidence: 0.5, rationale: "Onboarding sits with the other Growth experiments.", created_by: "agent" },
  { id: "e51", type: "mentions", from: "a_onboarding", to: "pe_sara", prov: "human_verified", created_by: "agent" },

  // a_okrs
  { id: "e60", type: "links_to", from: "a_okrs", to: "co_q4", prov: "human_verified", created_by: "pe_jordan" },
  { id: "e61", type: "mentions", from: "a_okrs", to: "pe_jordan", prov: "human_verified", created_by: "agent" },
  { id: "e62", type: "mentions", from: "a_okrs", to: "pe_maya", prov: "human_verified", created_by: "agent" },

  // a_retro / a_budget
  { id: "e70", type: "links_to", from: "a_retro", to: "co_q4", prov: "human_verified", created_by: "pe_sara" },
  { id: "e71", type: "mentions", from: "a_retro", to: "pe_sara", prov: "human_verified", created_by: "agent" },
  { id: "e80", type: "links_to", from: "a_budget", to: "co_q4", prov: "human_verified", created_by: "pe_dan" },
  { id: "e81", type: "mentions", from: "a_budget", to: "pe_dan", prov: "human_verified", created_by: "pe_dan" },
  { id: "e82", type: "mentions", from: "a_budget", to: "pe_jordan", prov: "human_verified", created_by: "agent" },
  { id: "e83", type: "mentions", from: "a_budget", to: "pe_sara", prov: "human_verified", created_by: "agent" },

  // topic mentions (artifact → topic) — populate the Topics KG-viz
  { id: "e90", type: "mentions", from: "a_notif", to: "to_notifications", prov: "human_verified", anchor: "b_channels", created_by: "agent" },
  { id: "e91", type: "mentions", from: "a_notif", to: "to_activation", prov: "human_verified", anchor: "b_goals", created_by: "agent" },
  { id: "e92", type: "mentions", from: "a_research", to: "to_activation", prov: "human_verified", created_by: "agent" },
  { id: "e93", type: "mentions", from: "a_okrs", to: "to_activation", prov: "human_verified", created_by: "agent" },
  { id: "e94", type: "mentions", from: "a_okrs", to: "to_launch", prov: "ai_generated", confidence: 0.82, rationale: "An objective tracks the launch milestone directly.", created_by: "agent" },
  { id: "e95", type: "mentions", from: "a_pricing", to: "to_pricing", prov: "human_verified", created_by: "agent" },
  { id: "e96", type: "mentions", from: "a_press", to: "to_launch", prov: "human_verified", created_by: "agent" },
  { id: "e97", type: "mentions", from: "a_launch", to: "to_launch", prov: "human_verified", created_by: "agent" },
  { id: "e98", type: "mentions", from: "a_onboarding", to: "to_onboarding", prov: "human_verified", created_by: "agent" },
  { id: "e99", type: "mentions", from: "a_onboarding", to: "to_activation", prov: "ai_generated", confidence: 0.58, rationale: "The revamp targets activation-week retention.", created_by: "agent" },
  { id: "e100", type: "mentions", from: "a_retro", to: "to_launch", prov: "human_verified", created_by: "agent" },

  // a_pricing_deck — the dropped duplicate's connections. Two overlap a_pricing (co_q4, Dan) and dedupe
  // on merge; two are net-new (Sara, the growth sync) and move onto the survivor. Verified so they don't
  // sit in the Verify queue while the dupe awaits a merge decision.
  { id: "e110", type: "links_to", from: "a_pricing_deck", to: "co_growth", prov: "human_verified", created_by: "agent" },
  { id: "e111", type: "mentions", from: "a_pricing_deck", to: "pe_dan", prov: "human_verified", created_by: "agent" },
  { id: "e112", type: "mentions", from: "a_pricing_deck", to: "pe_sara", prov: "human_verified", created_by: "agent" },
  { id: "e113", type: "sourced_from", from: "a_pricing_deck", to: "src_growthsync", prov: "human_verified", created_by: "agent" },

  // onboarding ownership — Ana (the new joiner) picks up the onboarding revamp. Both edges hang off
  // a_onboarding, which mentions to_onboarding (e98), so deriveOwners("to_onboarding") resolves through
  // topic → a_onboarding → Ana (authored_by + mentions = 2 contributions, out-ranking Sara's 1).
  { id: "e120", type: "authored_by", from: "a_onboarding", to: "pe_ana", prov: "human_verified", created_by: "pe_ana" },
  { id: "e121", type: "mentions", from: "a_onboarding", to: "pe_ana", prov: "human_verified", anchor: "b_onb_cuts", created_by: "agent" },
];

// ——————————————————————————————————————————— activity feed (Today)

export const activity: Activity[] = [
  { id: "ac1", initial: "M", agent: false, actor: "pe_maya", text: "You edited Notification Strategy v3", t: "17m", href: "/artifact/a_notif" },
  { id: "ac2", initial: "A", agent: true, text: "Woven wove in Customer Research — Q1", t: "2h", href: "/artifact/a_research", sub: "linked 4 sources · named it · filed to Research" },
  { id: "ac3", initial: "D", agent: false, actor: "pe_dan", text: "Dan published Pricing rework", t: "5h", href: "/artifact/a_pricing" },
  { id: "ac4", initial: "S", agent: false, actor: "pe_sara", text: "Sara created the Growth collection", t: "1d", href: "/collection/growth" },
];

// per-artifact recent activity (the hero "peek" list on Today)
export const artifactPeek: Record<string, { t: string; s: string }[]> = {
  a_notif: [
    { t: "17m", s: "Maya tightened the push-notification section" },
    { t: "2h", s: "agent linked it to q4-roadmap" },
    { t: "1d", s: "Dan left 2 comments on cadence" },
  ],
};

// ——————————————————————————————————————————— analytics
// keyed by node id (artifacts) and by "slug:audience" (collections)

export const artifactAnalytics: Record<string, Analytics> = {
  a_notif: {
    url: "woven.dev/a/notification-strategy-v3",
    stats: [
      { v: "248", l: "Reads" },
      { v: "31", l: "Readers" },
      { v: "2m 10s", l: "Avg read" },
      { v: "68%", l: "Completion" },
    ],
    readthrough: [
      { h: "Goals", pct: 92 },
      { h: "Channels", pct: 74 },
      { h: "Cadence", pct: 51 },
      { h: "Open questions", pct: 38 },
    ],
    readers: [
      { i: "J", n: "Jordan · Growth", t: "2h", ext: false },
      { i: "P", n: "Priya · Eng", t: "5h", ext: false },
      { i: "↗", n: "Someone via link", t: "1d", ext: true },
    ],
  },
};

export const collectionAnalytics: Record<string, Analytics> = {
  "q4-roadmap:internal": {
    stats: [
      { v: "14", l: "Members" },
      { v: "312", l: "Internal reads", delta: 9 },
      { v: "6", l: "Contributors" },
      { v: "2", l: "Open edits" },
    ],
    trend: { label: "Internal reads", points: [8, 11, 9, 14, 12, 16, 15, 19, 17, 22, 20, 25, 23, 28] },
    sources: [
      { name: "Slack", visitors: 148 },
      { name: "Direct link", visitors: 96 },
      { name: "Search", visitors: 44 },
      { name: "Email", visitors: 24 },
    ],
    readthrough: [
      { h: "Notification Strategy v3", pct: 88 },
      { h: "Q4 OKRs", pct: 64 },
      { h: "Launch Plan — Q4", pct: 41 },
    ],
    readers: [
      { i: "J", n: "Jordan · Growth", t: "1h", ext: false },
      { i: "P", n: "Priya · Eng", t: "3h", ext: false },
      { i: "L", n: "Lee · Design", t: "1d", ext: false },
    ],
  },
  "q4-roadmap:public": {
    stats: [
      { v: "1.2k", l: "Hub views", delta: 18 },
      { v: "184", l: "Readers", delta: 12 },
      { v: "3m 04s", l: "Avg read", delta: 5 },
      { v: "61%", l: "Completion", delta: -2 },
    ],
    trend: {
      label: "Hub views",
      points: [
        30, 36, 33, 41, 38, 45, 43, 50, 47, 55, 52, 60, 57, 64, 61, 68, 65, 73, 70, 78, 75, 83, 80, 88, 85,
        92, 89, 97, 94, 102,
      ],
    },
    sources: [
      { name: "Direct", visitors: 92 },
      { name: "acme-partner.com", visitors: 41 },
      { name: "x.com", visitors: 28 },
      { name: "LinkedIn", visitors: 14 },
      { name: "Google", visitors: 9 },
    ],
    readthrough: [
      { h: "Notification Strategy v3", pct: 88 },
      { h: "Q4 OKRs", pct: 64 },
      { h: "Launch Plan — Q4", pct: 41 },
    ],
    readers: [
      { i: "↗", n: "Someone via link", t: "20m", ext: true },
      { i: "↗", n: "acme-partner.com", t: "2h", ext: true },
      { i: "↗", n: "Someone via link", t: "5h", ext: true },
    ],
  },
};

// ——————————————————————————————————————————— canned edit proposals (the instruct chips)
// Real before/after on actual blocks — the agent's "proposed diff" for the demo. Free-text
// instructions route to these by keyword (else synthesize an "add"); see api.proposeEdit.

export const editProposals: EditProposal[] = [
  {
    id: "ep_notif_cadence",
    artifact_id: "a_notif",
    instruction: "Tighten the Cadence section",
    kind: "rewrite",
    block_id: "b_cadence",
    heading: "Cadence",
    before:
      "Cap at two pushes per day, one digest per week, and suppress any channel a user has muted for a given space. Quiet hours follow the workspace timezone.",
    after:
      "Cap at two pushes per day and one digest per week. Suppress muted channels, and follow the workspace timezone for quiet hours.",
    keywords: ["cadence", "tighten", "shorten", "trim", "concise"],
  },
  {
    id: "ep_notif_risks",
    artifact_id: "a_notif",
    instruction: "Add a Risks section",
    kind: "add",
    block_id: "b_notif_risks",
    heading: "Risks",
    after:
      "The main risk is over-notifying power users; the per-user cap and muted-channel suppression are the guardrails. SMS is explicitly out of scope for Q4.",
    keywords: ["risk", "risks"],
  },
  {
    id: "ep_notif_goals",
    artifact_id: "a_notif",
    instruction: "Make the Goals tone more formal",
    kind: "tone",
    block_id: "b_goals",
    heading: "Goals",
    before:
      "Lift activation-week retention by giving every new workspace a reason to come back three times in the first five days — without adding noise for power users who already live in the product.",
    after:
      "The objective is to increase activation-week retention by giving each new workspace sufficient reason to return three times within the first five days, without introducing notification noise for established power users.",
    keywords: ["formal", "tone", "goals", "professional"],
  },
  {
    id: "ep_pricing_tiers",
    artifact_id: "a_pricing",
    instruction: "Tighten the Tiers section",
    kind: "rewrite",
    block_id: "b_pricing_tiers",
    heading: "Tiers",
    before:
      "Three tiers — Solo, Team, Org — with usage-based add-ons for storage and agent runs above the included pool.",
    after: "Three tiers — Solo, Team, Org — with usage-based add-ons above the included pool.",
    keywords: ["tier", "tiers", "tighten", "trim"],
  },
  {
    id: "ep_research_rec",
    artifact_id: "a_research",
    instruction: "Add a Recommendation",
    kind: "add",
    block_id: "b_research_rec",
    heading: "Recommendation",
    after:
      "Prioritize the first-artifact activation moment for Q4 and treat notification fatigue as a fast-follow. Re-test pricing friction with teams before the Org-tier launch.",
    keywords: ["recommend", "recommendation", "next steps"],
  },
];

// post-capture review queue — what the agent flags after a drop, for the human to adjudicate (Step 2).
// Mock; in production these come from the agent's parse/extract/link pass on freshly ingested artifacts.
export const captureReviews: CaptureReview[] = [
  {
    id: "rv_dupe",
    kind: "duplicate",
    title: "Pricing deck",
    detail: "Looks like an existing artifact — Pricing rework (HTML). About 94% of the content overlaps.",
    actions: [
      { id: "merge", label: "Merge", primary: true },
      { id: "keep", label: "Keep both" },
      { id: "replace", label: "Replace" },
    ],
    dupeArtifactIds: ["a_pricing_deck", "a_pricing"],
  },
  {
    id: "rv_name",
    kind: "naming",
    title: "Two files named “Q4 launch notes”",
    detail: "Two dropped artifacts share a name in Q4 Roadmap.",
    actions: [
      { id: "rename", label: "Rename", primary: true },
      { id: "merge", label: "Merge" },
    ],
  },
  {
    id: "rv_arch",
    kind: "archive",
    title: "Q4 OKRs",
    detail: "Supersedes “Q4 OKRs (Q3)” — archive the older version?",
    actions: [
      { id: "archive", label: "Archive old", primary: true },
      { id: "keep", label: "Keep both" },
    ],
  },
  {
    id: "rv_extr",
    kind: "extraction",
    title: "Notification Strategy v3",
    detail: "Extracted 3 decisions · 5 people · 2 sources from the drop.",
    actions: [
      { id: "confirm", label: "Confirm", primary: true },
      { id: "edit", label: "Edit" },
    ],
  },
];

// smart-collection candidates — empty at first; populated when a typed collection is created
// (api.createCollection → generateCollectionCandidates). Confirming one files the artifact into the collection.
export const collectionCandidates: CollectionCandidate[] = [];

// ——————————————————————————————————————————— episodic memory (a_notif's narrative)
// The time-stamped story of Notification Strategy v3 — chronological (oldest first; the reader reverses for
// newest-first). It threads the same nodes the semantic graph holds: confirmed episodes carry the real
// edgeId they verified (e11, e12), commented/resolved episodes carry the discussion they belong to (dis_sms),
// and the version roll carries the supersedes edge (e14). Session-scoped like archive/merge (see lib/api.ts).
export const episodes: Episode[] = [
  {
    id: "ep_cap",
    artifactId: "a_notif",
    kind: "captured",
    actor: "agent",
    at: "3d",
    summary: "Parsed the drop into 4 sections.",
  },
  {
    id: "ep_prop",
    artifactId: "a_notif",
    kind: "proposed",
    actor: "agent",
    at: "2d",
    summary: "3 links to verify.",
    blockId: "b_channels",
  },
  {
    id: "ep_conf1",
    artifactId: "a_notif",
    kind: "confirmed",
    actor: "pe_maya",
    at: "2d",
    summary: "Customer Research — Q1.",
    edgeId: "e11",
  },
  {
    id: "ep_conf2",
    artifactId: "a_notif",
    kind: "confirmed",
    actor: "pe_maya",
    at: "2d",
    summary: "Q4 OKRs.",
    edgeId: "e12",
  },
  {
    id: "ep_open",
    artifactId: "a_notif",
    kind: "commented",
    actor: "pe_dan",
    at: "1d",
    summary: "Drop SMS for Q4?",
    discussionId: "dis_sms",
    blockId: "b_channels",
  },
  {
    id: "ep_sugg",
    artifactId: "a_notif",
    kind: "commented",
    actor: "pe_maya",
    at: "1d",
    summary: "Cut the SMS line.",
    discussionId: "dis_sms",
    blockId: "b_channels",
  },
  {
    id: "ep_resolve",
    artifactId: "a_notif",
    kind: "resolved",
    actor: "pe_maya",
    at: "5h",
    summary: "Dropped SMS for Q4.",
    discussionId: "dis_sms",
    blockId: "b_channels",
  },
  {
    id: "ep_edit",
    artifactId: "a_notif",
    kind: "edited",
    actor: "pe_maya",
    at: "17m",
    summary: "Channels tightened.",
    blockId: "b_channels",
  },
  {
    id: "ep_super",
    artifactId: "a_notif",
    kind: "superseded",
    actor: "pe_maya",
    at: "17m",
    summary: "v3 replaced v2.",
    edgeId: "e14",
  },
  { id: "ep_x_pricing", artifactId: "a_pricing", kind: "confirmed", actor: "pe_dan", at: "2h", summary: "Q3 pricing test." },
  { id: "ep_x_press", artifactId: "a_press", kind: "commented", actor: "pe_dan", at: "3h", summary: "Embargo timing?" },
  { id: "ep_x_okrs", artifactId: "a_okrs", kind: "edited", actor: "pe_jordan", at: "4h", summary: "Reworded the activation OKR." },
  { id: "ep_x_research", artifactId: "a_research", kind: "superseded", actor: "pe_sara", at: "6h", summary: "v2 with the new interviews." },

  // multi-persona catch-up feed (recentEpisodes excludes the viewer) — Ana / Theo / Sam moving other docs.
  { id: "ep_ana_onb", artifactId: "a_onboarding", kind: "edited", actor: "pe_ana", at: "40m", summary: "Trimmed first-run to four steps." },
  { id: "ep_theo_launch", artifactId: "a_launch", kind: "commented", actor: "pe_theo", at: "1h", summary: "Who owns the eng lane?" },
  { id: "ep_sam_press", artifactId: "a_press", kind: "edited", actor: "pe_sam", at: "3h", summary: "Polished the outreach copy." },
  // Maya's own trail — the "jump back in" signal viewerRecents surfaces (episodes WHERE actor === Maya).
  { id: "ep_maya_research", artifactId: "a_research", kind: "edited", actor: "pe_maya", at: "50m", summary: "Added the churn finding." },
  { id: "ep_maya_launch", artifactId: "a_launch", kind: "commented", actor: "pe_maya", at: "1h", summary: "Confirmed the go/no-go gates." },
];

// ——————————————————————————————————————————— discussions (a_notif's durable threads)
// Rebuilt comments: not ephemeral chat but persisted threads. (a) a resolved `decision` thread that OWNS the
// provenance of "Drop SMS for Q4" (de_sms / edge e9, anchored on b_channels) — it carries a `suggestion`
// comment with a real before/after on the Channels block. (b) an open `question` on the Open-questions block.
export const discussions: Discussion[] = [
  {
    id: "dis_sms",
    artifactId: "a_notif",
    blockId: "b_channels",
    status: "resolved",
    tag: "decision",
    title: "Drop SMS for Q4?",
    participants: ["pe_dan", "pe_maya"],
    createdAt: "1d",
    comments: [
      {
        id: "dc_sms_1",
        author: "pe_dan",
        kind: "comment",
        at: "1d",
        text: "SMS came in under 4% open on the last campaign and the per-message cost is real. Do we keep it in the channel mix for Q4, or cut it and put the effort into push and in-app?",
      },
      {
        id: "dc_sms_2",
        author: "pe_maya",
        kind: "suggestion",
        at: "1d",
        text: "Agreed — let's cut it. Here's Channels without the SMS line.",
        suggestion: {
          blockId: "b_channels",
          before:
            "Push carries time-sensitive nudges only (a teammate replied, your draft finished weaving). Email carries the weekly digest and re-engagement. SMS is held back for critical account alerts. In-app carries everything contextual — the bell, the Today banner, the inline cue.",
          after:
            "Push carries time-sensitive nudges only (a teammate replied, your draft finished weaving). Email carries the weekly digest and re-engagement. In-app carries everything contextual — the bell, the Today banner, the inline cue.",
        },
      },
      {
        id: "dc_sms_3",
        author: "pe_dan",
        kind: "comment",
        at: "22h",
        text: "Works for me. Push plus in-app already covers the time-sensitive cases — SMS was never pulling its weight.",
      },
    ],
  },
  {
    id: "dis_agent_nudge",
    artifactId: "a_notif",
    blockId: "b_open",
    status: "open",
    tag: "question",
    title: "Should the agent send its own nudges?",
    participants: ["pe_dan", "pe_maya"],
    createdAt: "3h",
    comments: [
      {
        id: "dc_nudge_1",
        author: "pe_dan",
        kind: "comment",
        at: "3h",
        text: "Open question from the draft: should the agent be allowed to send a nudge when it finishes weaving a long artifact? Useful, but it's the agent generating notification volume on its own. Let's settle this before launch.",
      },
      {
        id: "dc_nudge_2",
        author: "pe_maya",
        kind: "comment",
        at: "2h",
        text: "Lean yes, but gated behind the per-user cap and only for artifacts the user actually asked for. Needs a small spike before we commit.",
      },
    ],
  },
  {
    id: "dis_launch_owners",
    artifactId: "a_launch",
    blockId: "b_launch_owners",
    status: "open",
    tag: "todo",
    title: "Name the owners on the Launch Plan",
    participants: ["pe_dan"],
    createdAt: "3h",
    comments: [
      {
        id: "dc_launch_owners_1",
        author: "pe_dan",
        kind: "suggestion",
        at: "3h",
        text: "Let's name the owners so there's no ambiguity going into the go/no-go.",
        suggestion: {
          blockId: "b_launch_owners",
          before:
            "One owner per surface: product marketing, growth, and eng each carry a lane with a named backup.",
          after:
            "One owner per surface — product marketing (Dan Lee), growth (Maya Chen), and eng (Theo Novak) — each with a named backup.",
        },
      },
    ],
  },
  {
    id: "dis_okrs_measurement",
    artifactId: "a_okrs",
    blockId: "b_okrs_measurement",
    status: "open",
    tag: "todo",
    title: "Say where the OKR metrics get reviewed",
    participants: ["pe_ana"],
    createdAt: "1d",
    comments: [
      {
        id: "dc_okrs_meas_1",
        author: "pe_ana",
        kind: "suggestion",
        at: "1d",
        text: "Small thing — call out where we review these so they don't drift.",
        suggestion: {
          blockId: "b_okrs_measurement",
          before:
            "Activation-week retention, published-artifact count, and org-Ask usage are the three headline metrics.",
          after:
            "Activation-week retention, published-artifact count, and org-Ask usage are the three headline metrics, reviewed in the Monday growth sync.",
        },
      },
    ],
  },
];

// ——————————————————————————————————————————— agent runs (Inbox · Activity monitor)
export const agentRuns: AgentRun[] = [
  {
    id: "run_link_notif",
    kind: "link",
    title: "Proposed 3 links on Notification Strategy v3",
    artifactId: "a_notif",
    status: "needs_you",
    at: "5m",
    result: "3 links to verify",
  },
  {
    id: "run_link_launch",
    kind: "link",
    title: "Linking Launch Plan — Q4 to its sources",
    artifactId: "a_launch",
    status: "running",
    at: "now",
    steps: [
      { label: "Scanned the artifact", done: true },
      { label: "Matched 4 candidate links", done: true },
      { label: "Proposing links to verify", done: false },
    ],
  },
  {
    id: "run_capture_notif",
    kind: "capture",
    title: "Wove “Notification audit” into Notification Strategy v3",
    artifactId: "a_notif",
    status: "done",
    at: "17m",
    result: "Parsed into 4 sections · proposed 3 links",
  },
  {
    id: "run_mention_press",
    kind: "link",
    title: "Noted Maya Chen + Theo Novak on Press Outreach — Q4",
    artifactId: "a_press",
    status: "done",
    at: "40m",
    result: "2 mentions added on its own — you were told, not asked",
    ruleId: "lr_seed_mentions_growth",
  },
  {
    id: "run_file_onboarding",
    kind: "file",
    title: "Filed Onboarding revamp notes into Growth",
    artifactId: "a_onboarding",
    status: "done",
    at: "4h",
    result: "Filed on its own — under your standing grant",
    ruleId: "lr_grant_file_growth",
  },
  {
    id: "run_draft_pricing",
    kind: "draft",
    title: "Drafted a “Risks” section on Pricing rework",
    artifactId: "a_pricing",
    status: "needs_you",
    at: "2h",
    result: "1 section drafted — review it in the doc",
  },
  {
    id: "run_verify_okrs",
    kind: "verify",
    title: "Couldn’t reach the source for Q4 OKRs",
    artifactId: "a_okrs",
    status: "failed",
    at: "3h",
    result: "Source unavailable — will retry",
  },
  {
    id: "run_file_research",
    kind: "file",
    title: "Filed Customer Research — Q1 into Research",
    artifactId: "a_research",
    status: "done",
    at: "1d",
    result: "Added to 1 collection",
  },
  {
    id: "run_stale_notif",
    kind: "scan",
    title: "Notification Strategy v3 may be stale",
    artifactId: "a_notif",
    status: "needs_you",
    at: "1h",
    result: "The “Notification audit” it was woven from changed 2d ago — re-weave to refresh.",
  },
  {
    id: "run_summarize_research",
    kind: "summarize",
    title: "Recapped Customer Research — Q1 into 5 takeaways",
    artifactId: "a_research",
    status: "done",
    at: "2h",
    result: "5 takeaways · saved you a 12-page read",
  },
  {
    id: "run_scan_growth",
    kind: "scan",
    title: "Re-scanned the Growth collection",
    status: "done",
    at: "1d",
    result: "No new matches",
  },
];

// ——————————————————————————————————————————— governance (Inbox · Governance tab)
export const agentCapabilities: AgentCapability[] = [
  {
    id: "link",
    name: "Connect related docs",
    blurb: "Links a new doc to the ones it relates to, so nothing gets lost.",
    enabled: true,
  },
  {
    id: "file",
    name: "File into collections",
    blurb: "Suggests which collection a new doc belongs in.",
    enabled: true,
  },
  {
    id: "draft",
    name: "Draft missing sections",
    blurb: "Fills in a summary or a risks section when a doc looks thin. You always review it before it lands.",
    enabled: false,
  },
  {
    id: "verify",
    name: "Confirm obvious links itself",
    blurb: "Skips asking for links it's completely sure about.",
    note: "Only takes effect on “Auto, with undo”.",
    enabled: false,
  },
];

export const decisionPoints: DecisionPoint[] = [
  {
    id: "on_capture",
    label: "When you drop something in",
    detail: "Reads it, connects it, and suggests where it goes.",
    enabled: true,
  },
  {
    id: "on_source_change",
    label: "When a source changes",
    detail: "Flags the docs built on it so they don't quietly go stale.",
    enabled: true,
  },
  {
    id: "on_long_doc",
    label: "When it finishes a long doc",
    detail: "Offers a short recap to the people it mentions.",
    enabled: false,
  },
];
