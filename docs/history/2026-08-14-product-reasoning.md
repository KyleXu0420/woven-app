# Woven: product contract and the reasoning behind it

> What this is: the account of why Woven moved from an AI-artifact home to trusted operational memory, the product contract, the scenarios and the validation questions. Written 2026-08-14, cut to the product sections on 2026-11-03.
> Status: history record. Read `AGENTS.md` and the code for current behaviour. The hypotheses and validation questions in section 7 are still open.

## 1. Executive brief

Woven began as an enterprise knowledge-base product for AI-generated HTML and Markdown: capture an artifact, turn it into a living URL, weave it into a graph, and ask over it later. A real delivery pattern exposed a deeper failure. The HTML interaction prototype was only one evidence slice; the reviewer also needed a Loom explanation and a PR; the HTML became stale as soon as the implementation moved; and progress depended on a responsible person approving the judgment and pushing the change into reality.

Woven therefore evolved from **“the home for AI artifacts”** into **trusted operational memory for complex cross-functional work**. Its center is no longer the document alone. Its center is continuity across:

`exact evidence → interpretation → authority → activation → drift → current recall`

It still retains the long-memory value of an enterprise knowledge base. Artifacts, blocks, collections, people, topics, publishing, and the graph remain useful substrate and output lenses. They no longer define the initial category or wedge.

The initial actor is the **work owner**: the situational person who turns ambiguous, cross-functional work into a clear judgment and moves it forward. This is not a fixed PM, designer, or engineer persona. The authority who legitimizes a Decision and the driver who changes reality may be the same person or different people.

The first product wedge is:

`review → authorization → activation → revalidation → recall`

The current mock product spine is:

`Today → focused Inbox / ReviewPacket → Decision detail → Decision-scoped Ask`

Exact-version Readers are evidence leaves attached to that spine. They are not a parallel workflow.

### Decision status at a glance

| Area | Status | Current conclusion |
|---|---|---|
| Category | **Locked** | Trusted operational memory, not generic KB / PM / analytics / observability |
| Initial actor | **Locked** | Situational work owner |
| Initial wedge | **Locked** | Review → authorization → activation → revalidation → recall |
| Canonical center | **Locked** | Versioned evidence + Claims; Decision is the authority-bearing specialization |
| Primary work surface | **Locked** | ReviewPacket is derived, not a persistent Work Thread object |
| Current-truth recall | **Locked** | Decision detail + Decision-scoped Ask derive one `DecisionTruth` |
| Knowledge-base value | **Retained, reframed** | Evidence substrate, long memory, discovery and output lenses |
| B3 real proof | **Open** | Still needs a real downstream state source and one prospective dogfood episode |

---

## 2. The lived failure that changed the product

### 2.1 The original delivery pattern

The motivating episode was not simply “we need a better document editor.” It had several coordinated deliverables:

- an HTML or SVG prototype that supplemented a UX page by demonstrating its interaction;
- a Claude-generated shared link, placed into a PR;
- a Loom recording synchronized with the specific interface, carrying the author's explanation;
- the PR and subsequent code changes;
- review and forward motion led by a key responsible person in the team.

The author's retrospective was roughly **30/70**:

- about 30% of the artifact helped the reviewer make a judgment;
- about 70% became obsolete.

The Loom did help the work move forward, because it joined visible interface behavior with explanation. But the whole delivery was still fragmented. The HTML was not reused, and once the product or code moved, the shared HTML link described an earlier state.

### 2.2 Where the continuity actually broke

The break was not exactly “after HTML or Markdown was generated.” Generation exposed it, but the deeper break happened because the artifact had no durable relationship to:

- the precise revision it represented;
- the explanation and assumptions around it;
- the Claim or Decision the team actually reviewed;
- the person authorized to approve that Decision;
- the driver responsible for changing the real system;
- the downstream proof that the change became operative;
- the later evidence that made the old judgment stale;
- the successor Decision, if the meaning changed rather than merely the evidence.

