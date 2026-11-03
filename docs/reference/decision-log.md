# Decision log

> What this is: the reasons behind the locked calls, per area, moved out of `AGENTS.md` on 2026-11-03 and corrected against the code at `84a4bb8`.
> Status: live reference. A change to a locked decision updates this file in the same commit.

Understand intent, not just the rule; these are the ratified decisions that shaped each surface. Sections marked vNext set the product direction. The roadmap is `docs/roadmap.md`.

Understand intent, not just the rule; these are the ratified decisions that shaped each surface.

- **Category / problem (vNext).** Woven maintains the organization's current operational truth; it does
  not win by storing more documents. Its product promise is continuity across evidence, interpretation,
  authority, activation, and later recall.
- **Initial actor + wedge (vNext).** The work owner is a situational role in complex cross-functional
  work, not a fixed job title. The first wedge is `review → authorization → activation → revalidation →
  recall`; the product must work when authority=driver and when they are different people.
- **Canonical model (vNext).** Versioned evidence + Claims are the data center; Decision is the special
  Claim with organizational authority and activation. ReviewPacket is the primary assembled work surface,
  but remains a derived context rather than a mandatory object users must create/manage.
- **Information architecture direction (vNext).** Home = what must move or be revalidated now; Review =
  proposals, authorization, activation candidates, and revalidation; Evidence = sources, versions, exact
  refs, and lineage; Ask = current truth + why; Outputs/lenses = packets, saved sets, publishing, people,
  and topics. Do not rename all current routes before the vertical slice proves this model.
- **B2 handoff contract (implemented).** Today only discovers the highest-risk continuity call and links
  `/inbox?decision=<id>`; focused Inbox assembles exactly one derived ReviewPacket and owns the lifecycle
  action; `/decision/<id>` is the stable, read-only recall leaf for all five states; Decision-scoped Ask
  explains the same derived truth and never falls back to a space answer. Search/Reader Decision exits go
  to the stable detail route, so `in_effect` and `superseded` records never land on an empty queue.
- **B2 current-truth contract (implemented).** Review, detail, and Ask derive from the same `decision_id`
  and `decisionTruth()`; they state verification, authorization, activation, and freshness separately.
  Evidence links bind `artifact_id + version_id + block_id`; an unresolvable or unreachable exact snapshot
  becomes unavailable and hedges/abstains rather than opening latest. Activation candidates are labelled
  candidate and never numbered as settled proof. The reducer-selected Activation observation is inside the
  same exactness boundary: a missing, unreachable, non-current, or hash-invalid exact `EvidenceRef` makes its
  cite unavailable and `DecisionTruth` hedge. An external locator never substitutes for the immutable leaf;
  legacy seeded Activation without raw exact refs remains historical context, not sufficient current proof.
- **B2 action + history contract (implemented).** ReviewPacket remains ephemeral and stores no parallel
  truth. Approval/activation/revalidation actions stay in focused Inbox; detail recalls rather than repeats
  the packet. Revalidation now rejects the old same-version alias: it requires caller-supplied replacement
  refs that resolve to genuinely new current immutable snapshots along the same artifact/source/block lineage
  with a different version and hash, then records a RevalidationEvent while
  preserving old changed refs/Approvals/ActivationEvidence/Episodes. Until new evidence exists, Inbox offers
  review rather than a false “Still current” shortcut. Known defect: no UI path can reach a successful renewal today (see
  `docs/roadmap.md`). The exact-version Reader is read-only: no edit, Suggestions, Collections, discussion,
  graph, share/export/archive, or artifact-level “Mark current” controls.
- **B2 review-reading contract (implemented).** An expanded ReviewPacket is a judgment brief, not a flat
  record grid. Its DOM and visual order is: current truth → Activation condition → reducer-selected exact
  Activation proof → Decision evidence + affected Claims → chronological trust history → the lifecycle call.
  Stable Decision detail repeats the selected proof/hash/assertion/revision for durable recall without
  embedding the ephemeral packet. The expanded row removes its
  duplicate summary/people/action chrome; the call moves to the packet footer after the evidence. Collapsed
  rows keep the quick action plus an accessible `aria-expanded`/`aria-controls` packet toggle.
