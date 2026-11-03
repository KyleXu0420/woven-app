# Design doctrine

> What this is: the product doctrine, the owner's verb-to-mode table, the authority hierarchy, the rule of three, the Inbox three-tense model, reference discipline, and the June to July 2026 reversals. Excerpts from design documents dated 2026-06-18 to 2026-07-16.
> Status: live reference for doctrine and method, last edited 2026-11-03. The reversals section is a history record. Where it disagrees with the code or `docs/reference/design-system.md`, those win.

## Operating contract

### Routing
Doctrine is always in force and outranks everything below it. For cross-cutting rules read `docs/reference/design-system.md`.

### Modes — resolve the task from Kyle's verb, before acting

| Mode | Verb sounds like | The work |
|---|---|---|
| **Shape** | "重新设计 / 探索方向 / 讨论" | Frame the problem, compare alternatives, define flow · states · criteria. **No pixels yet.** |
| **Implement** | "做出来 / 继续 / 开干 / 按这个建" | Resolve the open decisions, build the **smallest coherent change**, verify. |
| **Review** | "review / 审一下" | Inspect against these rules; report prioritized findings; don't rewrite unasked. |
| **Copy** | "文案 / 措辞" | Edit user-facing language only; flag structural blockers. |
| **Harden** | "补空态 / 无障碍 / reduced-motion" | Fix states, resilience, a11y, empty/loading/error, motion-safety. |

Ambiguous verb → **default to Shape** and confirm ("别直接堆像素").

### Authority hierarchy — higher tier wins on conflict
1. User's explicit goal + constraints → 2. Verified evidence / the real data model → 3. Canonical guidance (this file, tokens, component APIs) → 4. Accepted decisions + exemplars → 5. Adjacent shipped patterns → 6. General heuristics (say so).

### Every rule is an observable decision, never an adjective
❌ "cards should feel calm" · ✅ "a list surface is one flat panel with hairline rows, not a stack of bordered cards." If you can't check a screenshot against it, it's a coverage gap, not a rule.

### Tier — enforceability
- **`lint`** — mechanical; enforce every time, no judgment.
- **`guidance`** — needs visual/product judgment; agent applies, human reviews.
- **`human`** — a new standard / a fork; never encode without Kyle's yes.

### The rule of three
Promote observation → rule only after **3+ recurrences**. `grep` and count first. Doctrine + directive calls exempt.

## Doctrine: the product beliefs (always in force)

### [woven/doctrine/suggest-then-verify] · human
Rule:       Nothing enters the semantic graph as fact until a human confirms it. Every AI output — a link, an extraction, an ASR transcript, a draft — arrives as a *proposal* a human adjudicates. Never auto-commit machine inference to the graph.
Why:        Trust and accountability are the product; confidence is not consent.
Exceptions: A human may *promote* a consistently-confirmed shape to an auto-rule, bounded by `woven/doctrine/auto-rule-scope`.

### [woven/doctrine/confirm-is-episode] · human
Rule:       Confirming a proposal records an episode — who verified it, when, why (`verifyEdge → recordEpisode`). The gesture becomes a durable, human-fingerprinted record on the edge.
Why:        Machine-made knowledge needs a chain of custody a team can be held to.
Exemplar:   THE WEAVE — the confirm beat + "✓ who · when" stamp (local-graph.tsx, 1c9f9d0 / f65581b).

### [woven/doctrine/provenance-is-grammar] · human
Rule:       An unverified (`ai_generated`) edge renders **dashed / proposed**; a `human_verified` edge renders **solid**. On a card/row the provisional state is a **forest-wash + hairline** (never a dashed border — that reads as a dropzone); committing drops the wash to solid ink. Never render an inference as confirmed fact.
Why:        The user must always see proposed-vs-trusted at a glance; the encoding is per-surface (dashed on edges, wash on cards).
Source:     local-graph.tsx

### [woven/doctrine/owner-approves] · human
Rule:       A change routes to the owner of the collection it belongs to; only the owner holds the ✓. Others see it read-only. Ownership can be claimed ("take over"). This is queue routing: it never establishes Decision authority.
Why:        A multiplayer decision surface needs a clear authority.
Exceptions: Orphan changes fall back to the doc's author, then the viewer.