An artifact can be immutable and still become outdated. Woven must therefore preserve the old artifact as exact historical evidence while allowing the **current Decision truth** to move through revalidation or supersession.

### 2.3 “Everything combined” does not mean one giant document

The delivery is indeed “everything combined” at the level of human judgment. The record must still keep its evidence forms distinct:

| Evidence form | What it can establish | What it cannot establish by itself |
|---|---|---|
| HTML / SVG interaction | Intended UX behavior, visual state, interaction proposal | The shipped or production state |
| Loom + timecodes | Author explanation, assumptions, context, walkthrough | Activation or implementation correctness |
| GitHub PR / commit | Code/review/revision state; a merge if the exact PR says so | Production deployment or user-visible behavior |
| Deployment/config/render/test/product-state observation | A downstream change matching the Decision's activation condition | Whether the Decision was organizationally authorized |
| Approval event | The scoped authority accepts the Decision | Whether reality changed |

The operating rule is:

> **Combined at review time; kept distinct in the record.**

`ReviewPacket` temporarily assembles the relevant evidence for a judgment. `DecisionRecord` and `DecisionTruth` preserve the durable result and history. The underlying exact refs remain separate and citable.

### 2.4 Why `/human-review` is adjacent, not the product answer

The `/human-review` concept is useful: edit HTML/Markdown directly, comment on exact parts, and return feedback to AI. It solves a real interaction cost inside one review round.

Woven's deeper job begins where that round ends:

- Which exact version was reviewed?
- What Claim or Decision did the comments resolve into?
- Who had authority to approve it?
- Who drove the real change?
- What downstream evidence shows that it became operative?
- What later revision invalidated it?
- What should a new teammate believe now?

Woven may borrow precise, in-place human review interactions. It should not collapse back into an HTML/Markdown review editor.

### 2.5 What Fireflies and Plaud contributed

Fireflies and Plaud were useful architectural references because they make a source episode durable and then derive multiple usable outputs from it: source/recording, transcript, summary, structured notes, tasks, Ask, and templates. The transferable lesson is:

`source episode → durable captured record → derived views/outputs → later Ask`

Woven extends that pattern beyond meetings to multi-source cross-functional work, and adds exact evidence, authority, activation, revalidation, and supersession. It must not become a recorder, meeting bot, or speech-to-text product. Loom/transcript is one evidence modality among several.

---

## 3. Product evolution: what was preserved and what was superseded

### 3.1 Phase A — enterprise knowledge base / AI artifact home

The early product thesis was:

> AI-generated HTML/Markdown dies in chat threads. Drop it into Woven and it becomes a living, shareable URL, is automatically woven into a typed graph, and becomes findable, reusable, and askable.

Important early decisions included:

- team-first rather than a single-player PKM;
- no forced company-wide wiki migration;
- HTML as the rich “body,” graph metadata and block anchors as the “structure”;
- Artifact as the stable primary node, block/section anchors as precise citable sub-nodes;
- the first-artifact value loop of capture → living URL → auto-link → share/track;
- Ask as the compounding value after enough material exists;
- human verification of agent-proposed links;
- local graph visualization as trust/audit, not a global star-map navigator.

These choices explain much of the existing product: Library, Reader, Collections, public hubs, analytics, Topic/People explorers, graph views, Capture, cited Ask, and the verify queue.

### 3.2 Phase B — collective brain

The product then expanded around:

- permission-scoped organizational Ask;
- shared typed graph and provenance;
- People and Topic discovery;
- Spaces and roles;
- conversational editing and multiplayer context;
- governance and KB health;
- MCP/API access for external agents.

This phase established useful principles—permission boundaries, provenance, graph-addressable artifacts, agent proposals, human confirmation—but became too broad as an initial category and roadmap.

### 3.3 Phase C — trusted operational memory