- **Initial integrations (B3 in progress).** Browser-local File / Link / Loom intake is implemented:
  HTML/HTM/SVG/Markdown/TXT (SVG routed as html; the parser also takes xhtml, mdown, mkd and text) and manually supplied
  Loom transcripts yield stored raw payloads, SHA-256,
  parsed Blocks, exact ArtifactVersions and EvidenceRefs; link-only inputs yield Source + relationship but no
  settled ref. Public GitHub PR and full-SHA commit adapters now freeze exact review/code evidence through
  no-store, fail-closed routes without credentials; PR capture validates complete commit count/head inclusion
  and rechecks revision identity after its collection reads. They do not imply deployment. Inbox can add a structured
  manual downstream observation only by citing an exact captured snapshot, and it remains an `ai_generated`
  stored observation; Authority confirm/dismiss is an append-only disposition. Private GitHub, Loom API, and a real matching deployment/config/
  product-state source plus one prospective dogfood episode remain. Add Slack/Linear/Figma/customer
  connectors only after that continuity loop is proven.
- **Product-first validation (vNext).** Validate real work episodes and the end-to-end loop before any external
  narrative. A story about the product is a result of a credible product, never a reason to add an unrelated feature.
- **Reader / edit copilot.** The artifact is agent-authored, so editing is **a conversation, not a blank
  WYSIWYG** — you direct, the agent drafts a **proposed diff shown in-body** (accept/reject → content
  becomes `human_verified`). The copilot is **ONE state-aware surface** (pill idle → card on
  thread/proposal); "sprawl" = the same verb in two places. **Routing is automatic** (question → cited
  Ask, else edit; no visible Edit/Ask toggle — a toggle pushes the model's job onto the user; hidden
  `/ask` or `/edit` override). Manual formatting floats at the cursor (inline marks only — block ops are
  no-ops). Rail = slim header + ONE `ContextRail` (task=Suggestions valve vs reference=the tie groups,
  each tie a peek); "Verify" is labelled **"Suggestions"** to the user (the term they know).
