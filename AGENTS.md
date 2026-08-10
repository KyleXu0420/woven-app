# AGENTS.md — Woven

> **This file is the operating manual for any AI agent (Codex, Claude Code, …) working on Woven.**
> It is the single hand-off document: read it top-to-bottom once, then keep it open. Sections are
> ordered operational-first (how to run + the rules you must not break) → reference (maps, model,
> design, product) → intent (why the decisions were made) → what's left. When code and a prose doc
> disagree, **the code wins** — the "Load-bearing gotchas" section lists every known divergence.

---

## 0. TL;DR — what Woven is

**Woven is the agent-first home for AI artifacts — a collective brain.** You drop an artifact (an
AI-generated HTML page, a Markdown note, a doc); Woven weaves it into a team's **typed knowledge
graph** — extracted into blocks + entities, linked by typed edges, published to a living URL, and
made **findable / readable / trustworthy**. The wedge vs Notion/Slite: other KBs store *human-written
documents*; Woven stores *AI-produced living artifacts* and is the only tool that turns one knowledge
node into a trackable webpage in one click.

**The North-Star loop everything serves:**
> agent **captures** → **weaves** (extracts, proposes typed edges) → **nothing is "fact" until a human
> verifies** → confirmed edges enter the graph → you **Ask** over the graph.

**Division of labor:** the **agent is the primary reader/writer** (captures, structures, proposes,
answers, drafts). **Humans do three things: verify, curate, consume.** Visualization is a
**trust/audit layer, not navigation.** Provenance is first-class on every node and edge.

**⚠ The whole app is a mock in-memory prototype.** No backend, network, DB, or auth. Publishing,
analytics, capture, "AI" answers, agent runs are all *simulated* over a seed graph in `lib/data.ts`,
read/mutated through `lib/api.ts` (~150 accessors). The type schema in `lib/types.ts` is a useful start,
not a production contract. **Going live is not a fetch swap:** it also requires identity + workspaces,
async query/command ports, deny-by-default authorization, durable transactional storage, ingest jobs,
canonical events/outbox, cache invalidation, and server-side public delivery. `lib/api.ts` is the current
demo adapter. "Ask" is honest deterministic template output, **not** real synthesis.

---

## 1. Run & verify — the working loop (this is the harness)

```bash
pnpm install
pnpm dev            # runs bare `next dev` → Next's DEFAULT port 3000. (The .claude/launch.json "woven-app"
                    #  config pins 4322, but that's the Claude Code preview harness only — a Codex/general
                    #  `pnpm dev` is on 3000 unless you pass `-p`.)
npx tsc --noEmit    # typecheck (tsconfig: strict, noEmit:true, path alias @/* → ./*)
pnpm build          # next build (production)
pnpm lint           # eslint (flat config eslint.config.mjs: next/core-web-vitals + next/typescript)
```

Exact `package.json` scripts: `dev: "next dev"` · `build: "next build"` · `start: "next start"` ·
`lint: "eslint"`. Key deps: `next 16.2.9` · `react 19.2.4` · `@base-ui/react ^1.5.0` · `lucide-react` ·
`shadcn ^4.11.0` · `class-variance-authority` + `clsx` + `tailwind-merge` (→ `cn()` in `lib/utils.ts`) ·
`tailwindcss ^4` (`@tailwindcss/postcss`) · `tw-animate-css`.

- **Stack:** Next.js `16.2.9` (App Router, Turbopack dev) · React `19.2.4` · TypeScript strict ·
  Tailwind **v4** (`@tailwindcss/postcss`, **no `tailwind.config`** — tokens live in `app/globals.css`) ·
  shadcn (`style: base-nova`) on **Base UI** (`@base-ui/react`) · `lucide-react`. Package manager
  **pnpm**. `next.config.ts` only sets `devIndicators:false`.
- **Deploy:** push to `main` → **Vercel auto-deploys** to prod. Remote `origin` =
  `github.com/KyleXu0420/woven-app.git`. Author = `kuanghongxu <kylexu@umich.edu>`.

### The non-negotiable dev loop (follow it every change)