The current product interpretation comes from recognizing that HTML, Loom, PR, deployment state, and human approval are not separate “content types” that merely need storage. They are different facts in one continuity problem.

The current category promise is:

> Maintain what is true now, why it became true, the exact evidence behind it, whether it took effect, and what later superseded it.

The enterprise knowledge-base idea was **not deleted**. It moved down one layer:

- Artifact and ArtifactVersion store evidence bodies;
- blocks and EvidenceRefs provide exact citations;
- the graph and Episodes preserve semantic and historical relations;
- Library, Collections, People, Topics, and publishing organize or project the memory;
- Decision continuity becomes the first high-value operational loop.

### 3.4 What not to resurrect as the current strategy

The following older statements are historical, not current locked conclusions:

- “Home for AI artifacts” as the primary category;
- capture → publish → track as the first product wedge;
- Staff PM Maya as the fixed primary persona;
- publishing analytics as the differentiator;
- org-wide Ask as a cold-start-independent entry point;
- MCP as the immediate differentiator;
- Postgres + pgvector + a specific model pipeline as already locked architecture;
- “swap `lib/api.ts` for fetch and the product is live.”

They may contain reusable ideas, but they cannot override the current vNext model.

---

## 5. Current product contract

### 5.1 Category and non-goals

**Category:** trusted operational memory for complex cross-functional work.

**It is not:**

- a generic enterprise wiki;
- a replacement project manager;
- a general analytics product;
- an observability platform;
- a meeting recorder or bot;
- a global graph-navigation product;
- a new place where users must manually reproduce all work already present in source systems.

The product observes and connects work already happening in customer/team systems. It should not create a parallel RACI/settings bureaucracy merely to feed itself.

### 5.2 Initial actor and role ecosystem

#### Primary actor: work owner

The work owner is responsible for turning ambiguous cross-functional work into a clear judgment and moving it forward. This is a situational role.

#### Related roles

| Role | Responsibility | Product implication |
|---|---|---|
| Work owner | Assembles context and moves ambiguity toward a call | Needs one coherent review and continuity path |
| Authority | Gives a Decision organizational legitimacy | Must be scoped per Decision; cannot be inferred from collection ownership |
| Driver | Changes reality in the existing work system | Can differ from authority; activation remains observable separately |
| Reviewer/contributor | Adds evidence, challenges interpretation, verifies extraction | Needs exact in-place citations and clear provisional state |
| Later consumer/new joiner | Recovers current truth and why | Needs stable Decision recall and cited Ask, not a stale artifact dump |
| Steward/admin | Protects permissions, retention, audit, and coverage | Important for production/B4, not the current initial wedge |

The old Maya, Theo, Ana, and Sam personas remain useful scenario lenses. They are not the primary category definition.

### 5.3 Core JTBD

> When cross-functional work produces dispersed evidence that changes over time, I need to assemble it into a reviewable judgment, have the right person authorize it, see whether the driver changed reality, and know when later evidence invalidates it, so anyone can recover the current state and why without relying on a human memory cache.

Supporting jobs include:

- inspect the exact evidence behind a Claim or Decision;
- distinguish “approved” from “in effect”;
- review an agent-detected downstream observation without allowing false activation;
- revalidate against a genuinely new version or create a successor Decision;
- ask what is currently true and receive exact cites plus change history;
- preserve prior artifacts and events without presenting them as current.

### 5.4 North-Star loop

```text
Sources are captured
  ↓
Immutable ArtifactVersions + exact EvidenceRefs are created
  ↓
The agent assembles and proposes Claims / Decisions
  ↓
Humans verify the extraction
  ↓
The scoped authority authorizes the Decision
  ↓
The driver changes reality in an existing work system
  ↓
Woven observes a citable Activation candidate
  ↓
The authority confirms or dismisses it
  ↓
Woven monitors evidence drift / supersession
  ↓
Ask returns current truth + exact evidence + why it changed
```

### 5.5 Current user journey and surface responsibilities