- **Inbox (current → vNext Review).** = the product-scale trust valve, a **pure actionable queue**
  (awareness ≠ decision: "while you were away" lives on Today). **ONE agent loop in three TENSES**:
  Decisions (NOW) → Activity (DOING) → Governance (LEARNED), unified by a shared `AgentBand` + row grammar,
  **not** a forced common grouping axis. A decision UI **carries its own context** (gist inline, entities
  click-to-peek). vNext adds only real calls: Claim review, Decision authorization, activation-candidate
  confirmation, and revalidation. Open rows that carry the proposal, not the author (Granola's "credited
  once, the verdict in the ink"), not the provisional wash (in an all-provisional surface it marks nothing).
- **Today (current → vNext Home).** = the daily entry: **Resume → Orient → Decide → Ask.** A dashboard **hands off, it does not
  duplicate** (Needs-you → nudge to Inbox; Recent → "All in Library"). Resume = the cover hero ALONE.
  Numbers are sourced once (`home-facts.ts`), so 1 shown + N more = the badge; the Needs-you sort rule
  (generated from `lib/home.ts KIND`) lives in the count's hover. Cohesion from **one row model + one accent + whitespace**, not
  per-widget chrome. `/inbox` reads `?tab=` via `window.location.search`, **NOT `useSearchParams`**
  (that broke the Vercel build; it needs a Suspense boundary; see `ca04eb9`).
- **Library / collection (current → Evidence / Outputs).** Card taste = **faces not
  stats, summary-led**, the head is a 3:1 landscape band, and the cover is true (the document's own woven cloth, which
  draws no marks or words); the list row is the
  Contents row, status only on exception; multi-collection fold (`+N` popover). **Create is tiny, filling is separate, sharing lives on the
  collection page** (the stepped wizard was thrown away). Agent result-surfaces split three ways:
  automate the irreversible-safe quietly, inline the 1–2 reversible as valves, defer the many to the
  Inbox. Library's vNext meaning is Evidence; Collections become Outputs/lenses. Audience analytics remains
  legacy prototype exploration and is frozen unless the active vertical slice requires it. No doc yet says how a
  shortcut section above the Library list behaves with the facets.
- **Graphs / Team.** The graph is the product's signature and must read cold: the encodings existed under a
  judge's threshold (0.8–1.2px ties, 10–11px names) with no memory axis, hence the amplitude pass and
  evidence as line weight (`docs/reference/design-system.md`). `/team`: **rings by kind, hue = the collection, size = Σ
  contribution weight (not raw degree), labels calm at rest.** Reject rings/pie-fills on small nodes. Don't
  gild an encoding to hide a skewed seed; fix the seed but keep 1–2 real cross-team connectors (the WEAVE is
  the story). Reach grows from the graph (the fold chip), not from a setting. **Verify ON the graph in
  place** (`onVerifyEdge`) or in the review dialog; either way the confirm welds.
- **Search / Ask (⌘K).** = the trusted recall surface: one adaptive input,
  deterministic rule-based routing (no LLM in the prototype, honest), ranked union of 4 lanes. Edge over
  Raycast/Linear = **the answer is cited and its cited edges are verifiable in place.** Full-screen
  takeover, never a centered palette, and the takeover is FILLED (one 720px column, marks, three hints),
  not shrunk. A read-back slot shows only when it carries information.
- **Evolve, not redo (2026-10-02, 7/7 judges).** The bones are the asset; the signature was missing.
  Anchor = Are.na ("the connection is the content"). Kyle took all six forks as recommended: cover replaced,
  tie weight = evidence, header band → label on a hairline, sort rule → the count's hover, ⌘K filled,
  all-sans holds. Rejected: serif display, React Flow, gradient covers, glowing graphs, a fifth hue. Settle a
  fork pairwise with the owner, never by an absolute-score loop (it re-decides the fork and pins near 6).
- **Capture / voice.** Loom/transcript import is an evidence modality, not a recorder, meeting bot, or STT
  product. **Hard guardrail: ASR never auto-commits — always a proposal a human confirms.** The active UI
  does not call the legacy `captureMeeting()` spike. It accepts a Loom locator plus optional **manual**
  transcript/timecode; without that transcript the Source remains `reference_only` and no settled
  EvidenceRef is created.
- **Permissions / publishing.** The target is ONE "access ladder" (Only me → Invited → Space → Everyone → Anyone
  with link → Public hub) where **the space is the boundary** (`space_id`), roles map to Woven ACTIONS
  (Viewer/Commenter/Editor/Owner), and restricted graph neighbors show as **locked "request access" stubs, not hidden**.
  This is target intent. In code there are three separate surfaces (`SharePanel`, the orphan `PublishDialog`,
  `ShareCollectionDialog`, which holds the ladder copy and mock local roles), the domain type is only
  `workspace|link|public`, redacted stubs exist only in ⌘K search, and graph accessors take no viewer.
- **Governance.** = a **trust LEDGER, not a settings panel**; the unit is a RESPONSIBILITY (capability ×
  area) on one ladder (Watching → Trusted → Held back), mostly a **consequence of your decisions**. Two
  origins: **Earned** (promoted from decisions), **Granted** (structured composer). Trust state is
  **derived, never stored** (`ruleTrust()`); the confidence floor is a veto (can withhold, never grant).
  Learned autonomy may handle reversible metadata/connection work; it never authorizes a Decision or
  declares Activation on behalf of the scoped authority.
- **Episodic memory.** The graph = semantic memory (what's true); Woven adds **episodic** (who/when/why)
  — each trust-changing event records its own episode (`confirmed` / `approved` / `activated` /
  `revalidated`); they are not synonyms. A teammate's suggestion resolves through the **same ✓/✕ valve**
  as an agent's edge — don't fork the interaction grammar.
- **Decision authority / activation (vNext).** Approval gives a decision organizational legitimacy;
  activation is the downstream work that makes it operative. Model **authority** and **driver** as
  independent per-decision roles whose person ids are allowed to match. Preserve “approved but not yet
  activated” as a meaningful gap. An activation signal must be a citable state change in the existing
  work systems (for example a merge, deployment, publication, permission/policy change, or completed
  customer communication), not merely a task, assignment, schedule, Loom explanation, or verbal intent.
  **A connector-observed PR merge is always an Activation candidate first.** It may become confirmed only
  after the scoped authority verifies that the cited downstream evidence actually satisfies this Decision's
  falsifiable `activation_condition`. A merge cannot prove a production/user-visible condition by itself;
  that condition needs matching deployment, configuration, actual render/test, publication, or other
  observable product-state evidence. Bias this transition for extreme precision: a false `in_effect` is
  more dangerous than a delayed confirmation.
  Approval and activation may happen in one user action but remain separate facts. Outcome evidence is
  optional linkage, not proof of activation and not a reason for Woven to become analytics, project
  management, or observability. Observe the work rather than forcing a parallel RACI/settings workflow.
  **Verification ≠ authorization ≠ activation.**
- **Identity / avatar.** The signed-in viewer's tint must be **warm/vivid**: Maya moved from `chart-4` cold blue-grey to
  `chart-8` clay, because cold hues read as uncoloured placeholders in a warm palette and rose (`chart-7`) read as
  simply pink. People are confined to six warm rungs. Monogram ≈ 0.42 of the circle.