1. **Edit.**
2. **`npx tsc --noEmit` must pass** — no commit ships without it. Commit bodies literally note `tsc clean`.
3. **Browser-verify on the running preview** (port 4322), scoped to the exact surface you touched. Do
   not ask the user to check — verify yourself and show proof. State where you checked ("Verified in
   Read mode", "Verified in edit mode").
4. **Commit** with the house shape (below). **Then `git push origin main`** only when the change is
   done + verified (or the user asks). Branch first if you're ever told to.

### Commit-message shape (house style)

```
<Area>: imperative subject scoped by surface        e.g. "Reader: dial the reading scale down a notch"

Problem → fix → verification, in prose. Multi-change sessions list the batch as bullets.
Verified in <surface>. tsc clean.

Co-Authored-By: <your model> <noreply@anthropic.com>
```

Area prefixes seen in history: `Reader:` · `Edit copilot:` · `Inbox …` · `Graph …` · `Today` ·
`Library` · `Collection` · `Pass ②/③/④` (design-system audit passes).

---

## 2. Hard rules — the design + code doctrine you must not break

These are lint-tier. Breaking one is a regression, not a style choice. (The "why" is in §7; the
authoritative agent-facing rules layer is `~/Desktop/woven/DESIGN-RULES.md`, ~90 rules — **note that
`~/Desktop/woven/` is design docs, NOT a git repo; the app repo is `~/Desktop/woven-app`.**)

**Color**
- **One chromatic accent = forest `--primary`, and it is CHROME/AGENT/CONFIRM only.** Two treatments:
  *provisional/proposed* = forest **wash + hairline** (`border-primary/15 bg-primary/[0.04]`, dashed on a
  graph edge) · *committed* = the **one solid inked forest** (filled ✓, "Confirmed"). **≤1 solid-forest
  button per view.** Hover **deepens, never pales.**
- **Data series & data figures = NEUTRAL ink** (`foreground/40` line, `foreground/[0.06]` fill).
  **Forest is never a chart series.** Confirmed/settled content (Library, collection members, search
  results) stays neutral `--card` — forest-tinting settled content falsely says "agent still deciding."
- **`--chart-1..12` = DATA-IDENTITY only** (collections/topics/people/artifact families, via a
  deterministic id hash in `lib/identity.ts`) — **never a button, link, text, status chip, or chrome.**
- **Staleness = the semantic `--warn` token** (ochre) — never raw amber, never a `--chart-*` tint
  **even at the same hex** (see the ochre collision in §6). No 5th hue; success reuses forest.
- Warm ground, **never `#fff` / `#000`**; depth by **tone not shadow** (no gradient/glow). Use token
  vars, not raw hex.

**Type**
- **All-sans is LOCKED.** Geist for UI + display + reading; `--font-serif` is dormant plumbing that
  **resolves to Geist** (Fraunces retired — a `font-serif` class is *not* the design system). Reading
  distinctiveness = **size + leading + measure, not a serif.**
- **Geist Mono = the agent's own voice + real code/paths/values ONLY** — NOT eyebrows, counts, states,
  nav, badges, timestamps, IDs, or relation/edge labels (all Geist sans + `tabular-nums`).
- **UI weight capped at 400/500 — emphasis by SIZE, never a 600/700 weight.** No fractional px
  (15.5 → 15). **Sentence case everywhere**; UPPERCASE survives only on a tiny format badge (`HTML`/`MD`).

**Controls / components (reach for the shared primitive — don't hand-roll; see §8)**
- **Segmented switch → `SegToggle`** (track-and-thumb: recessed `bg-secondary` track **no border** +
  raised `bg-card shadow-sm` thumb **no ring**). Three control ROLES stay **deliberately distinct — do
  not unify**: `ViewTabs` (underline+forest, page-level) / `SegToggle` (in-view) / `FilterChips` (facet).
- **Accent = ACTION not SELECTION** — don't spend forest on both a tab's selected state and its actions.
- **Icon-only button → `IconButton`** (label REQUIRED → aria-label + tooltip; sizes `icon-xs/sm/icon/
  icon-lg` = 24/28/32/36 — **never hardcode `size-[Npx]`**).
- **Tick/cancel = pure icon + tooltip valve** (`Valve`): **Confirm = filled/primary icon, Dismiss =
  ghost icon**, anchored top-right of the row/card. Labelled bottom pills only for a genuine
  multi-choice item (Merge / Keep both / Replace) → `ChoiceValve`. Batch `✓ Confirm all N` only for a
  real batch (2+).
- **Radius ladder** (`--radius-*`): **sm 6 = inputs · md 10 = generic · lg 14 = cards/SegToggle/Ask-bar ·
  xl 20 = floating panels + artifact frame.** `rounded-full` = **action language only** (buttons/badges/
  avatars) — inputs, cards, panels are **never** pill. Fix the primitive (`ui/input|card|dialog`) and
  every instance follows.

**Dividers / rails**
- **Row dividers via the shared `DIVIDED` container class** (inset ~12px pseudo-element hairline). Rows
  carry **no `border-t`**. Standalone divider = `mx-3 h-px bg-border`. **Never a full-bleed border
  between rows (顶格). Never a left-edge accent stripe / hairline rail** on any component (it reads as
  templated-AI) — encode state via chip / icon color / leading dot / bg tint / type.

**Cards**
- **Minimize cards.** Content lists / rails / feeds = **one flat panel of `DIVIDED` hairline rows**, not
  a stack of bordered per-item cards. Graph/timeline canvases = **borderless soft field** (`rounded-2xl
  bg-card`, no border). **Cards survive only for:** floating surfaces (popover/toast/dialog/dragged
  card), Library grid **cover-cards**, and callouts. Depth by tone (`canvas → +1px line → band`), a card
  at rest has a hairline not a shadow.

**Layout**
- **`PAGE_FRAME` (`lib/frame.ts`) owns page width — ONE centered register `max-w-[1040px]`** (`focused`/
  `browse` are aliases kept so callers don't churn; `full` for graph canvases). **Woven has no card
  grids** — browse surfaces are single-column row lists. The reader is immersive-centered (sidebar gone).

**The always-in-force doctrine**
- **Nothing enters the graph as fact until a human confirms** (suggest-then-verify). **The confirm IS
  the episode** (`verifyEdge` also `recordEpisode`). Provenance is grammar (dashed/wash = proposed, solid
  = trusted). An Ask answer is a **single cited claim verifiable in place.**
- **Voice:** agent = present-tense telegraphic mono worklog ("weaving…", "linked to q4-roadmap") — never
  chats/sells/apologizes. Actions = verb-noun ("Drop an artifact", "Confirm"), never "Submit/OK".
  Banned adjectives: seamless / powerful / revolutionary / effortless. Numerals always digits.
- **Icons** = Lucide, outline, 2px, 16/20/24 (never <14), `currentColor`. Icons are chrome, never the
  agent's voice.
- **Full state set** on every interactive component (default/hover/active/focus-visible/disabled/
  loading). **Focus-visible = a 2–3px forest `--ring`**, never browser blue.
- **The brand mark (`WovenMark`, `AgentMark`) is hand-designed by Kyle — do NOT auto-generate or
  redesign it** without an explicit ask.

---

## 3. Codebase map

Two route groups. `app/(app)/**` is the signed-in shell (sidebar + topbar, `app/(app)/layout.tsx`).
`app/artifact/**`, `app/a/**`, `app/c/**` live **outside** the shell for full-bleed/public surfaces.
`app/page.tsx` → `redirect("/today")`.

| Path | Screen |
|---|---|
| `/today` | **Today** = daily entry. Continue hero (`HeroCard`), `CatchUp` "while you were away" digest, single most-urgent "Needs you" row (rest → Inbox), `AskSuggestions` footer. |
| `/library` | **Library** — every artifact; list⇄grid, facet `FacetBar`, multi-select bulk file/export/archive, drag to collections. |
| `/inbox` | **Inbox** = the agent's console. Three tabs via `ViewTabs`: Decisions (`InboxQueue`), Activity (`InboxActivity`), Governance (`InboxGovernance`). Deep-link `?tab=`. |
| `/activity` | redirect → `/inbox?tab=activity`. |
| `/team` | **Team** situation room: pulse stats, the space graph (`LocalGraph` orbit), a Review overlay to verify pending links/stale docs inline (verify-on-the-map). |
| `/topics`, `/people` | `Explorer` centered on topic / person entities (Suspense-wrapped for `?focus=`). |
| `/collection/[slug]` | **Collection** — tabs Contents (members, drag-reorder, agent "gather" approval, publish tail) · Map (`CollectionMap`) · Audience (KPI row + `TrendChart` + `BarList`, public/internal scope). Whole page is a drop target. |
| `/artifact/[id]` | **Artifact reader** (the core surface) — `<ArtifactReader>`, own chrome, `generateStaticParams` over all artifacts. |
| `/a/[slug]` | **Public artifact hub** — read-only microsite by `hub_slug`. |
| `/c/[slug]` | **Public collection hub** — client-rendered + localStorage-hydrated so freshly published collections resolve; leads with `EmergentMark`. |

### Components by area (all in `components/`)

- **Reader + edit copilot:** `artifact-reader.tsx` (**~1510 lines, the central surface** — `ModeBtn`
  Read·Edit, `Section` per-block `contentEditable`, `ProposalBar`+`DiffText`/`applyProposal` = the
  content trust valve, `ArtifactHeader`, `ReadingTOC` textless outline, `ContextRail`/`ContextDrawer`,
  `SaveStatus`, `FreshnessBanner`; uses `useDocSelection`) · `edit-chat-bar.tsx` (the docked copilot:
  state-aware **pill idle → card when a thread/proposal/suggestion opens**; one box, intent inferred;
  composer-on-top, suggestions-below) · `format-bubble.tsx` (manual inline marks at the cursor — **inline
  only, no block ops**) · `agent-mark.tsx` (the woven-thread agent glyph) · `section-comments.tsx`
  (block Discussions) · `version-history.tsx` (block diff) · `story-strip.tsx` (episodic memory rail) ·
  `emergent-mark.tsx` · `artifact-graph-overlay.tsx` (full-canvas per-doc graph).
- **Today:** `today-ui.tsx` (`Section`/`Row`/`RowList`/`SectionAction`) · `catch-up.tsx` (`EpisodeRow`,
  `EPISODE_LABEL`) · `ask-suggestions.tsx` · `today-date.tsx`.
- **Library/cards:** `cover-art.tsx` (`CoverArt`, `coverSeed`) · `artifact-ui.tsx` (`StatusPill`,
  `TypeBadge`, `Connections`, `PeopleStack`, `CollectionTag`) · `facet-filter.tsx` · `add-to-collection.tsx`
  · `add-documents.tsx`.
- **Collection:** `collection-map.tsx` · `collections-property.tsx` · `new-collection-popover.tsx`
  (describe-to-create) · `share-collection-dialog.tsx` (the access ladder).
- **Inbox:** `inbox-queue.tsx` (Decisions) · `inbox-activity.tsx` (colleague monitor) ·
  `inbox-governance.tsx` (trust ledger) · `inbox-agent-band.tsx` (`AgentBand`, `FeedHead`, `BADGE_CLS`) ·
  `proposal.tsx` (**`Valve` / `ChoiceValve` / `ConfidenceTag`** — the shared trust-valve primitives) ·
  `merge-sheet.tsx`.
- **Team/graph:** `local-graph.tsx` (**~1064 lines** — force/orbit canvas + `GraphLegend` + `layout()`;
  woven-bow edges, dashed = pending, `onVerifyEdge`) · `weave-backdrop.tsx` · `entity-profile.tsx` ·
  `entity-peek.tsx` (`SourcePeek`/`LinkPeek`/`PersonPeek`/`DecisionPeek` + `PeekTrigger`) · `explorer.tsx`
  (`Explorer`+`FocusPicker`) · `timeline-view.tsx` · `graph-ask.tsx`.
- **Capture:** `capture.tsx` (**~893 lines** — `CaptureProvider`/`useCapture`, `DropButton`,
  `GlobalDropZone`, `CaptureDialog`, Upload/Paste/From-Claude/Record sources → one `QItem` queue; STT
  stubbed). Ingest only; the agent's messy decisions land in the Inbox.
- **Share/publish/identity/controls:** `share-menu.tsx` (`SharePanel`/`ShareMenu`) · `publish-dialog.tsx`
  · `identity.tsx` (`PersonAvatar`/`AgentAvatar`/`AnonAvatar`/`IdentityGroup`) · `woven-mark.tsx`
  (`WovenMark`, `WovenWordmark`) · `controls.tsx` (`ViewTabs`/`SegToggle`/`FilterChips`/`DIVIDED`) ·
  `app-sidebar.tsx` · `page-heading.tsx` · `breadcrumb.tsx` · `theme-toggle.tsx` · `store-hydrator.tsx` ·
  `search.tsx` (**~964 lines** — ⌘K shuttle: ranked Navigate·Act·Find·Answer lanes).
- **`components/ui/*`** (shadcn-on-Base-UI primitives): `avatar`, `badge`, `button`, `card`,
  `confirm-dialog` (`ConfirmDialog` = the one second-step for consequential actions), `dialog`,
  `dropdown-menu`, `icon-button`, `input`, `popover`, `separator`, `sheet`, `sidebar`, `skeleton`,
  `toast` (`WovenToaster`), `tooltip`.

### The `lib/` layer

- **`lib/types.ts`** — the typed-graph schema (single source of truth; mirrors an `ARCHITECTURE.md §1`
  not in the repo).
- **`lib/data.ts`** (~1242 lines) — the seed graph.
- **`lib/api.ts`** (~2617 lines, ~150 exported accessors) — the current synchronous demo adapter **every
  page reads through** instead of hard-coding arrays. Preserve that single-boundary intent, but the
  production migration requires explicit async query/command contracts, authorization, persistence,
  events, jobs, and invalidation — not a mechanical `fetch` replacement.
- **`lib/store.ts`** — React-free "graph changed" signal (`bumpGraph`/`subscribeGraph`/`getGraphVersion`);
  **`lib/use-graph-version.ts`** — `useSyncExternalStore` hook so islands re-render on mutation.
- **`lib/identity.ts`** — deterministic id→tint (`--chart-1..12`) + `initialsOf` (FNV-1a hash, curated
  overrides for the known cast).
- **`lib/frame.ts`** — `PAGE_FRAME` (the one centered width register).
- **`lib/use-doc-selection.ts`** — reads the live browser selection over the static doc
  (text/image/block/none) + `selectionActions()` — the chatdoc heart.
- **`lib/notifications.ts`** (`notify` + named `toasts`) · **`lib/diff.ts`** (block + word diff over
  normalized `Block[]`) · **`lib/export.ts`** (Markdown / self-contained HTML / **JSON-with-graph-
  neighborhood**) · **`lib/artifact-drag.ts`** (`useCollectionDrop`) · **`lib/collections.ts`**.
- **Persistence (prototype only):** `persistState()`/`hydrateState()` snapshot collections +
  per-artifact membership/publish to `localStorage` `"woven:state:v1"`, re-applied by `StoreHydrator` +
  `/c/[slug]`. Everything else resets to seed on reload (episodes/merges intentionally not persisted).

---

## 4. Domain model (the typed graph)

**Nodes:** `Artifact` (id, `type` HTML|MD|DOC, `state` processing|living|archived, `prov`, `space_id`
permission boundary, `collection_ids`, `author_id`, `public`+`hub_slug`, presentation `gist`/`summary`/
`scale`/`updated`, optional `staleness`) · `Block` (sub-node: `anchor` citable id, heading, text,
optional image/callout) · `Person` · `Topic` · `Decision` · `Source` (external provenance: transcript/
meeting/audit/doc) · `Collection` (`slug`, `color`, `kind`, `owner_id`, `public_member_ids`,
`member_order`, `intro`) · `Space` (personal|team|org, visibility).

**Edges** are typed, directional, with **three-state provenance**:
`Edge { type, from, to, prov, confidence?, rationale?, anchor?, created_by }`.
`ProvState = "user_created" | "ai_generated" | "human_verified"`. `ai_generated` = pending the Verify
queue (**drawn dashed**); confirming flips it to `human_verified` (**solid**) — the trust valve.
`EdgeType`: `links_to`, `sourced_from`, `mentions`, `in_collection`, `authored_by`, `decided`,
`supersedes`.

**KG concepts (all derived in `lib/api.ts`, not stored as view-models):** Verify queue (`PendingEdge`,
`listPending`/`verifyEdge`/`restoreEdge`) · provenance/evidence (`getArtifactGraph`,
`getArtifactEvidence`, `Freshness` fresh|stale|superseded) · **episodic memory** (`Episode` — captured/
proposed/**confirmed**/commented/resolved/edited/superseded; `Discussion`/`Comment` durable threads with
before/after `suggestion`s) · conversational edit (`EditProposal`, `proposeBlockEdit`/`refineProposal`) ·
governance/trust ledger (`LearnedRule` = capability × collection, origin earned|granted, mode auto|
suggest, derived trust; `AUTO_CONFIRM_FLOOR = 0.7` is a veto floor) · agent runs (`AgentRun`) · Ask
(`askArtifact` → `ArtifactAsk`/`AskCite`; `askGraph` → path highlight) · collections/publishing
(`publishArtifact`/`publishCollection`/`artifactByHubSlug`, `CollectionCandidate` gather) · analytics
(`getAnalytics`) · capture reviews (`CaptureReview`, `mergeArtifacts`) · neighborhoods (`getNeighborhood`/
`collectionGraph`/`teamGraph`/`pendingGraph` — depth-bounded, never a global star-map) · permissions
(`Space` + `spaceMembers` + `canView(id, viewer)`).

**Seed (`lib/data.ts`):** 2 spaces (`sp_product`, `sp_leadership`); 9 people — **`pe_maya` (Maya Chen)
is the signed-in viewer = ME**, ∉ `sp_leadership` (so `a_comp` is the "you can't see this" search
target); 3 sources; 2 decisions; 5 topics; 3 collections (Q4 Roadmap / Growth / Research); ~12 artifacts
— **`a_notif` is the demo hero** (richly blocked; `a_notif_v2` supersedes it).

**Mutation contract (important):** a mutation that changes rendered data must call **both `bumpGraph()`
and `persistState()`**. Some accessors (`addArtifactsToCollection`/`removeArtifactFromCollection`) only
persist — **callers must `bumpGraph()`** or the UI won't re-render.

---

## 5. Design system (calibration)

The whole system = three materials in disciplined use: **warm paper** (never white), **Geist**
(all-sans), and **Geist Mono reserved for the agent's voice**. One chromatic identity: **forest**. Depth
from tone, not shadow. §2 is the rule checklist; this is the calibration.

**Palette (verified `:root`, warm near-monochrome, surfaces ~2–5% apart):**
`--background #f1f1ee` (canvas, never #fff) · `--card`/`--popover` #fafaf8 (raised) · `--secondary`/
`--muted` #e9e9e4 (sunk: inputs, SegToggle track) · `--border`/`--input` #e3e2dc · `--foreground` #1b1b18
(ink, never #000) · `--muted-foreground` #5a5852 · `--sidebar` #ecebe8 (a hair recessed = the boundary,
no divider). **Forest:** `--primary #1f3c1d` (light) / `#6fb58a` (dark) · `--primary-hover #2a4b3b`
(deepens) · `--primary-wash #e7ece3` · on-forest `--primary-foreground #f5f3ec`. **Semantic (fill/icon
only):** `--warn #b8863b` ochre · `--destructive #b23b2e` brick · success reuses forest. **Chart tints
(data-identity only):** 1 sage `#6e8b6a` · 2 ochre `#b8863b` · 3 teal `#4e8378` · 4 slate `#5b7793` · 5
plum `#7a5c86` · 6 mauve `#9c5f84` · 7 rose `#b0617a` · 8 clay `#b06a4f` · 9 ocean `#4a7f93` · 10
periwinkle `#6d6fa6` · 11 gold `#93883f` · 12 moss `#7e8a4c` (1–5 frozen, don't reorder). Prefer an
alpha wash over a new opaque grey. Dark = `.dark`, warm charcoal, **raised = lighter**, forest lifts to
sage.

**Type scale** (Geist; tracking tightens as size grows): display-xl 64/500 · display 44/500 · title
28/500 · heading 20/500 · body-lg 17/400 · body 15/400 · body-sm 13/400 · read-display 40/500 (artifact
title) · read 19/400 (artifact body, leading ≥1.55) · mono 13/11 (agent voice) · label 12/500
(sentence case). **Three density registers** (never cross): Reading (body 19 / H2 22 / title 34–40) ·
Interface (body 15 / secondary 13–14 / sub-label 12) · Dense (body 13 / meta 12). Hard floor **11px**.

**Controls grammar (`controls.tsx`):** ① **ViewTabs** = page-level, `border-b`, active = `text-foreground`
+ 2px forest underline (`bg-primary`). ② **SegToggle** = in-view, `rounded-lg bg-secondary p-0.5` track +
`bg-card shadow-sm` active thumb (no border/ring), seg `rounded-md px-3 py-1.5 text-[13px]` (`size="sm"`:
`rounded px-2 py-0.5 text-[12px]`). ③ **FilterChips** = `rounded-full px-3 py-1.5`, active `bg-secondary`.

**Dividers:** `DIVIDED = "[&>*+*]:relative [&>*+*]:before:absolute [&>*+*]:before:inset-x-3
[&>*+*]:before:top-0 [&>*+*]:before:h-px [&>*+*]:before:bg-border/60"` on the rows' container.

**Data-viz:** viz is trust/audit, always paired with the list. Single series = neutral ink; multi-series/
node-kind = the chart palette in order. **Confidence is NEVER a number** — a plain-language rationale +
a 3-bar meter (% only in a hover title). Five reused primitives: stat-cell grid · meter-bar (the row IS
the chart) · graded KB-health bars · sparkline · trend curve. KG = local neighborhood (depth 1–2);
`ai_generated` edge = dashed + forest-tinted, `human_verified` = solid.

**The agent mark (`agent-mark.tsx`):** two threads woven in a **real over-under braid** (not equalizer
bars) — bulging center, pinched ends. Inline SVG, `stroke="currentColor"`. Motion `.woven-weave`:
`state="idle"` gentle breath (~3.6s), `"thinking"` livelier (1.5s), `"still"` static until hover;
`prefers-reduced-motion` holds it. AgentAvatar = **forest-dished circle** bearing the mark. All three
actors (person tinted-dish monogram / agent forest-dish mark / anon muted-dish arrow) are **circles** —
differ by dish + glyph, never corner-radius. **Do NOT auto-generate the brand mark.**

---

## 6. Load-bearing gotchas — where code diverges from the prose docs

**When code and a doc disagree, trust the code.** These are the specific traps for a hand-off:

- **`--accent` is neutral `#e9e9e4`** in the shipped CSS (DESIGN.md's shadcn map calls it a
  primary-wash — stale). Accent is neutral.
- **`--warn` and `--chart-2` are the same hex `#b8863b` but semantically SEPARATE tokens** — warn =
  caution semantic, chart-2 = a data-identity tint. **Never substitute one for the other in code.**
- **`globals.css` ships all 12 chart tokens** (DECISIONS.md's "only 5 ship" is stale).
- **`PAGE_FRAME` is ONE centered width `max-w-[1040px]`** now. The older "left-anchor + three registers
  (focused 672 / browse 1000 / full)" in DESIGN-RULES.md is **retired**; `focused`/`browse` are aliases,
  `full` is for graph canvases. The centered-uniform model is what ships.
- **Reading-lane current render = H1 ~32 / section H2 ~21 / body ~16 / gist ~17** (a later retune). The
  front-matter `read 19` / `read-display 40` are the doc-of-record numbers; treat the render as current.
- **`README.md` is partly stale:** it lists a "Type voice" of Fraunces/Geist Mono/Playfair — the code is
  **all-Geist** (`--font-serif` → Geist, no Fraunces/Playfair loaded). It also says Ask answers are
  "synthesized" — they are **deterministic template output, not synthesis.**
- **`lib/types.ts` still names collection `kind` as `typed | simple`** — the product language is **Simple
  (hand-curated) vs Smart (rule predicate)**; rename `typed → smart` when the rule engine lands.
- **There was no `AGENTS.md`/`CLAUDE.md` before this file** — this document is the first agent guidance
  committed to the repo. The deep design docs (DESIGN.md, DESIGN-RULES.md, DECISIONS.md, the `product/`
  PRDs) live in the un-versioned `~/Desktop/woven/` dir, not in `woven-app`.
- **Dark theme** is "ratified" in DESIGN.md but "provisional" in DECISIONS.md — treat as
  **shipped-but-lightly-reviewed.**

---

## 7. Decision logic — the *why* behind the locked calls (per area)

Understand intent, not just the rule; these are the ratified decisions that shaped each surface.

- **Reader / edit copilot.** The artifact is agent-authored, so editing is **a conversation, not a blank
  WYSIWYG** — you direct, the agent drafts a **proposed diff shown in-body** (accept/reject → content
  becomes `human_verified`). The copilot is **ONE state-aware surface** (pill idle → card on
  thread/proposal); "sprawl" = the same verb in two places. **Routing is automatic** (question → cited
  Ask, else edit; no visible Edit/Ask toggle — a toggle pushes the model's job onto the user; hidden
  `/ask`·`/edit` override). Manual formatting floats at the cursor (inline marks only — block ops are
  no-ops). Rail = slim header + ONE `ContextRail` (task=Suggestions valve vs reference=Connections
  peeks); "Verify" is labelled **"Suggestions"** to the user (the term they know). Spec:
  `product/conversational-multiplayer.md`.
- **Inbox.** = the product-scale trust valve, a **pure DECISION queue** (awareness ≠ decision — CatchUp
  moved to Today). **ONE agent loop in three TENSES** — Decisions (NOW) → Activity (DOING) → Governance
  (LEARNED) — unified by a shared `AgentBand` + row grammar, **not** a forced common grouping axis. A
  decision UI **carries its own context** (gist inline, entities click-to-peek); group by subject doc.
  Neutral cards, not the provisional wash (in an all-provisional surface the wash marks nothing).
- **Today.** = the daily entry: **Resume → Orient → Decide → Ask.** A dashboard **hands off, it does not
  duplicate** (Needs-you → nudge to Inbox; Recent → "All in Library →"). Resume = the cover-art hero
  ALONE. Cohesion from **one row model + one accent + whitespace**, not per-widget chrome. `/activity`
  reads `?tab=` via `window.location.search`, **NOT `useSearchParams`** (that broke the Vercel build —
  it needs a Suspense boundary; see `ca04eb9`).
- **Library / collection.** Card taste = **portrait not landscape, faces not stats, summary-led**;
  multi-collection fold (`+N` popover). **Create is tiny, filling is separate, sharing lives on the
  collection page** (the stepped wizard was thrown away). Agent result-surfaces split three ways:
  automate the irreversible-safe quietly · inline the 1–2 reversible as valves · defer the many to the
  Inbox. Audience tab = published-content analytics (reference: Visitors + Dub); **KPIs ARE the chart's
  metric switcher**; a secondary scope filter under real ViewTabs is a **dropdown, not a second SegToggle.**
- **Team graph.** `/team` orbit: **color = primary-collection cluster · size = Σ contribution weight (not
  raw degree) · labels calm at rest · edges = woven curved spokes.** Reject rings/pie-fills on small
  nodes. Don't gild an encoding to hide a skewed seed — fix the seed (3/3/3 teams) but keep 1–2 real
  cross-team connectors (the WEAVE is the story). **Verify ON the graph in place** (`onVerifyEdge`).
- **Search / Ask (⌘K).** = a **keyboard shuttle into the collective brain** — one adaptive input,
  deterministic rule-based routing (no LLM in the prototype — honest), ranked union of 4 lanes. Edge over
  Raycast/Linear = **the answer is cited and its cited edges are verifiable in place.** Full-screen
  takeover, never a centered palette. A read-back slot shows only when it carries information.
- **Capture / voice.** Voice is a **modality, not a product** (meeting-first; never a voice-memo app).
  **Hard guardrail: ASR never auto-commits — always a proposal a human confirms.** `captureMeeting()` is
  the first path that writes real nodes.
- **Permissions / publishing.** = ONE "access ladder" (Only me → Invited → Space → Everyone → Anyone
  with link → Public hub); **the space is the boundary** (`space_id`). Roles map to Woven ACTIONS
  (Viewer/Commenter/Editor/Owner), not CRUD. Restricted graph neighbors show as **locked "request
  access" stubs, not hidden** (collective-brain discovery).
- **Governance.** = a **trust LEDGER, not a settings panel**; the unit is a RESPONSIBILITY (capability ×
  area) on one ladder (Watching → Trusted → Held back), mostly a **consequence of your decisions**. Two
  origins: **Earned** (promoted from decisions) · **Granted** (structured composer). Trust state is
  **derived, never stored** (`ruleTrust()`); the confidence floor is a veto (can withhold, never grant).
- **Episodic memory.** The graph = semantic memory (what's true); Woven adds **episodic** (who/when/why)
  — **the confirm-event IS the episode.** A teammate's suggestion resolves through the **same ✓/✕ valve**
  as an agent's edge — don't fork trust UIs.
- **Identity / avatar.** The signed-in viewer's tint must be **warm/vivid** (moved `chart-4` cold
  blue-grey → `chart-7` coral) — cold hues read as uncoloured placeholders in a warm palette. Monogram ≈
  0.42 of the circle.

---

## 8. Authoritative shared component library — reach for these, don't hand-roll

From the 2026-07-28 20-agent full-app audit (53 findings, passes `d79ab88`→`e3e650a`):

- **`SegToggle`** (`controls.tsx`) — the ONE segmented switch. 7 bespoke copies were collapsed onto it.
- **`DIVIDED`** (`controls.tsx`) — the inset row-divider container class.
- **`IconButton`** (`ui/icon-button.tsx`) — label REQUIRED. Bespoke exceptions are deliberate (dense
  toolbars, hint-tooltip triggers, input-embedded controls) — keep their glyphs on the 16/20/24 scale.
- **`Valve` / `ChoiceValve` / `ConfidenceTag`** (`proposal.tsx`) — the shared trust valve + 3-bar
  confidence meter (used by Inbox + /team).
- **`TypeBadge`** + count badge **`BADGE_CLS` / `FeedHead`** (`inbox-agent-band.tsx`) — one badge
  everywhere; a badge value = the summed viewer-actionable rows it stands for (the sidebar Inbox badge is
  a deliberate cross-tab superset — do **not** "fix" the inequality).
- **Radius ladder** (`ui/input|card|dialog`) — fix the primitive, all follow.
- **`PersonAvatar` / `AgentAvatar` / `AgentMark`** (`identity.tsx`, `agent-mark.tsx`).
- **`PAGE_FRAME`** (`lib/frame.ts`) — the single page-width source.
- **`ContextRail`** (`artifact-reader.tsx`) + **`entity-peek.tsx`** — reader rail + leaf peeks.
- **`today-ui.tsx`** (`Section`/`Row`/`RowList`) — shared row grammar (Today + Inbox + Search). `Row` has
  `interactiveTrailing` so a Valve never nests inside a clickable Row.
- **`AgentBand`** (`inbox-agent-band.tsx`) — shared agent header across all three Inbox tenses.
- **`artifact-ui.tsx`** + **`cover-art.tsx`** — shared card/hero pieces (Library card ↔ Today hero kept
  in sync).
- **`GraphLegend`/`EdgeSwatch`/`NodeSwatch`** (`local-graph.tsx`) — legend drawn with the canvas's own
  primitives, behind a quiet ⓘ.
- **`lib/export.ts`** (JSON carries the graph neighborhood) · **`lib/diff.ts`** · **`lib/artifact-drag.ts`**.
- **`SharePanel`** (`share-menu.tsx`) — the one access-ladder Share surface.

---

## 9. Product roadmap & open scope

**Concentric growth from one IC** (Maya, Staff PM = the wedge): private value (drop → living, linked,
shareable) → team value (shared graph) → org value (collective brain). Every collective-brain feature
must first make the IC's day better.

| Phase | Theme | Status |
|---|---|---|
| **P0** | Wedge — "your AI output stops dying": Capture · Artifact page · Publish+track · personal Ask · Library · Inbox | prototype-built on mock data; **produces the graph, depends on nothing** |
| **P1** | Collective brain (the showcase): org-wide cited/permission-aware Ask · minimum enforced permission boundary + canonical audit events · auto-weave + relation list + local graph · Topic/People discovery · provenance/decision view · verify queue · conversational edit (single-player) | designed; Explorer/Capture/Inbox valves built on mock; Ask/weave need the real graph, and org trust needs real enforcement |
| **P2** | Org enabler + operational shell: full Spaces (open/closed/private) · roles (member/guest) · member lifecycle · permission administration · org audit UI/export · plan/usage · MCP/API · KB-health | **designed, not built** — completes workspace administration and commercial lifecycle |
| **P3** | Multiplayer + governance polish: presence · comments/@ · grouped activity · KB-health radar | **designed, not built** — heaviest, least-differentiated, last |

**The 0-1 target = "P0 in full + the P1 showcase slice"** (org-wide cited Ask + Topic/People discovery +
relation list) on fake data — that pair IS the portfolio story.

### Product-completion bar — the finishing layer

**2026-08-09 audit verdict:** Woven's product model and design language are coherent; the Reader is the
showcase-quality calibration surface. The remaining gap is **system completion, not more features**.
Today, Library, Inbox, Collection, and Audience look like the same product, but demo truth, state-aware
hierarchy, copy, and graph legibility are not yet uniformly trustworthy. Those seams are what still make
the whole app read as a polished prototype instead of a finished product.

**The completion invariants below are lint-tier for the P0 + P1 showcase. A feature is not "done" just
because its happy-path UI renders.**

1. **One page = one legible job + one dominant next action.** The current state decides the action; do
   not leave several equal-weight controls for the user to interpret. Examples: an empty collection
   leads with **Add documents**; a populated collection should lead with the most valuable next step
   (**Ask this collection**, **Review changes**, or **Update hub**, depending on state), while add/share
   recede. Today must preserve Resume → Orient → Decide → Ask, with one clear hand-off per zone.
2. **Cross-surface truth is absolute.** Counts, public/private state, collection membership, freshness,
   owners, and analytics scope must agree everywhere. A Public-hub view may never rank a private
   artifact; a sidebar badge must reconcile with the actionable rows it represents; a published URL must
   resolve to exactly what the internal surface says is live. Derive these from accessors — never maintain
   parallel display-only arrays.
3. **The demo is a product state, not placeholder content.** Seed dates, relative times, names, copy,
   counts, and simulated agent activity must form one believable present-tense story on every route.
   Never ship a stale fixed weekday/date on Today, contradictory metrics, impossible activity order, or
   grammar such as “every links.” If time is fixed for deterministic tests, label the dataset as a demo;
   otherwise derive display dates from one seeded clock.
4. **Every primary flow has the complete state set.** Verify default · hover · active · focus-visible ·
   disabled · loading · empty · populated · error/retry · success/undo, plus stale/superseded, restricted,
   and proposed/confirmed states where the domain requires them. The mock accessor must be able to
   produce each important state without component-local hard-coded fixtures.
5. **Every page hands off to the next step.** The north-star loop is Drop → Weave → Verify → Read/Ask →
   Publish → Learn. After any primary action, the result and next destination are visible without hunting:
   capture lands in the artifact or Inbox; confirmation updates provenance and Story; publishing exposes
   the live URL; analytics links back to the artifact it describes.
6. **Information stays readable at real working density.** Quiet is good; detached metadata and tiny
   controls are not. Secondary copy must remain comfortably legible, right-rail content must not collapse
   into ellipses, and wide screens must not turn related content into distant islands. Test the signed-in
   shell and Reader at 1280×800, 1440×900, and a wide desktop before calling a layout complete.
7. **Graphs must answer a question before they decorate a page.** Every visible node needed for the task
   is identifiable; important labels do not collide or truncate; edge state/meaning is recoverable; the
   layout uses the canvas instead of clustering in a small centre with dead space. Keep the list as the
   accessible, operational counterpart to the visualization.
8. **Copy and accessibility get a final human-quality pass.** Sentence case, product vocabulary, actor
   voice, pluralization, punctuation, and locale are consistent. Keyboard order follows visual order;
   icon-only actions keep labels/tooltips; focus is visible; reduced motion is respected; state changes
   are not communicated by colour alone. Screenshot review can flag risks but does not prove compliance.

#### Operational completion — the backstage product

**The signed-in product is not complete if only its showcase flow is complete.** Settings, delegated
authority, member lifecycle, usage/plan state, and audit history are the backstage system that makes an
AI workspace feel safe enough for a real team. They must use Woven's own quiet visual grammar and the same
domain truth as the foreground product; they are not a generic SaaS-settings skin or a collection of
decorative enterprise stubs.

1. **Expose responsibilities, not raw model knobs.** A configurable agent behavior must state the job it
   changes, its scope (org/Space/collection/artifact), the direction and consequence of the value, and the
   current/default value. Consequential recalculation needs a preview/diff before save; provide reset,
   success/undo where reversible, and a direct link to the recorded change. Never expose temperature,
   confidence, or an opaque score merely to make the product look tunable — map control to the human
   responsibility (`Trusted` / `Watching` / `Held back`) and its visible effect.
2. **One access model powers every surface.** Roles, Space membership, collection sharing, public hubs,
   Ask/search results, publishing, export, Governance, and restricted states must all resolve through the
   same permission contract. The admin view must explain, in plain language, what each role can view,
   create, edit, publish, govern, and export. Role changes, invites, suspensions, removals, and ownership
   transfer are consequential actions: protect the current owner, retain history, and write an audit event.
   In production, missing/unknown membership never silently defaults to visible.
3. **Member, seat, plan, and permission counts reconcile.** Active · invited · expired · suspended is the
   minimum member lifecycle. If commercialization is in scope, the plan surface shows current plan,
   renewal/trial state, usage limits, seats consumed/available, invoice/payment destination, and who may
   change billing; the product never claims activation before provider confirmation. Do not pull billing
   into P0 solely to make the demo look SaaS-complete — build it when auth, workspaces, and a real buyer
   make the lifecycle true.
4. **Use one canonical event stream, then project it for different jobs.** Reader **Story** is an
   artifact's human narrative; Inbox **Activity** is the agent work monitor; **Governance** is delegated
   authority; the future org **Audit** view is the immutable compliance projection. They must derive from
   one event contract carrying actor (human/agent/system), action, object + stable ID, org/Space scope,
   reason, local + UTC time, before/after values, provenance, and related run/rule/decision IDs. No surface
   keeps a second, contradictory history.
5. **The audit view is operational, not ornamental.** It needs actor/object/action/reason search, category
   and time filters, export when authorized, readable before/after diffs, and deep links back to the object,
   rule, run, or decision. Logs are append-only; undo creates a new compensating event rather than deleting
   history. Human confirmations and agent autonomous actions are equally visible.
6. **No dead enterprise theatre.** A visible setting or permission control must work against an honest mock
   state or be clearly labelled as a read-only product preview. Never present an editable-looking matrix,
   plan button, invoice link, or member action that silently does nothing. Finish locale, status vocabulary,
   loading/error/empty/restricted states, and destructive confirmations to the same standard as Reader.

#### Global completion action plan — frontstage proof, backstage truth

**Current shipping target:** make Woven feel complete by closing one narrow, honest product loop before
adding breadth. The dependency order is:

`F0 shared truth → P0 individual-contributor wedge → P1 collective-brain proof → P2 operational shell → C2 commercial expansion`

Each arrow is a product gate, not merely a suggested calendar order. A later surface cannot create its
own version of access, counts, time, history, or success. A feature is admitted only when it advances the
north-star loop, reads shared truth, produces an explicit next hand-off, and has an honest non-happy state.

**How to use this list:** unchecked items are open. Mark an item `[x]` only when its complete acceptance
criteria and the release-quality gate below pass; a component mock or polished screenshot is not completion.
The deterministic adapter may prove the portfolio experience, but a real-team beta must run the same
contracts over durable, authorized storage.

##### F0 — shared-truth foundation (P0 prerequisite)

- [ ] **F0.1 — Establish one `CommandContext`.** Every query and command receives `actorId`, `viewerId`,
  `workspaceId`, `activeSpaceId`, effective role, request/idempotency ID, and an injected `Clock`. Remove
  business-layer dependence on hard-coded `VIEWER`, `sp_product`, browser time, and magic "now" strings.
  Tests can run the same operation as Maya and Theo in a fixed instant and Space.
- [ ] **F0.2 — Make domain states explicit.** Separate `Origin` (`human | agent | import`) from
  `VerificationStatus` (`proposed | verified | rejected`) and specify allowed transitions for artifacts,
  edges, ingest jobs, agent runs, learned rules, memberships, grants, and publications. Invalid transitions
  return typed errors; repeating an idempotent command never duplicates an object or event.
- [ ] **F0.3 — Introduce async query/command ports.** Components call typed domain queries and commands;
  the current `lib/api.ts` becomes a deterministic in-memory adapter rather than the permanent contract.
  Commands own validation, mutation, invalidation, and result state; components do not mutate arrays,
  author authoritative local state, call `bumpGraph()`, or declare success from a timer.
- [ ] **F0.4 — Enforce deny-by-default authorization.** Unknown workspace/Space membership denies access.
  Reader direct URLs, Today, Library, Collections, Search/Ask citations, Explorer graph hops, Team rollups,
  export, and public delivery return the same allow/redact/not-found outcome. Regression fixtures prove that
  a restricted artifact cannot be discovered indirectly while an authorized teammate can use it.
- [ ] **F0.5 — Unify access, share, and publication truth.** Model workspace ACLs, direct grantees, link
  grants/tokens, public discoverability, public member sets, publication revision, and revoked/published
  timestamps without collapsing `workspace`, `link`, and `public` into one boolean. Reader Share,
  Collection Share, Search actions, headers, Audience, `/a`, and `/c` read and mutate this one source.
- [ ] **F0.6 — Define `AuditEventV1` and atomic command semantics.** Every successful consequential command
  returns an `eventId` and records workspace/Space, human/agent/system actor, action, stable object + version,
  reason, UTC instant, command/correlation/causation/run/rule/decision IDs, provenance, and before/after.
  Failure leaves no half-change; Undo writes a compensating event instead of erasing history.
- [ ] **F0.7 — Define the persistence and projection boundary.** Repositories cover workspaces,
  memberships, artifacts/blocks, edges, collections, grants/publications, ingest jobs, runs/rules, and events.
  Story, Activity, Governance, Audit, Audience, and Attention are named projections, not competing stores.
  The demo adapter stays deterministic; the beta adapter adds transactions, versions, durable events/outbox,
  retry, and reload/cross-browser survival under the same contract tests.
- [ ] **F0.8 — Establish one Clock, count selectors, and per-viewer Attention model.** Store instants, derive
  relative labels, and make Today "Needs you", Inbox decisions, sidebar badges, and Team rollups filters of
  `AttentionItem { actor, owner, space, kind, urgency, age, objectId, action, reason }`. Visible counts equal
  visible actionable rows for the same viewer and query; urgency is not a confidence score.
- [ ] **F0.9 — Build completion fixtures and contract tests.** Maintain at least full, empty, first-use,
  loading, error, restricted, stale/conflict, destructive-confirm, and undo scenarios. Inventory every visible
  control: wire it to a command, label it read-only/preview, or remove it. Run the same permissions, counts,
  publication, event, and idempotency contracts against each adapter. The current repo has no test script and
  an existing ESLint failure baseline; clear both and lock the gate before treating green CI as evidence.

**F0 is done when** one object has one answer for visibility, publication, owner, status, time, count, and
history regardless of entry point; every visible mutation returns a typed result and canonical event.

##### P0 — close the individual-contributor wedge

- [ ] **P0.1 — Turn every Capture source into an honest ingest path.** Upload, Paste, Claude import, and
  Record use one typed job/command flow that creates a real Artifact, Blocks, source/provenance, proposed
  relations, Attention items, and capture event. Progress, cancel, retry, and failure are truthful; the Done
  screen derives its links, placement, and proposal count from the committed result and never claims
  "woven in" before commit.
- [ ] **P0.2 — Make review and Verify apply the claimed effect.** Merge, rename, archive, extraction, and
  edge confirmation update their target and resolve the queue atomically. Failure keeps the task; Undo restores
  the target and queue state while adding a compensating event. Reader, Inbox, Today, Library, Collection,
  Team, Story, and graph projections reconcile immediately.
- [ ] **P0.3 — Make Reader edits canonical and reload-safe.** Rename, manual block edit, inserted note,
  accepted AI edit, and colleague suggestion write the same versioned artifact. Save UI reflects real
  pending/saved/error/conflict state with retry. Library, Search, Ask citations, Story, and public delivery
  resolve the new title/content rather than Reader-only React state.
- [ ] **P0.4 — Prove one cited personal Ask.** Answer one useful claim over the viewer's accessible graph,
  cite the exact artifact/block and provenance, deep-link to the evidence, and show an honest insufficient-
  evidence state. Ask never synthesizes from a node the viewer cannot otherwise open.
- [ ] **P0.5 — Close publish → visit → revoke.** Publishing creates a server-resolvable, public-safe artifact
  or collection revision; collection hubs link only to public-safe readers. Preview names the exact public
  member set and restricted conflicts. Unpublish/revoke invalidates the old URL and records the event; the
  interface hands successful publishing to the next truthful Audience state.
- [ ] **P0.6 — Make foreground hierarchy and hand-offs state-aware.** Today Continue uses the viewer's most
  relevant unfinished work with a stable fallback; Needs You uses canonical Attention; Inbox sorts by urgency,
  owner, age, and blocked-by; populated Collection headers shift from fill/review to publish/manage/learn.
  Resolve an item from any entry point and every adjacent count/CTA updates in the same tick.
- [ ] **P0.7 — Finish the visible wedge to human quality.** Run copy/pluralization, locale, keyboard/focus,
  reduced-motion, responsive density, truncation, and colour-independent-state passes. The full/empty/loading/
  error/restricted/conflict/undo states use Woven's quiet grammar; no enabled-looking control ends in a toast,
  local-only state, or no-op.

**P0 is done when** a new user can Drop/Paste → review/Verify → read/edit → Ask with evidence → publish →
revoke without encountering a fake success, contradictory count, inaccessible next step, or reload surprise.

##### P1 — prove the collective brain to a real team

- [ ] **P1.1 — Expand Ask to permission-aware team synthesis.** Produce a multi-artifact answer from the
  active Space, with exact block citations, relation rationale, freshness, and provenance. Restricted evidence
  becomes a non-leaking stub only when useful; it never reveals title, excerpt, identity, or graph neighbors.
- [ ] **P1.2 — Make evidence, list, and graph one projection.** Reader relations, Ask paths, Explorer
  List/Graph/Timeline, Topic/People discovery, and Collection Map share center, viewer, Space, depth, filters,
  provenance, and edge state. Verifying in any view updates the answer, graph, Story, Governance, and Audit.
  Every graph task has a keyboard-usable list equivalent and non-colour state encoding.
- [ ] **P1.3 — Project one event stream for four jobs.** Story narrates one artifact, Activity monitors agent
  work, Governance explains delegated authority, and Audit records immutable org facts, all carrying the same
  event ID. Projections rebuild from the event log; an Undo cannot leave a stale "confirmed" story behind.
- [ ] **P1.4 — Make delegation produce observable consequences.** Agent runs have queued/running/succeeded/
  failed/needs-you/cancelled lifecycle, owner, progress, cause, retry, and related artifacts/events. A learned
  rule moves deliberately through `watching → trusted → held back → revoked`; confirmations teach the same
  loop regardless of whether they started in Reader, Search, Inbox, or Team.
- [ ] **P1.5 — Make Today, Inbox, and Team accountable projections.** Today is re-entry, Inbox is the work
  queue, and Team is the active-Space rollup—not three global queues. Every stat opens the exact rows behind it;
  take-over changes owner, nudge is real or explicitly unavailable, and resolving work updates all projections.
- [ ] **P1.6 — Close Collections curate → publish → learn.** Candidate pools include only accessible,
  non-archived active-Space artifacts. Approve/dismiss writes membership + event; public reads create
  privacy-safe `ReadEvent`s; Audience range/KPIs/member counts derive from those events and hand useful learning
  back to the Collection/Today instead of displaying seeded analytics as live truth.
- [ ] **P1.7 — Give Library and Collections complete lifecycle semantics.** Define archive once, add Archived
  + Restore + bulk confirmation/Undo, keep filter/search/export within the same working set, and expose real
  processing/run state. Add smart-collection rules only after manual membership and candidate effects are true.
- [ ] **P1.8 — Complete team discovery without leakage.** People, Topics, Search, Explorer neighborhoods,
  exports, and public hubs filter at the data source. Labels do not collide/truncate at standard widths, list and
  canvas remain task-equivalent, and direct/deep links preserve the authorized center and context.

**P1 is done when** a teammate can ask, inspect evidence, verify a proposal, observe the learned/delegated
consequence, and see the same fact in Story, Activity, Governance, Audit, Today, Inbox, and Team.

##### P2 — build the minimum operational shell

- [ ] **P2.1 — Add an honest Workspace/Settings shell.** Start with a read-only summary sourced from real
  workspace, Space, member, role, and event data; do not add a generic settings nav around seeded cards.
- [ ] **P2.2 — Complete Space and member lifecycle.** Support owner/admin/member/guest, Space inheritance and
  scoped overrides, invite pending/accepted/expired/revoked, member active/suspended/removed, and ownership
  transfer. Protect the last owner and retain event history through removal.
- [ ] **P2.3 — Explain and enforce permissions.** The admin readout says what each role can view, create, edit,
  publish, govern, invite, export, and administer in Woven language. Every displayed effective permission is
  computed from the same contract used at the read/write boundary.
- [ ] **P2.4 — Complete the org Audit projection.** Add actor/object/action/reason search, category/time/Space
  filters, readable before/after, deep links, authorized export, retention/redaction policy, and local + UTC
  timestamps. Human confirmations, autonomous agent work, member changes, access, export, and billing changes
  appear under the same event schema.
- [ ] **P2.5 — Make agent responsibility adjustable, not model-theatre.** Controls name job, scope, direction,
  consequence, current/default value, preview/diff, reset, save, and audit hand-off. Expose `Trusted`, `Watching`,
  and `Held back`; do not expose raw temperature or confidence merely to look configurable.
- [ ] **P2.6 — Add integration health only for supported dependencies.** MCP/API/knowledge-source rows need real
  connection state, last sync, scoped permission, failure cause, retry, and audit history; otherwise keep them
  out of navigation or label a non-interactive product preview.

**P2 is done when** an owner can add and restrict a teammate, explain the effective access, change agent
responsibility, and reconstruct the consequence from Audit without any decorative enterprise control.

##### C2 — conditional commercial expansion

- [ ] **C2.1 — Validate the buyer and billing unit first.** Decide whether Woven sells per workspace, active
  seat, usage, or another unit, who owns billing, and where the paywall belongs in the core loop.
- [ ] **C2.2 — Add truthful entitlement and plan/usage readouts.** Only after real auth/workspaces exist, show
  plan, renewal/trial, limit/usage, seats consumed/available, billing owner, and who may change them; use
  owner-only read-only states until provider data is authoritative.
- [ ] **C2.3 — Add provider-backed checkout, invoices, and webhooks.** The provider webhook—not an optimistic
  browser result—changes subscription status. Reconcile seats, member lifecycle, entitlements, invoices,
  payment failures, cancellation, and audit events; prove retry and out-of-order webhook handling.
- [ ] **C2.4 — Gate enterprise breadth behind demand.** SSO/SCIM, advanced retention, API keys, MCP admin,
  procurement, and deep integrations enter the roadmap only when a validated buyer requires them.

**C2 is done when** product access, member state, displayed usage, invoice state, provider state, and Audit
all reconcile for the same workspace; until then billing is not part of the product-completion claim.

##### Recommended vertical slices (ship in this order)

1. **Dead output → living artifact** (`F0` + `P0.1–P0.3`): ingest one output, inspect proposals, verify it,
   edit it, reload it, and find the same artifact everywhere.
2. **Team answer → defensible evidence** (`F0.4–F0.8`, `P0.4`, `P1.1–P1.3`): answer one consequential team
   question, inspect exact evidence, verify a relation, and observe every projection update.
3. **Delegation → observable consequence** (`F0.6`, `P1.3–P1.5`): trust one scoped rule, watch a run, take
   over or undo, and reconstruct why the system acted.
4. **Teammate → safe boundary** (`P2.1–P2.4`): invite a second persona, restrict one Space, prove every
   discovery/public/export route, and inspect the audit trail.
5. **Workspace → honest commercial state** (`C2`, conditional): validate buyer, connect entitlement/provider,
   change a plan, and reconcile product access + invoice + Audit.

##### Release-quality gate for every completed item

- The visible result, underlying object, projection counts, URL/access, time, owner, and event agree after the
  action, Undo, route change, reload, and—where applicable—a second viewer/browser.
- Permission regression covers direct URL, Search/Ask citation, graph hop, collection, export, public hub, and
  server resolution. Unknown membership denies.
- Happy, first-use/empty, loading, error/retry, restricted, stale/conflict, destructive-confirm, and undo states
  are either implemented or deliberately excluded from the slice with truthful UI.
- Browser verification covers the signed-in shell and Reader at 1280×800, 1440×900, and wide desktop;
  keyboard order, focus, tooltips/labels, reduced motion, contrast, truncation, and non-colour state all pass.
- Contract/permission/idempotency tests pass against the current adapter; `npx tsc --noEmit`, `pnpm lint`, and
  `pnpm build` are green. The verification note names the flow, personas, routes, and states—not "looks good."

##### Explicitly deferred until the dependency exists

- Real STT, live multiplayer/presence, immersive graph phase 2, public embedded graph, deep drop-off analytics,
  and broad integration administration are P3—not prerequisites for the first honest loop.
- Do not build billing before buyer/billing-unit validation, or SSO/SCIM/procurement before customer demand.
- Do not let design polish substitute for shared truth, but carry craft debt inside the matching slice: the
  shared `Checkbox`; remaining real-wait `AgentMark state="thinking"` states; favicon/wordmark placement;
  topbar/density and Reader Ask/Today rhythm; provisional-vs-confirmed sweep; Library row register; Reader rail;
  Collection Map and artifact-graph label/canvas fit.
- Today's calendar label is already dynamic; the open time problem is the lack of one injected Clock shared by
  UI, seed events, relative labels, analytics, and tests. Capture already uses thinking marks on some waits;
  audit only uncovered long-running states instead of reopening finished work.

**The product-completion workflow for every agent change:**

1. Name the user job, starting state, success state, next hand-off, release bar, and action-plan ID before editing.
2. Trace the target upstream and downstream; list the shared fields that must remain consistent (identity,
   status, visibility, provenance, time, owner, collection, URL, count, attention, event, seat/usage).
3. Put the rule in a typed domain query/command contract. The current implementation may live in `lib/api.ts`,
   but components do not become new authorities and production design does not assume that file is the contract.
4. State permission outcomes, state transition, command result, event, invalidation, persistence, and Undo before
   building any access, autonomy, content, member, publish, export, or commercial UI.
5. Implement the narrowest end-to-end vertical slice. Wire, label preview/read-only, or remove every visible
   action in scope; do not fill adjacent pages with speculative controls.
6. Run the release-quality gate, then re-run the north-star hand-off and at least one adjacent route/persona.
   A local improvement that creates a contradictory count, event, access result, or success claim is a regression.
7. Mark `[x]` only with evidence, then commit. The verification line names the flow and states checked.

**The largest structural gap remains the domain/backend boundary.** `lib/api.ts` is a synchronous mutable demo
adapter; Postgres/graph/vector storage, identity/workspaces, transactional commands, event/outbox, ingest/agent
jobs, server public delivery, cache/invalidation, and the permission model are unbuilt or sketches. Ask quality
still depends on graph density. Three honest market unknowns remain: do AI teams produce enough artifacts; is
"publish to a living page" painful enough; and who is the buyer. Resolve them through the vertical slices, not
by pre-building a broad admin suite.

---

## 10. How to work here (the collaboration model)

- **Kyle drives fast, pointed UI reviews** — usually by selecting an element and giving a short
  instruction (often in Chinese). The expected response is **evaluate → form a design judgment → act**,
  not "options for you to pick." When a call is genuinely his (a product/brand direction with real
  tradeoffs), present your recommendation + the tradeoff and let him decide, then execute; otherwise pick
  the obvious option and move.
- **"评估和提升" / "更加考究" / "彻底重做"** = evaluate + elevate / make it more refined / rebuild from
  scratch. These want craft-level care, not a patch. Don't be captured by the existing design when told
  to rebuild.
- **Every change:** `tsc` → browser-verify the exact surface → commit (house shape + trailer) → push.
  One coherent change per commit; batch sessions list bullets.
- **Reach for the shared primitive** (§8) before hand-rolling; if you must diverge, it's a deliberate,
  named exception.
- **Respect the doctrine** (§2) as invariants — a change that breaks one is a regression even if it
  "looks fine."
- **This file is the harness.** Keep it current: when a locked decision changes or a new shared primitive
  lands, update the relevant section here in the same change.

---

# Appendices — the concrete reference (verbatim from source)

These turn "understanding" into "able to edit correctly." Everything below is read straight from the
code, not a summary; when it and a prose doc disagree, this wins.

## Appendix A — Repository layout

```
woven-app/
├── AGENTS.md                  ← this file (the only agent-guidance file in the repo)
├── README.md                  partly stale — see §6 (Fraunces/"synthesized" are wrong)
├── package.json               scripts: dev · build · start · lint  (bare `next`, NO -p flag)
├── next.config.ts             sets devIndicators:false only
├── eslint.config.mjs          flat: next/core-web-vitals + next/typescript
├── components.json            shadcn (style "base-nova", on Base UI)
├── tsconfig.json              strict · noEmit · paths @/* → ./*
├── .claude/launch.json        Claude Code preview harness — pins port 4322 (NOT used by pnpm dev)
├── app/
│   ├── layout.tsx             root: Geist + Geist Mono, <html> metadata
│   ├── page.tsx               redirect("/today")
│   ├── globals.css            ALL design tokens (335 lines). NO tailwind.config exists.
│   ├── (app)/                 the signed-in shell (sidebar + topbar via (app)/layout.tsx)
│   │   ├── today/  library/  inbox/  activity/(→ /inbox?tab=activity)
│   │   ├── team/  topics/  people/
│   │   └── collection/[slug]/
│   ├── artifact/[id]/         the reader — OUTSIDE the shell, own layout.tsx (Tooltip+Search+Toaster)
│   ├── a/[slug]/              public artifact hub (generateStaticParams over public artifacts)
│   └── c/[slug]/              public collection hub (client-rendered + localStorage hydrate)
├── components/                47 feature components  +  components/ui/ (16 shadcn-on-Base-UI primitives)
└── lib/                       14 modules (types · data · api + 11 helpers — Appendix D)

~/Desktop/woven/               ← the DESIGN DOCS live here, and this dir is NOT a git repo
   DESIGN.md · DESIGN-RULES.md (canonical, ~90 agent-facing rules, tier lint/guidance/human)
   · DESIGN.dark.md · DECISIONS.md · DESIGN-METHODOLOGY.md
   · product/{personas-jtbd, journeys, explorer-framework, conversational-multiplayer,
     capture-workflow, audience-analytics-prd, sitemap-roadmap}.md
```

Doc authority chain: **`DECISIONS.md` (raw log) → `DESIGN-RULES.md` (canonical) → `DESIGN.md` (narrative)**.
Code overrides all three on conflict (§6). The design docs are written-not-committed (separate dir), so
they can drift from the app — always confirm against the code.

## Appendix B — Design tokens (verbatim `app/globals.css` `:root`)

Use the Tailwind-v4 utility (`bg-primary`, `text-warn`, `border-border`, `bg-chart-4`), never raw hex —
`@theme inline` maps every `--x` to a `--color-x` utility. `.dark` lifts each value (forest → sage
`#6fb58a`, ink → oat `#edeae2`, raised = *lighter*, on-primary flips DARK `#17231a`).

```
surfaces   --background #f1f1ee  --foreground #1b1b18  --card/--popover #fafaf8
           --secondary/--muted #e9e9e4  --accent #e9e9e4 (NEUTRAL, not a wash)
           --border/--input #e3e2dc  --muted-foreground #5a5852
forest     --primary #1f3c1d  --primary-hover #2a4b3b (deepens)  --primary-wash #e7ece3
           --primary-foreground #f5f3ec (oat)  --ring #1f3c1d
semantic   --warn #b8863b (ochre)   --destructive #b23b2e (brick)   (success reuses forest)
agent      --agent-ink #1b1b18  (a constant warm band — does NOT follow foreground's dark flip)
sidebar    --sidebar #ecebe8  --sidebar-accent #e6e5e0  --sidebar-border #e6e3da
chart      1 #6e8b6a sage · 2 #b8863b ochre · 3 #4e8378 teal · 4 #5b7793 slate · 5 #7a5c86 plum
(data-id)  6 #9c5f84 mauve · 7 #b0617a rose · 8 #b06a4f clay · 9 #4a7f93 ocean
           10 #6d6fa6 periwinkle · 11 #93883f gold · 12 #7e8a4c moss   (1–5 frozen; do NOT reorder)
radius     --radius-sm 6  --radius-md 10  --radius-lg 14  --radius-xl 20
fonts      --font-sans = --font-serif = Geist ;  --font-mono = Geist Mono
```

> **⚠ `--warn` (#b8863b) ≡ `--chart-2` (#b8863b)** — same hex, semantically separate tokens. Staleness/
> caution = `--warn`; a data-identity tint = `--chart-2`. **Never substitute one for the other in code.**

## Appendix C — Domain schema (load-bearing shapes, `lib/types.ts`)

Enums: `ProvState = user_created | ai_generated | human_verified` · `ArtifactState = processing | living |
archived` · `ArtifactType = HTML | MD | DOC` · `EdgeType = links_to | sourced_from | mentions |
in_collection | authored_by | decided | supersedes` · `SpaceKind = personal|team|org` · `CollectionKind =
typed | simple` **(product language is Simple vs Smart; `typed`→rename to `smart` when the rule engine
lands)** · `EditProposalKind = rewrite|tone|add` · `RunKind = capture|link|draft|file|scan|verify|
summarize` · `RunStatus = running|done|needs_you|failed` · `EpisodeKind = captured|proposed|confirmed|
commented|resolved|edited|superseded` · `DiscussionTag = decision|question|todo`.

```ts
Artifact  { id; type; title; state; prov; space_id; collection_ids[]; author_id ("agent"|person);
            public; hub_slug?; gist; summary?; scale?; updated; staleness?{source_label; since} }
Block     { id; artifact_id; anchor (→ artifact#anchor, the CITABLE sub-node); heading; text;
            image?{src; altSrc?; caption; alt}; callout?{tone: insight|note|warning} }
Edge      { id; type: EdgeType; from; to; prov; confidence?; rationale?; anchor? (the block it supports);
            created_by }                          // ai_generated = pending the Verify queue (dashed)
Collection{ id; slug; name; color; space_id; public; owner_id? (the Inbox "whose call"); kind;
            intro?; public_member_ids[]; member_order? }
Space     { id; name; kind; visibility: open|closed|private }   // the permission boundary
Person {id;name;role;initial}  Topic{id;name}  Decision{id;text;artifact_id}
Source {id;label;kind:transcript|meeting|audit|doc; at?; note?}
```

**View-models `lib/api.ts` resolves to (never stored):** `ArtifactGraph` (proposed/linkedTo/linkedFrom/
sources/people/decisions) · `EvidenceItem` (per-block provenance, `block_id?`) · `Freshness` (fresh|stale|
superseded) · `PendingEdge` (a resolved ai_generated edge for the Inbox) · `Neighborhood`{nodes:GraphNode,
edges:GraphEdge} (depth-bounded) · `GraphRel` (the paired Links list) · `ArtifactAsk`{answer; cites:
AskCite[]} where `AskCite` carries `edge_id?`+`pending?` so a cited edge is **verifiable in place** ·
`Stat`{v;l;delta?;points?;unit?} (a `points[]` makes a KPI selectable → the chart's metric switcher) ·
`LearnedRule` (origin earned|granted; mode auto|suggest; trust DERIVED via `ruleTrust()`, never stored) ·
`Episode` (edgeId? set on proposed/confirmed — the confirm IS the episode) · `Discussion`/`Comment`
(a `suggestion` = before/after on a block, resolved through the same ✓/✕ valve) · `AgentRun` ·
`CaptureReview` (multi-choice valve; `dupeArtifactIds` for Merge) · `CollectionCandidate`.

## Appendix D — `lib/api.ts` accessor index (~130 accessors — reach for these, don't re-derive)

`lib/api.ts` (2617 lines) is the mock accessor/mutator layer; **every page reads through it.** Grouped:

- **Artifacts / blocks:** `listArtifacts` `getArtifact` `getBlocks` `versionBlocks` `artifactVersions`
  `getFreshness` `artifactConns` `primaryCollection` `governingCollection`
- **Graph / relations / neighborhoods:** `getArtifactGraph` `getArtifactEvidence` `getProposals`
  `nodeRelations` `nodeConnections` `relationCount` `nodeMeta` `nodeStats` `nodeTimeline` `refOf`
  `resolveCenter` `getNeighborhood` `collectionGraph` `teamGraph` `pendingGraph`
- **Verify queue (trust valve):** `listPending` `pendingCount` `verifyEdge` `restoreEdge`
  `edgeConfirmation`
- **Ask / search:** `askArtifact` `askGraph` `answerQuery` `searchEntities` `askSuggestions`
  (+ const `ASK_SUGGESTIONS`)
- **Collections / publish / hub:** `listCollections` `collectionById` `collectionBySlug`
  `collectionContents` `collectionMembers` `collectionPublicMembers` `createCollection`
  `addArtifactsToCollection` `removeArtifactFromCollection` `reorderCollectionMembers`
  `generateCollectionCandidates` `listCollectionCandidates` `collectionCandidateCount`
  `resolveCollectionCandidate` `restoreCollectionCandidate` `rescanCollection` `publishArtifact`
  `publishCollection` `artifactByHubSlug`
- **Analytics:** `getAnalytics` `workspaceStats`
- **Capture:** `captureMeeting` `listCaptureReviews` `captureReviewCount` `resolveCaptureReview`
  `restoreCaptureReview` `mergeArtifacts` `archiveArtifacts`
- **Conversational edit:** `proposeBlockEdit` `proposeEdit` `refineProposal` `proposeDecision`
  `proposeCite` `recordDecision`
- **Episodes / discussions:** `recordEpisode` `artifactEpisodes` `personEpisodes` `recentEpisodes`
  `listDiscussions` `discussionsForBlock` `blockComments` `startDiscussion` `addComment`
  `resolveDiscussion` `applySuggestion` `listOpenSuggestions` `openDiscussionCount`
- **Governance / trust ledger:** `listCapabilities` `toggleCapability` `listDecisionPoints`
  `toggleDecisionPoint` `listPromotable` `ignorePromotable` `listResponsibilitiesByArea` `promoteRule`
  `grantResponsibility` `pauseRule` `resumeRule` `revokeRule` `setRuleMode` `ruleTrust` `ruleForRun`
  `ledgerRollup` `trustTrajectory` `sourceDecisionsForRule` `responsibilityLabel` (+ const
  `RULE_CAPABILITY`)
- **Agent runs (Activity):** `listRuns` `runCounts` `liveRunCount` `needsYou` `needsYouRunCount`
  `claimChange` `unclaimChange`
- **Inbox / Today counts + feeds:** `inboxBadgeCount` `inboxDecisionCount` `awayDigest` `viewerRecents`
  `listActivity`
- **People / topics / sources / decisions / spaces / permissions:** `listPeople` `personById`
  `listTopics` `topicById` `sourceById` `decisionMeta` `spaceById` `spaceOf` `canView` `changeOwner`
  `deriveOwners` `effectiveOwner`
- **Peeks / misc:** `getPeek` `agoMinutes` `hydrateState` (+ const **`VIEWER = "pe_maya"`** = the
  signed-in viewer)

## Appendix E — How the app renders + re-renders (the mechanics you must not break)

- **RSC vs client.** Pages are Server Components by default; interactive surfaces are `"use client"`
  islands (Library, the reader, Explorer, capture, dialogs). The reader routes (`/artifact`, `/a`, `/c`)
  live outside the `(app)` shell so they get full-bleed chrome. `/artifact/[id]` and `/a/[slug]` use
  **`generateStaticParams`** over the seed → they prerender; a client-created artifact won't resolve on
  those server routes (a known prototype limit). `/c/[slug]` is **client-rendered + `localStorage`-
  hydrated** precisely so a freshly published collection resolves.
- **The mutation → re-render signal.** The graph is a plain in-memory module, not React state. Mutating
  it does nothing visible until you **`bumpGraph()`** (`lib/store.ts` — a version counter + subscribers);
  client islands subscribe via **`useGraphVersion()`** (`useSyncExternalStore`) and re-render.
  **A mutation that changes rendered data MUST call `bumpGraph()`** — and if it changes collections/
  publish flags, also **`persistState()`** (snapshots to `localStorage "woven:state:v1"`). Note:
  `addArtifactsToCollection`/`removeArtifactFromCollection` **only persist — the caller must `bumpGraph()`**.
- **`StoreHydrator`** re-applies the persisted snapshot on mount; everything not in the snapshot (episodes,
  merges, archive, capture "Land") resets to seed on reload. This is the **current portfolio-prototype
  behavior**, not a product-completion invariant: preserve deterministic reset for a design-only task unless
  its scope includes persistence, but treat it as an F0/P0 blocker for any real-team beta claim.
- **⚠ The Vercel build trap.** `useSearchParams()` forces a CSR bail-out and **fails `next build`** unless
  wrapped in `<Suspense>` — this broke the deploy once (`ca04eb9`). The Explorer pages wrap it; the
  `/activity` redirect reads `window.location.search` **instead of** `useSearchParams`. When you read a
  query param, wrap in Suspense or read `window.location.search` in an effect.
- **Identity color** is a deterministic hash of the entity id (`lib/identity.ts` → `--chart-1..12`), so
  the same person/topic is the same hue everywhere — pass the **id** (e.g. `actor`), never re-pick a tint.
- **Icons/motion** are chrome; animate on interaction, not ambient jitter; `prefers-reduced-motion` holds
  the agent weave still.

## Appendix F — Recipes (how to make a common change without breaking the grammar)

- **Add a page** → `app/(app)/<name>/page.tsx`; wrap the body in `PAGE_FRAME` (`lib/frame.ts`); read data
  through a shared domain query (currently adapted by `lib/api.ts`, never inline arrays or component-local
  authority); add the nav item in `components/app-sidebar.tsx`. Public/full-bleed pages go OUTSIDE `(app)/`.
- **Add data / a query or command** → extend the domain shape in `lib/types.ts`, specify context,
  authorization, allowed transition, result/error, event, persistence/invalidation, and Undo semantics, then
  implement it in the current `lib/api.ts` adapter. While the mock architecture remains, a mutation ends with
  `bumpGraph()` (and `persistState()` for the existing snapshot) and components subscribe with
  `useGraphVersion()`; never mistake those adapter mechanics for the production contract.
- **Add a shared UI element** → check Appendix / §8 first (SegToggle, IconButton, Valve, DIVIDED, Row,
  TypeBadge, PersonAvatar…). Only hand-roll if none fit, and make it a *named* exception.
- **Change a design token** → edit the `:root` **and** `.dark` value in `app/globals.css` (both themes);
  never inline a hex in a component — use the utility.
- **Add an edge type / graph concept** → add to `EdgeType` in `lib/types.ts`, seed edges in `lib/data.ts`,
  resolve it in the relevant `lib/api.ts` graph accessor; render dashed while `ai_generated`, solid once
  `human_verified`; route the proposal through the Verify queue (`listPending`/`verifyEdge`) — nothing
  enters as fact without the human confirm, and the confirm records an `Episode`.
- **Wire an agent action** → it proposes (`ai_generated`), never commits; surface it in the Inbox valve
  (`Valve`/`ChoiceValve`) or the reader Suggestions rail; confirming calls `verifyEdge`/the matching
  resolver, which also `recordEpisode`s. Autonomy only if a trusted `LearnedRule` covers it (mode `auto`,
  above `AUTO_CONFIRM_FLOOR = 0.7`).
- **Before committing** → `npx tsc --noEmit` green → browser-verify the exact surface → commit (house
  shape + `Co-Authored-By` trailer) → `git push origin main` → Vercel auto-deploys.
```