#### Primary continuity spine

```text
Today / Home
  attention: what most urgently needs continuity judgment?
    ↓
Focused Inbox / ReviewPacket
  judgment: what changed, what is the contract, what evidence supports it, what is the call?
    ↓
Decision detail
  durable recall: what is the Decision's current state and history?
    ↓
Decision-scoped Ask
  explanation: what is true now, why, and which exact evidence supports it?
```

#### Evidence intake spine

```text
Capture
  ↓
Source + Artifact identity
  ↓
Immutable ArtifactVersion + EvidenceRef, or an explicitly reference-only locator
  ↓
Exact evidence leaf
  ↓
Claim / Decision assembly and later revalidation
```

#### Surface responsibilities

| Surface | Owns | Must not do |
|---|---|---|
| Today / Home | Discover the most important continuity call and hand it off | Duplicate the full Inbox or own lifecycle mutations |
| Inbox / Review | Claim review, Decision authorization, Activation candidate confirmation, revalidation | Become an awareness/news feed or store a second truth |
| ReviewPacket | Assemble one judgment context at read time | Become a permanent user-managed Work Thread object |
| Evidence leaf | Show exact immutable version/block/source | Quietly open latest or expose current-object editing actions |
| Decision detail | Stable, read-only recall over all five states | Embed or self-link the ephemeral ReviewPacket |
| Decision Ask | Explain the same `DecisionTruth` with exact cites | Fall back to a generic space answer or imply real synthesis |
| Library / Evidence | Browse and organize evidence identities | Become the category center again |
| Collections / Outputs | Curated or derived lenses and publishing | Become a second truth store |
| Graph | Trust/audit and bounded exploration | Become the default global navigation |
| Audience | A secondary analytics mode | Expand into the initial product wedge |

### 5.6 Canonical object model

Review the UI in terms of these objects and facts, not merely “types of cards.”

| Object | Meaning | Invariant |
|---|---|---|
| `Source` | External system or input | Preserve source identity and capture state |
| `Artifact` | Stable evidence identity across revisions | Does not imply that its latest version was cited |
| `ArtifactVersion` | One immutable captured state | Exact payload/hash when truly captured |
| `EvidenceRef` | Exact version + block/source anchor | Never silently follows latest |
| `Claim` | Smallest citable assertion | Can be useful without pretending to have organizational approval |
| `Decision` | Authority-bearing specialization of a Claim | Requires exact evidence, authority, driver, scope, and falsifiable activation condition |
| `ApprovalEvent` | Scoped organizational authorization | Does not prove activation |
| `ActivationEvidence` | Immutable downstream observation | Begins as agent/candidate; cannot self-certify truth |
| `ActivationDispositionEvent` | Append-only authority confirm/dismiss event | Observation is never deleted or rewritten |
| `RevalidationEvent` | Old→new exact-ref continuity after drift | Requires genuinely new exact evidence; preserves old history |
| `Episode` | Who/when/why for trust-changing events | Confirmed, approved, activated, revalidated remain distinct |
| `DecisionRecord` | Derived durable projection of records/events | Not a second mutable store |
| `DecisionTruth` | Shared current answer contract | Keeps verification, authorization, activation, freshness independent |
| `ReviewPacket` | Derived, temporary judgment context | Never mandatory canonical user work |

#### Semantic vs episodic memory

- Claims/Decisions and graph relations answer **what is true**.
- Episodes and authority/activation/revalidation events answer **who, when, and why**.

The product needs both. An event log alone is not current truth; a current Claim without the episode history is not trustworthy continuity.

### 5.7 Four independent truth axes

Every ReviewPacket, Decision detail, and scoped Ask must allow a user to distinguish:

1. **Extraction verification** — was the record/Claim accurately extracted from the cited evidence?
2. **Authorization** — did the scoped authority approve the Decision?
3. **Activation** — did a citable downstream state change satisfy the Decision's condition?
4. **Evidence freshness** — are the evidence refs still current, or has relevant evidence changed/superseded?