### [woven/doctrine/answer-is-cited] · human
Rule:       An "Ask" answer is a single, centered, **cited** claim the user can verify in place — never opaque cross-document synthesis. Citations point at a specific **block/section anchor** (`page#section`), not merely the whole doc. If the evidence isn't there, say so.
Why:        Honest scope; the differentiator is verifiability, not fluency.

### [woven/doctrine/space-is-boundary] · human
Rule:       The space is the access boundary: the sidebar, Ask, and the graph all scope to the current space; switching space re-scopes all three.
Why:        One boundary keeps what you can see, ask, and traverse consistent.

### [woven/doctrine/auto-rule-scope] · human
Rule:       A promoted auto-rule is a STANDING rule, not a one-time queue-clear. (1) Promotable only after **≥3 human confirmations, zero dismissals**; promotion is the human's explicit, revocable consent. (2) Once active it **intercepts future** matching proposals at creation (auto-confirms on arrival, never entering the Verify queue), told-not-asked. (3) **Confidence veto:** fires only when the arriving edge's confidence ≥ an internal floor (~0.70, tunable, NEVER shown as a number); below-floor stays in the Verify queue. Confidence can only *withhold*, never *grant* — the human promotion is the sole consent. (4) Each rule auto-confirm records an episode (rule + promoting human), lands in **Activity**, is undoable, and the rule is revocable in Governance. (5) Each rule carries a **Suggest↔Auto dial** (suggest = still pre-groups matching proposals but asks) + a **visible track record** (handled N · you undid M); **undoing what a rule did is a correction that auto-pauses the rule** — it keeps its evidence, stops acting, and waits for the human to Resume.
Why:        A rule that doesn't apply forward isn't a rule; the floor keeps a human on the shakiest commits without turning confidence into displayed consent; a correction pauses (not revokes) so an over-reaching rule stops and hands back to the human.
Source:     lib/api.ts promoteRule; floor = confidence-veto, Kyle 2026-07-15.
Exceptions: **Wired** — forward interception + floor (`ddcc532`); the Suggest↔Auto dial + track record (`f31652f`); correction-pause (`92ebfe7`). Veto-floor value stays Kyle-tunable. (Per-item undo of a *future* auto-confirm — distinct from the promotion batch's undo — routes through Activity; not yet a per-row control.)

## Inbox: the three-tense loop

- **[woven/inbox/three-tense-loop]** · guidance — the Inbox is ONE agent loop in **three tenses**, not three screens: **Decisions** (now · what needs your call) → **Activity** (doing · runs + colleagues) → **Governance** (learned · what it's trusted to self-run). Unify the three by a **shared AgentBand + one row grammar + cross-tab ties**, NOT a common grouping axis — each tab keeps its own natural spine (Decisions = priority · Activity = colleague · Governance = area). Forcing one spine fights the queue and breaks the AI-as-colleague story.
- **[woven/inbox/loop-is-navigable]** · guidance — the loop is legible + clickable from every end, in ONE shared capability vocabulary (`RULE_CAPABILITY`): Decisions "**becomes** ⟨cap · area⟩" → Activity "**under** ⟨cap · area⟩" (a run Woven ran autonomously names the responsibility it acted under, `AgentRun.ruleId`, and jumps to it) → Governance "**From your Decisions**". *(ed244b2 / 110ff58)*
- **[woven/inbox/decision-first]** · guidance — the **now** tense answers ONE question, "what's waiting on my call?" — a priority stream, one row per change; monitoring lives in Activity, autonomy in Governance, awareness in Today.
- **[woven/inbox/batch-by-shape]** · guidance — Decisions groups agent proposals by the shape the loop learns on (**relation × collection × confidence band**) into a ShapeGroup + "Confirm all N" — ONE action that clears AND teaches (recordDecision per edge); a shaky tier is its own group so a batch never sweeps a low-confidence proposal into a confident one; a colleague suggestion or a singleton stays a plain row. *(cf2ef10)*
- **[woven/inbox/judgment-loop]** · guidance — a consistently-confirmed shape surfaces one calm "Automate this?" nudge — a flat wash callout **set apart** from the feed by a gap (never a bordered card, never stuck to the first group); promoting records a revocable Governance responsibility (bounded by doctrine/auto-rule-scope). *(4136be3 / e5f8498)*
- **[woven/inbox/agent-is-a-colleague]** · guidance — Activity is a colleague monitor: the agent is a first-class colleague in the SAME feed as the people (same band + same row grammar); its runs group by status, the people under a "Teammates" group. *(e8b4e72)*
- **[woven/inbox/governance-is-trust-ledger]** · guidance — Governance is a **trust LEDGER, not an autonomy dial**: the agent is a colleague you **delegate to**, so it lists **responsibilities** (capability × area) on ONE earned-trust ladder **Watching → Trusted → Held back**. ONE object, **two origins** — *earned* (promoted from your decisions) / *granted* (you set it directly, the structured successor to a free-text instruction box). Trust is a *consequence* of your decisions, not a global slider; a quieter **floor** holds the global capability gates + "new areas start at Watching · unsure calls always come to you". — **supersedes** the earlier `governance-is-memory` (custom-instructions + rule-cards + baseline-preset framing).

## The feedback loop: how judgments become rules

Woven's **design process** and Woven's **product** run the *same loop* — capture human
judgment as observable decisions, promote the consistent ones to automation. That
symmetry is the thesis.

**Product** (shipped, 4136be3): you decide → Woven tallies the shape → a consistently-
confirmed shape becomes a candidate → "Automate this" → a revocable Governance rule
(bounded by `woven/doctrine/auto-rule-scope`).

**Design process** (this file) — Vercel's three roles, kept separate:
1. **Collect** (no judgment) — gather the raw material (a Kyle instruction, a screenshot, a commit) as an artifact; propose no rule.
2. **Judge** (validate, stay pending) — group evidence, separate fact from inference, count recurrences (rule of three); keep candidates pending. *(The gap-resolution + extraction workflows — ground-truth per gap/section — are this role.)*
3. **Decide** (human — Kyle) — a rule · a coverage gap · an exemplar · a lint · no change. Needs stable evidence, explicit scope + exceptions, Kyle as approver.

**Tier graduation** — `human` → `guidance` → `lint`; note the date + the evidence.

## Reference discipline: 引用纪律与执行原则（design + build，2026-06-30 追加）

把方法论从"怎么写 spec"延伸到"怎么依据引用做设计与实现"。

**先复述"形"，再动手。** 决策锚定到某个具名产品（"做成像 X 那样"）时，**先用一句话复述 X 的真实机制**——它真正的布局/交互，而不是气质——确认这就是要做的东西，**再写代码**。引用指的是一个具体的形，不是一种情绪："Mem 的搜索" = 全屏接管 + 居中两栏，**不是**泛泛的居中命令面板。若你说不出引用的具体形，就是还没理解这条指令——去问，而不是拿一个看着差不多的替身顶上。*（本轮：把 Mem 全屏接管误做成 Raycast 式命令面板，返工。）*

**先定引用的"层级"，再借。** 每个引用都处在两个高度之一——**PRD 级**（功能概念、信任模型、产品方向）或**交互级**（布局、像素、交互编排）。应用前先说清它管哪个高度。PRD 级引用（如 Cycle 的 verify 模型）启发产品决策，但**它的 UX 不可照抄**——自己设计交互；交互级引用（如 Mem 的搜索接管、Slite 的阅读宽度）管像素，可直接采纳。在错误的高度借用是范畴错误。

**语义 > 模仿：视觉冲突的 4 级优先级。** 引用的观感与 Woven 系统语义冲突时，**自上而下**仲裁，低级永不覆盖高级：(1) token 在 Woven 里的**语义**（某颜色/形状*意味着*什么）→ (2) 既有的**组件/模式规则** → (3) 引用的**具体形** → (4) 单纯的**审美偏好**。例：forest 只属于 provisional/agent（P-4 / P-7），所以把引用里 provisional 行的绿色 tint 搬到**已确认**表面，在第 (1) 级就错了——正确表面是中性 `canvas-raised`。

**先删除、后打磨。** 每个界面的第一遍：对每个元素问——它反映真实状态、或承载真实交互吗？两者皆无就**删掉**，而不是"做好看一点"。只设计经得起这一刀的东西。*（本轮删掉了静态 "agent · weaving 2" chip 与各分节 hover 铅笔，而非重做样式。）*

**方向明确就批量执行，只在真岔路停下问。** 方向明确时（截图圈定具体元素 + 具体反馈，或清晰的书面引用），**一口气端到端**做完这次改动。只在**真岔路**停：两种都说得通的解读、没有明确优先级的规范冲突、或不可逆/破坏性的步骤。在已定方向上过度确认是缺陷；偏向快速上线 + 外科式跟进（auto-deploy 支持）。

## Reversals and principles (June to July 2026, history record)

Two early threads below were later reversed and must not be acted on. "Three families" and serif titles became all-sans: Geist carries UI, display and reading, with no serif. "Forest marks propositions" became forest as chrome, agent and confirm only. The neutral-for-settled-content half still holds, and mono as the agent's voice still holds. Later changes: the WovenMark dish in the reversal table below is now the seal. The rows on provisional forest and the principle "Forest marks propositions" are overturned by confirm-only forest. `--primary-hover` is now `#2d5029`.

Instructive dead-ends — kept so future design does not repeat them. (Trivial back-and-forth omitted.)

| Reversal | Landed on | Lesson |
| --- | --- | --- |
| Mono used decoratively everywhere | **Strict mono** (agent + code/values only) | A voice is only a signal if it's reserved. |
| Oat too warm / "earthy" (dialed twice) | **Warm grey `#F1F1EE`** | A "warm" ground still has to be neutral; over-warmth reads dated. |
| Sidebar selected = green-fill + left bar | **Near-white raised pill + forest text** | Don't spend the brand color on a non-meaningful state; reserve forest. |
| Sidebar layout inset ↔ flush + continuous top line | **Inset** (accepting no full-width top line) | A recessed tone is boundary enough; a hard line reads heavier. |
| Space-switcher top → bottom → top | **Top-merged with collapse toggle** | "Where am I" belongs with the brand mark, at the top. |
| Card preview in a middle band | **Cover-top, full-bleed** | "See it first" — the preview leads. |
| MD cover excerpt 10px → 15px | **13px, below the title** | Preview, don't dominate: smaller than the title, bigger than a caption. |
| Hero as a bespoke card | **Unified into the 3-zone card** | One system, not two — bespoke variants drift. |
| `--primary-hover` undefined in CSS | **Defined `#2A4B3B`** | Spec tokens are inert until mirrored into `globals.css`. |
| Pills for badges only | **All action buttons are pills** | Pick one action language and commit. |
| Agent avatar = `band-ink` squircle | **Circle with a forest dish + `WovenMark`** (one avatar system) | The non-human tell can be the dish + glyph, not corner-radius — don't fork a second shape system. *(2026-06-30)* |
| Person initials in Fraunces (serif) | **Geist (sans)** | An avatar initial is UI chrome; keep the serif for reading + titles, don't cross the type lanes. *(2026-06-30)* |
| Provisional forest tint borrowed onto a confirmed content list | **Neutral `canvas-raised`** for settled content | Forest marks propositions, not confirmations; tinting settled content reads as "still deciding." *(2026-06-30)* |

---

## Principles to carry forward

- **Every UI element must justify "why it is here."** (The card's three-zone model exists because users needed each part explained.)
- **Neutral for transient, brand color for committed** — reserve forest for meaning; never spend it on hover.
- **Universal elements (dividers) align on shared baselines.**
- **Type-adaptive content inside a consistent frame** — content varies by type (HTML vs MD/DOC), the frame does not.
- **One system, not two** — dedupe components before adding variants.
- **Mono = the agent's voice; icons = chrome** — keep the agent's signal uncrowded.
- **Graph visualization is for audit, not navigation** — the relation list is a trust layer, not a star map.
- **Verify against the DOM, not assumption** — and mirror every spec token into the CSS.
- **Cut, don't polish** — if an element reflects no real state and enables no real action, **remove it**, don't design a nicer version. (Cut this wave: the static "agent · weaving 2" chip; per-section hover pencils/anchors.)
- **Forest marks propositions, not confirmations** *(**⛔ SUPERSEDED 2026-07-11 → forest = confirm only**; the neutral-for-settled-content half below still holds)* — `tint-forest` / `primary-wash` is agent/provisional only; confirmed content surfaces are neutral `canvas-raised`, depth by surface tone.
- **One avatar system, three keyings** — person (hashed dish + Geist initials), agent (forest dish + `WovenMark`), anon (muted + arrow); all circles. Distinguish by dish + glyph, not a second shape.
- **Anchor a reference at its altitude before borrowing** — PRD-level references inform the concept (don't copy their UX); interaction-level references govern pixels (adopt directly). See Reference discipline above.

### Reusable rules established (July 2026)

- **Graph-node/chip peeks anchor AT the node via `renderPopover`; list-row peeks stay inline** — a reveal should appear where the thing lives, not docked far below the canvas.
- **Size a graph by a metric that discriminates (Σ contribution weight), not raw degree; make it read at rest via cluster-color + size + tinted edges (~0.30)** — hover-only encodings hide the structure.
- **Fix the seed, not the color model; after a seed rebalance re-verify every showcase demo and sweep all derived structures (analytics, public-member lists) for stale references** — a collection lives in several mirrored places.
- **Curved edge geometry and its flow particle must share one helper, and cap the perpendicular bow (k0.08, cap 16px) so long spokes don't graze nodes** — two geometry computations drift; long spokes over-bow.
- **First-run showcase content must be engine-verified to land well** — don't write aspirational questions the honest engine can't answer.
- **The answer is cited AND verifiable-in-place (pending cites get the ✓/✕ valve, confirm IS the episode); a scope narrows center-resolution to the same node set Find uses** — the differentiator only lands if the pending edge is surfaced and resolvable in place.
- **A status/read-back slot renders only when it carries info** — kill idle filler ("ready," "always on") that an animated presence or placeholder already implies.
- **Every named graph entity is hover/click-previewable wherever it appears — titles AND body text** — mid-sentence names are entities too.
- **Entries in one feed share one row grammar (leading size, padding, text scale); the divider wrapper owns borders; each feed groups by its natural axis** — unify by band + grammar + ties, not a forced common spine.
- **The agent loop reads identically from all three tenses — each end names and links the next (Decisions "becomes X" / Activity "under X" / Governance "From your Decisions"); an earned-trust claim is inspectable (show your work)** — capabilities come from one shared vocabulary map.
- **Remove the lib surface when its UI is deleted** — per-area autonomy lives in the trust ledger; there is no global dial.
- **All filter facets share one searchable multi-select list model (OR within a facet); encode selection semantics in the control (checkbox = multi + no row fill, tick = single/clear); reserve a leading glyph column only where options carry glyphs; Clear-all is a real bordered button** — never a filled-row background for multi-select.
- **A metric figure is a door to the items it counts (hover-peek), not a dead stat; don't repeat counts the sidebar/chips already show.**
- **Grow the hit area (36×36) without moving the visual box; a toolbar reads at one size/weight/font (Interface body 15px)** — a small control inside a row link needs a target large enough that taps don't fall through.
- **Content cards keep faces (participants) as the one kept signal, not graph stats; shared card sub-components live in `artifact-ui.tsx` so every surface renders identically.**
- **Rail chrome is grayscale on one tonal ladder — no forest accent; an action control and a selection state must not share the same surface color** — differentiate by depth of grey well + ink.

### Method

This arc ran the same review→verify loop Woven productizes. Multi-agent reviews (an adversarial critic plus correctness- and design-focused reviewers) raised candidate issues; only the ones that survived verification against the running app shipped (e.g. 16 of 28 for ⌘K, verified live via preview eval). Seed and encoding changes were followed by regression sweeps that re-checked every dependent surface and showcase demo. The judgment captured here — observable decisions with their why — is the raw layer the canonical rules are promoted from.