Never compress these into a single green “verified” state.

Examples:

- verified extraction + no approval → `needs_approval`;
- approved + no matching downstream proof → `waiting_activation`;
- approved + confirmed matching proof + current evidence → `in_effect`;
- formerly activated + changed source evidence → `needs_revalidation`;
- replaced by a successor Decision → `superseded`.

### 5.8 Decision lifecycle

```text
needs_approval
  -- scoped authority approves --> waiting_activation

waiting_activation
  -- matching exact downstream observation is confirmed --> in_effect

in_effect
  -- relevant cited evidence or activation proof changes --> needs_revalidation

needs_revalidation
  -- genuinely new exact refs preserve meaning/condition --> in_effect + RevalidationEvent
  -- meaning/scope/condition changes --> superseded + successor Decision
```

The five user-visible states are:

- `Needs approval`
- `Approved · waiting for activation`
- `In effect`
- `Needs revalidation`
- `Superseded`

### 5.9 Authority, driver, commitment, and activation

#### Authority and driver

- **Authority** gives the Decision organizational legitimacy.
- **Driver** pushes the Decision into the real work system.
- They may be the same person or different people.
- Collection owner, queue owner, or a suggested person does not establish authority.

#### Commitment is not activation

The following do not prove that reality changed:

- assigning an owner;
- creating a task;
- setting a date or schedule;
- approving a PR review;
- explaining the work in Loom;
- saying “go ahead”;
- approving the Decision itself.

Activation must be a citable state change in an existing work system: for example a merge when the condition is the merge, a production deployment, configuration revision, publication, permission/policy change, actual render/test state, or completed customer communication.

#### Precision bias

A PR merge is always a candidate first. It may satisfy a Decision whose explicit activation condition is the merge itself. It cannot by itself prove a production/user-visible condition. That condition needs matching deployment, configuration, render, test, publication, or observable product-state evidence.

False `in_effect` is more dangerous than delayed confirmation. The product must prefer candidate, hedge, or abstain.

### 5.10 AI / human division of labor

#### The agent

- captures;
- structures and assembles;
- proposes Claims and Decisions;
- monitors evidence and possible activation;
- cites exact sources;
- flags drift and ambiguity.

#### Humans

- define meaning and scope;
- verify extraction;
- assign or accept authority and driver roles;
- authorize Decisions;
- confirm whether evidence satisfies the activation condition;
- handle exceptions and supersession.

The core rule is:

> **Verification ≠ authorization ≠ activation.**

Agent output remains provisional until the appropriate human act. Learned autonomy may handle reversible metadata/connection work; it never authorizes a Decision or declares Activation for the scoped authority.

### 5.11 Exactness, permissions, and history

- Exact evidence links bind `artifact_id + version_id + block_id` where applicable.
- If an exact snapshot is missing, unreachable, non-current where current is required, hash-invalid, or permission-inaccessible, the system hedges or abstains.
- An external URL or locator is provenance metadata; it never substitutes for the frozen exact leaf.
- Restricted evidence cannot leak through labels, answer text, successors, graph neighbors, or fallback external hrefs.
- Old evidence and events are not rewritten to make a Decision look current.
- Confirmation and dismissal append disposition events; they do not delete candidate history.
- Revalidation requires genuinely new immutable evidence along the preserved lineage, with a new version and content hash.
- A meaning, scope, or activation-condition change requires a successor Decision rather than a quiet renewal.

---

## 6. Representative scenarios

### 6.1 Canonical continuity episode: Notification Strategy

The representative fixture stands in for the original HTML/SVG + Loom + PR episode.

1. Kyle creates an HTML/SVG interaction artifact for Notification Strategy.
2. A Loom explains the behavior and assumptions at specific timecodes.
3. GitHub records the implementation/review revision.
4. Woven captures each input as a distinct Source and exact version/ref when possible.
5. The agent extracts a Claim and proposes a Decision, such as a two-push daily cap.
6. A human verifies the extracted Claim.
7. The scoped authority approves the Decision.
8. The Decision remains `waiting_activation`; approval does not imply production behavior.
9. The driver changes the notification service.
10. A deployment/config/product-state observation becomes an Activation candidate.
11. The authority confirms only if the exact proof satisfies the specific target/environment/condition.
12. Later Notification Strategy evidence changes.
13. The Decision becomes `needs_revalidation` while its prior Approval and Activation remain historical facts.
14. The authority either revalidates against genuinely new exact refs or creates/links a successor Decision.
15. A later user asks what the current cadence is and receives the current answer, exact evidence, and why it changed.

### 6.2 Role variants

Both must work:

#### Authority = driver

One responsible team lead approves the Decision and pushes the change. The product may allow a compact interaction, but Approval and Activation remain separate facts/events.

#### Authority ≠ driver

A product or organizational leader authorizes the Decision; an engineer or operator drives the change. The gap between approval and activation is visible and actionable.

### 6.3 Evidence changes but meaning survives

The authority may revalidate only after a genuinely new immutable revision is captured and mapped to the old exact-ref lineage. The old ref remains changed; history is preserved.

### 6.4 Meaning or condition changes

The old Decision must be superseded. A successor has its own evidence, scope, authority, driver, and activation condition. The old Decision remains recallable and links only to a visible successor.

### 6.5 Claim without organizational Decision

Not every useful assertion requires approval and activation. A Claim may be verified and citable without being upgraded into a Decision. Do not force all knowledge into the lifecycle.

### 6.6 Restricted evidence

A viewer may know that a restricted record exists without receiving its text or exact proof. The system must not produce a settled current-truth answer if required evidence is inaccessible.

---

## 7. Product hypotheses, validation, and open decisions

### 7.1 What is already locked

- category, actor, wedge, non-goals;
- exact version/evidence discipline;
- Claim vs Decision boundary;
- authority/driver separation;
- verification/authorization/activation/freshness separation;
- ReviewPacket as derived context;
- stable Decision recall + scoped Ask;
- evidence-leaf behavior;
- fail-closed activation and revalidation;

### 7.2 What remains a product hypothesis

- Which real workflows have enough continuity pain to justify the confirmation burden?
- Which person most often occupies the work-owner role, and who buys the product?
- Is the approval→activation gap valuable enough to track outside regulated/high-risk work?
- Which customer-specific evidence mappings belong in connector configuration, and which should become core product patterns?
- How much of the older Library/Collection/People/Topic value is necessary to support the wedge without distracting from it?
- Can current truth become the long-term return behavior, rather than a novelty demo?

### 7.3 The next required evidence

B3 is not complete until the team:

1. connects one immutable downstream source for deployment, configuration, or observable product state;
2. maps its target/environment/revision to a real Decision activation condition;
3. runs one prospective internal episode end to end;
4. observes real review time, false candidates, missing evidence, confirmation cost, drift, and later recall;
5. records where the product abstains.

### 7.4 Validation questions

Do not replace these with vanity engagement metrics:

- Does continuity review consume meaningful time for a work owner today?
- Are extracted Claims and exact refs correct?
- Is the approval→activation gap useful to track?
- Are activation detection and drift alerts precise enough to trust?
- Can a later user recover current state plus why?
- Is the extra human confirmation burden acceptably low?
- Does the system abstain when evidence, permission, or authority is ambiguous?
- Does the workflow work when authority and driver are the same and when they differ?

### 7.5 Evaluation families for later B5

- extraction correctness;
- exact citation resolution;
- Claim granularity;
- authority and driver suggestion quality;
- activation-condition matching;
- false-positive Activation rate;
- drift detection;
- permission leakage;
- abstention quality;
- revalidation lineage correctness;
- added human review burden;
- later recall accuracy.
