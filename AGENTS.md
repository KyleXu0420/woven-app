# AGENTS.md

This is the operating manual for any agent working on Woven. Read all of it. It is short on purpose. Detail lives in `docs/`, and the table in section 9 says which file to load before you touch an area. The code wins on what exists today. For an intended change, the acceptance contract in `docs/roadmap.md` and the locked calls in `docs/reference/decision-log.md` govern.

## 1. What Woven is

Woven is trusted operational memory for complex cross-functional work. It turns exact, versioned evidence from the tools where work already happens into human-ratified Claims and Decisions, connects those Decisions to observable activation, and keeps track of what is true now, why it became true, and what replaced it.

- Initial actor: the work owner, a situational role and never a fixed job title. A Decision's authority and driver may be this person, two different people, or neither.
- Wedge: `review → authorization → activation → revalidation → recall`.
- Loop: sources are captured, exact versions and evidence are assembled, the agent proposes claims and decisions, the scoped authority approves what counts, the driver changes reality in the existing work system, Woven observes activation, drift and supersession, and Ask returns the current truth plus the exact evidence and why it changed.
- Spine: Today (attention), then Inbox (judgment), then `/decision/<id>` (durable recall), then Decision-scoped Ask (explanation). Exact-version Readers are evidence leaves off that spine.
- A Decision has five states: `needs_approval`, `waiting_activation`, `in_effect`, `needs_revalidation`, `superseded`.
- Division of labor: the agent captures, assembles, proposes, monitors and cites. Humans own meaning, scope, authority and exceptions.

This repo is a prototype on an in-memory typed graph. `lib/data.ts` is the seed and `lib/api.ts` is the only way in or out. There is no backend, database or real auth, and state stays in the browser. File, link and manual Loom capture writes real browser-local records, and two server routes snapshot public GitHub PRs and commits without credentials. Ask is deterministic template output, never AI synthesis. Agent runs, analytics and publishing are simulated. Never describe or build as if a backend exists, and never claim a capability in copy that the prototype lacks.

## 2. Run and verify

```bash
pnpm install
pnpm dev                                          # next dev on port 3000
npx tsc --noEmit                                  # gate 1: types
pnpm check:design                                 # gate 2: design lint, 0 errors, baseline 74 warnings
node --test tests/*.test.mjs scripts/*.test.mjs   # gate 3: contract tests, 59 pass
pnpm build                                        # gate 4: the deploy gate, needs network
node scripts/orbit-bench.mjs                      # gate 5, after any graph layout change: must report "PASS":true
npx eslint <changed files>                        # every change: add no new finding
```

Counts in this file are baselines from 2026-11-03. They drift, so re-measure before you rely on one.

- `tsc` alone is not the deploy gate. Vercel runs `next build`, which catches what tsc cannot. A `useSearchParams` with no Suspense boundary once failed every deploy while tsc stayed green (`ca04eb9`). Run gate 4 before you call a change shippable.
- Use pnpm. Node 23.6 or newer is required, because the tests import `.ts` files directly. 26.3.0 is in use here and nothing pins it.
- There is no `pnpm test`. The form `node --test tests/` fails because Node reads the directory as a module, so use the globs above. `pnpm check` runs gates 1 and 2 together.
- `pnpm lint` is red on clean `main`: 35 errors and 14 warnings after Step 1 on 2026-11-03, all older React Compiler and JSX-entity findings. Lint the files you changed with `npx eslint <files>`, add no new finding, weaken no rule, and leave the backlog alone unless asked.
- `pnpm check:design` exits 0 with warnings. Add no new hit in a file you touch. It scans `app`, `components` and `lib`.
- `pnpm dev` serves port 3000. Ports 4322 and 4519 in `.claude/launch.json` are Claude Code preview configs with a Mac-only node path.
- Restart the dev server after an `@theme` edit in `app/globals.css`.
- Gate 4 needs the network. `app/layout.tsx` loads Geist through `next/font/google`, and with outbound network denied `next build` exits 1 with "Failed to fetch `Geist` from Google Fonts" (tested 2026-11-03). Gates 1, 2, 3 and 5 passed in the same test. `pnpm dev` logs the same failure and falls back to a local font. In a sandbox with no network, say gate 4 did not run and do not call the change shippable.

Verify in a real browser yourself, on the exact surface you touched, in light and dark, at desktop width and about 390px. Say what you checked and where. Do not ask the owner to check for you.

To reach dark, set `localStorage.theme = "dark"` and reload, or use `components/theme-toggle.tsx`. An unset theme stays light, and `prefers-color-scheme` is ignored. Wait about a second after a switch before you capture, because colours transition and a fast capture catches them halfway.

`scripts/shot.mjs` drives real hover, focus and click states. `VW=390` sets the width. It starts a fresh profile each run, so set the theme in a `--patch`. It hardcodes the macOS Chrome path at `scripts/shot.mjs:69`.

## 3. Ship

- A push to `main` deploys production at https://woven-app-phi.vercel.app. Nothing gates it. There is no CI and no `.github/`, so your local gates are the only gate.
- The repo is public (github.com/KyleXu0420/woven-app). Never commit secrets, credentials, private customer data, machine paths or personal email addresses.
- Push only when the change is done and verified, or when the owner asks. Never force-push and never rewrite history.
- Run `git status` before you start. If the tree holds work you did not make, ask about it before you commit, and never sweep it into your commit.
- Commit shape: `<Area>: imperative subject`, then problem, fix and verification in prose, naming the surface you verified. End with your own agent's attribution. One coherent change per commit. Fix the root cause and keep each diff to its surface.
- Stop and ask before anything destructive, anything external, and any change to a locked product or brand decision.

## 4. Hard rules

An agent breaks these by default. Breaking one is a regression even when the page looks fine. A bracket names the check that catches the rule; a rule with no bracket rests on you. Full text is in `docs/reference/design-system.md` and `docs/reference/domain-model.md`.

**Trust. This is the product.**

1. Nothing becomes fact until a human confirms it. Agent output stays `ai_generated`, drawn dashed or on a wash. `human_verified` draws solid. `verifyEdge` records the confirm as an episode.
2. Verification, authorization, activation and evidence freshness are four independent facts. Never collapse them into one gesture or one green state.
3. Approval never proves activation. A PR, merge, task, owner, date, Loom or "go ahead" is at most a candidate, and only the scoped authority can confirm it. The target for false `in_effect` is 0. [`tests/activation-contract.test.mjs`]
4. An EvidenceRef binds artifact, version and block, and never falls back to latest. Missing evidence or permission means hedge or abstain. Never point a ref at `/artifact/<id>#block`, which is the latest version.
5. `reference_only` capture creates no EvidenceRef. Reaching a URL is never proof its content was captured. [`tests/capture-ingest.test.mjs`]
6. `ReviewPacket` and `DecisionTruth` are derived and never stored. The same `decision_id` and `decisionTruth()` run through Today, Inbox, `/decision/<id>` and Ask. Lifecycle mutations live only in focused Inbox.
7. Owner routing (`owner_id`, `effectiveOwner`) never establishes Decision authority.

**Code**

8. Read and change domain state only through `lib/api.ts`. Components never become a second authority.
9. Put mutators in `lib/api.ts` and call `bumpGraph()` so islands re-render through `useGraphVersion`. `persistState` is private and covers only collections, membership and publish fields, local capture bundles and local Activation records. All other trust state resets on reload by design.
10. `createCollection`, `addArtifactsToCollection`, `removeArtifactFromCollection`, `publishArtifact`, `publishCollection` and `reorderCollectionMembers` persist without bumping, so the caller must bump. Those six are the whole list. Every other mutator that persists, such as `ingestEvidenceBundle`, also bumps itself, so never repeat either call after it.
11. `useSearchParams` needs a Suspense boundary, or read `window.location.search` in an effect as `/inbox` does. [`pnpm build`]
12. Plain class strings shared with server components live in a module with no `"use client"`, such as `components/classes.ts`. Exported from a client module they silently render nothing.
13. A `lib` module imported by node tests uses relative `./x.ts` imports, never `@/` (`lib/home.ts:6`). [gate 3]
14. Use `cn()`. Its tailwind-merge is extended so `text-read*` stay font sizes. Never declare a `--color-read*` token.
15. Keep the long WHY comments in the code. They are the design record.

**Design**

16. Forest is the one accent, for chrome, agent and confirm only. Selection, navigation and data stay neutral ink. Forest is never a chart series.
17. The action decides forest weight, never the neighbour. Writes nothing: neutral. Acts on many or repeats: wash, `variant="confirm"`. Exactly one object and the only commitment: solid, at most 1 per view, beside a ghost cancel. Weight comes first, then form: one half of an accept/reject pair on one object is drawn as an icon-only mark (`Valve`), and anything else is a word.
18. Hover deepens forest. Never `opacity-*` or `/80` on it.
19. No raw hex, no `#fff` or `#000`, no Tailwind palette colour. [`no-raw-hex`, `no-pure-black-white`, `no-palette-colour`, error]
20. No opacity modifier on inks. Use `tint-1/2/3`, `wash`, `mark`, `line-*`. [`no-alpha-ink`, warn]
21. `--chart-*` is data identity only. Staleness is `--warn`, never `--chart-2`, though they share a hex.
22. No gradient, glow, shadow for depth, or left-edge stripe on anything.
23. Write rung names, never px. The ladder is `text-xs` 12, `text-sm` 13, `text-base` 15, `text-lg` 17, `text-xl` 20, `text-2xl` 28, `text-3xl` 44, `text-4xl` 64, and for reading `text-read` 19, `text-read-heading` 22, `text-read-display` 40. Add no other size. Two kinds of residue stay as they are, neither grown nor folded unasked: three 10px monograms (`components/identity.tsx:34-35`, `components/app-sidebar.tsx:287`) and the text inside graph SVG. No `leading-*` except `leading-none` where the box is the glyph. [`no-unnamed-text-size`, `no-fractional-px`, warn]
24. Weight 400 and 500 only. Sentence case. [`weight-cap-400-500`, error]
25. All-sans Geist. Geist Mono is for the agent's byline and real code, paths or values only. Keycaps are an open owner call. His record allows mono, and the code draws every keycap in sans except one at `components/artifact-graph-overlay.tsx:228`. New keycaps copy `Keycap` in `components/search.tsx`, and that one stays until he decides.
26. No middle dot and no em-dash chains in product copy. [`no-middle-dot`, warn]
27. Radius goes by what the box is: sm 4 mark, md 10 control, lg 16 surface. There is no xl rung. [`no-unnamed-radius`, warn]
28. `PAGE_FRAME` (`lib/frame.ts`) owns page width, one centred 1040px register. A page h1 is `text-2xl`. Two named exceptions: the Decision h1 is `text-3xl`, and the h1 of a document being read (the reader, `/a/`, `/c/`) is `text-read-display`. No info glyph or hint sentence on a page header.
29. Minimize cards. Lists are open rows on hairlines, and a row leads with the `NodeMark` of its subject. Cards survive for floating surfaces, the Library cover card and callouts.
30. Reach for the shared primitive and never hand-roll. `ViewTabs`, `SegToggle` and `FilterChips` stay distinct. Also `IconButton` (label required, sizes 24/28/32/36) [`off-scale-box`, warn], `Valve`, `ChoiceValve`, `ConfidenceWord`, `FeedHead`, `AgentBand`, `SectionAction`, `DIVIDED`, `DIVIDED_FLUSH`, `FOCUS_RING`, `ConfirmDialog`, `PageHeading`, `Section`, `Row`, `LocalGraph`, `DecisionStateLabel`, `HashChip`, `notify`. A divergence must be a named exception, listed in `docs/reference/components.md`.
31. The agent is credited once per surface through the `AgentBand` byline. `Sparkles` is never the agent; `AgentMark` is.
32. Agent copy is present tense, one fact per sentence, at most 75 characters wide. Actions are verb-noun. Confidence is a word at rest, never bars, a hue or forest.
33. Prose flows, a leading mark sits on the first line, and only text with a fuller form one click away may truncate. Hand-off controls are at least 44px below md (768px). Every interactive control has its full state set.

**Settled, so do not re-argue or redesign unasked**

- `WovenMark` and `AgentMark` are hand-designed. The agent mark is a filled seal with a wave cut out and no node.
- The cover is the document's woven cloth, the owner's pick. It is a window with a fixed 8px end and 1px seam, so a bigger box shows more cloth and never a bigger thread. The warp is the sections by word count in the collection's hue. A plain-weave weft appears once the document has a confirmed link, and the two strongest links float in their neighbours' hues. It is never a hub-and-ring, a constellation, a link graph, a gradient or a contents page. The spec is the header comment of `components/cover-cloth.ts`.
- The weld is the one signature motion, 240ms. Nothing scales on hover.
- Graphs use one alphabet on four axes: shape is kind, size is depth, hue is identity, line is provenance by style and evidence by weight. A person is a filled circle and a source is a hollow ring.
- The direction is evolve, anchored on Are.na. Rejected for good: serif display, React Flow, gradient covers, glowing graphs, a fifth hue.
- The alpha-ink family, the type ladder and the forest weight rule are closed.

## 5. Codebase map

Stack: Next.js 16.2.9 (App Router, Turbopack dev), React 19.2.4, TypeScript strict, Tailwind v4 with no `tailwind.config`, shadcn (`base-nova`) on Base UI, lucide-react.

| Path | What it is |
|---|---|
| `app/(app)/` | The signed-in shell, sidebar and no topbar: `today/` (the Home), `library/`, `inbox/` (Decisions, Activity and Governance tabs), `team/`, `topics/`, `people/`, `collection/[slug]/`. |
| `app/(app)/home/`, `app/(app)/activity/` | Redirects only. Link `/today` and `/inbox?tab=activity`. |
| `app/artifact/[id]/` | The reader, outside the shell. `version/[label]/` is the exact read-only evidence leaf. |
| `app/decision/[id]/` | Stable recall of one Decision in any of its five states, plus scoped Ask. |
| `app/a/[slug]/`, `app/c/[slug]/` | Public artifact page (seed only) and public collection hub (client-hydrated). |
| `app/api/github/` | Public, no-store PR and full-SHA commit snapshot routes. |
| `app/globals.css` | All tokens, the type ladder and the weld. Edit `:root` and `.dark` together. |
| `components/artifact-reader.tsx` | The reader, about 1,800 lines. Edit copilot in `components/edit-chat-bar.tsx`. |
| `components/local-graph.tsx` | Every graph field, about 2,300 lines, over `components/orbit-layout.ts`. |
| `components/search.tsx`, `components/capture-flow.tsx` | ⌘K, and capture with one evidence queue. |
| `components/inbox-queue.tsx`, `components/review-packet.tsx`, `components/decision-detail.tsx` | The judgment spine. |
| `components/controls.tsx`, `components/proposal.tsx`, `components/classes.ts`, `components/ui/` | Shared primitives. |
| `lib/types.ts` | The schema, single source of truth. |
| `lib/data.ts`, `lib/api.ts` | The seed, and the accessor layer of about 3,800 lines and 150 exports. Nothing else imports the seed. |
| `lib/store.ts`, `lib/use-graph-version.ts` | `bumpGraph` and the hook islands subscribe with. |
| `lib/activation.ts`, `lib/capture-ingest.ts`, `lib/github-ingest.ts` | Pure contracts under test. Do not reimplement their validators. |
| `lib/home.ts`, `lib/frame.ts`, `lib/identity.ts`, `lib/text.ts` | Needs-you sort table, page frame, id to tint, copy helpers. |
| `scripts/` | `scripts/check-design-rules.mjs`, `scripts/orbit-bench.mjs`, `scripts/shot.mjs`, `scripts/home.test.mjs`. |
| `tests/` | Contract suites, including the test that guards this file. |

Each surface has one job. Today orients and hands off, and owns no lifecycle mutation. Inbox is a pure decision queue, one agent loop in three tenses: Decisions now, Activity doing, Governance learned. ReviewPacket is assembled at read time in focused Inbox. `/decision/<id>` is read-only recall. The graph is a trust and audit layer, and it is never a top-level nav destination. It appears as the Graph tab of `/team`, `/topics` and `/people`, and as the Map tab of a collection. Collections are output lenses and hold no second truth.

Read large files in parts. In the seed, `pe_maya` is the signed-in viewer, `a_notif` is the demo hero, and `a_comp` is the artifact she cannot see. In new code, write the `VIEWER` constant from `lib/api.ts` and never the string, even though `canView` and `listArtifacts` still default to it.

## 6. Top gotchas

- The line A and line B split ended on 2026-11-03. No file is reserved. Any comment saying otherwise is stale, including comments saying a lint rule flips "when line A lands".
- Do not build on `components/graph-ask.tsx`, `components/publish-dialog.tsx`, `DropButton`, `CatchUp`, `coverSeed` or the `hint` prop of `PageHeading`. They are dead.
- `canView` is default-allow. No space or no membership record returns true. Generic `askGraph`, `nodeRelations` and `getNeighborhood` take no viewer, and `lib/export.ts` has no viewer check. Never assume a graph path is permission-filtered.
- `/decision/[id]` has no hydrator, so a hard reload there can miss local records. Hydration runs in the `(app)` layout, the collection resolver, `ArtifactPageClient` and `/c`.
- `/a/[slug]` reads seed state on the server, so a browser-side publish does not reach it.
- `Artifact.updated` says when a document last changed, by anyone. Nothing records which artifact a viewer opened. `viewerRecents` holds what the viewer touched, meaning their own episodes and the artifacts they authored. Name a list for what its source holds, so a list on `updated` is "Recently updated" and never "Recently opened". The Library's "Recent" sort option sorts nothing, so do not reuse it as an ordering.
- The sidebar Inbox badge is a deliberate cross-tab superset of the Decisions count. Do not "fix" that inequality.
- `--accent` is neutral, and `--primary-wash` does not exist. The wash is `bg-wash`.
- `rounded-xl` and `rounded-2xl` still compile as aliases pinned to 16. They are debt. Write `rounded-lg`.
- An object keeps its own token on every ground, because the alphas composite. Never raise a chip because its row changed state.
- Collection `kind` is still `typed | simple` in `lib/types.ts`. The product language is Simple and Smart.
- Code comments and `docs/design/` cite design documents outside this repo, such as `AGENTS-additions` and `line-b-handoff`, and `AGENTS.md` sections from before 2026-11-03. Those files do not exist in a clone, and those sections now live in `docs/`.
- Comments that give hover as percentages are stale, such as "5% hover, 8% pressed" in `components/today-ui.tsx`. The classes are `tint-1` and `tint-2`, and the classes win.
- `docs/history/` and `docs/archive/` are dated records. They explain the past and give no instructions, apart from the open items in `docs/history/open-fixes.md`.
- Measure small glyphs at DPR 1. Trust the rendered DOM and real input over a value read right after a programmatic change.

## 7. Where we are now and what is next

On 2026-11-03: B0 to B2 are complete and B3 is in progress. Exact local evidence, public GitHub capture and manual downstream-candidate review exist. A real downstream source and one dogfood episode remain. The acceptance contract has 34 action IDs: 0 done, 17 partial, 17 not started. Out of scope: recorder, project management, analytics, observability. Audience analytics and legacy prototype debt stay frozen unless the slice needs them.

Next, in order. The step numbers are those of the open list in `docs/roadmap.md`. That file is the one roadmap, with the full text, criteria, status and the later steps 11 and 12. The order is a recommendation the owner can change.

- **Step 1 complete (2026-11-03).** All five seed Decisions render; unknown collection slugs show a missing state after local hydration, without rejecting local collections on reload. Shared not-found, restricted and error states have return/retry actions. Verification is in `docs/history/2026-11-03-step-1-verification.md`.
- **Step 2.** Finish the close-out: delete the dead code above, update stale comments, and move the design-lint `warn` rules to a counted ratchet.
- **Step 3.** Lock the gate: a `test` script, a pinned Node version, CI, and the 35 ESLint errors fixed for real.
- **Step 4.** Fix the number root so Needs you, the badge and the tab counts come from one Attention list (F0.8).
- **Steps 5 and 6.** Remove fake success: wire, label or delete every control that ends in a toast or a no-op, starting with "All changes saved" and Nudge. Clear the small truth and copy backlog alongside it.
- **Step 7.** Finish the B3 browser coverage for capture and activation candidates.
- **Steps 8 and 9.** Build the shared-truth core inside the narrowest slice (F0.1 to F0.3, F0.6), then flip authorization to deny-by-default (F0.4).
- **Step 10.** Complete the B3 proof with one immutable downstream observation and one prospective dogfood episode. The owner picks the episode and source.

Read Known live defects in `docs/roadmap.md` before touching Inbox revalidation, which has no reachable success path today.

Before any change, name the user job, the starting state, the success state and the next hand-off. Trace the shared fields that must stay consistent: identity, status, visibility, provenance, time, owner, count, URL. Put the rule in `lib/api.ts` and keep components free of it. Wire, label as preview, or remove every visible action in scope.

Done means the release-quality gate in `docs/roadmap.md`: the visible result, object, count, URL, time, owner and event agree after the action, Undo, route change and reload. A rendered happy path is not done.

## 8. How to work with the owner

Kyle owns the product. He is a product designer.

- Reply in Chinese. Code, identifiers, paths and commit text stay in English.
- Keep replies short and plain enough for a designer. Say what a user would now see. Skip per-file lists and tallies unless he asks. Long reasoning belongs in code comments, which he reads.
- He decides by looking at the running product. He usually selects an element and writes one short line. Evaluate it, form a judgment, act, and show the result on the real page.
- When a real fork needs him, render the options side by side. Side-by-side ranking beats scores. Absolute-score judge loops pinned near 6 five times and settled nothing.
- Once he decides, it holds: 「定好设计，不要改来改去」. Record the decision in the matching doc and move on. If you disagree, state the trade-off once, then build what he chose.
- 「评估和提升」 means evaluate and elevate. 「更加考究」 means more refined. 「彻底重做」 means rebuild from scratch, free of the existing design. These ask for craft-level care. Find a real reference first, and Refero is his default source.
- In a planning or decision workshop, show the whole decision landscape in coherent batches with the rationale. Do not drip one question per turn. Once he locks the baseline and asks to automate, work through coherent batches without waiting for routine approval.
- Visual working artifacts default to editable HTML and SVG. Use Figma only when he asks.

Just do these: reversible implementation calls, mechanical next steps, fixes for defects you find on the way, doc updates, and audits run end to end. In his words: 「那你快点继续下一步，这些中间的 checkpoint 我都不想和你过度确认」.

Ask him first when work would change a locked product or brand decision, needs credentials or private customer data, is destructive or hard to reverse, reaches outside this repo or anyone outside it, or materially expands production scope. Bring a recommendation and the trade-off.

The Woven landing site is a separate repo, unreleased, on the owner's machine. It is out of scope here. Do not infer anything about it.

## 9. When you touch X, read Y first

| When you touch | Read first |
|---|---|
| Anything visual: colour, type, radius, spacing, motion, dark theme | `docs/reference/design-system.md` |
| The exact numbers or proof behind a design rule | `docs/design/rules-detail.md` |
| A surface the owner has opinions on, or anything he may have rejected | `docs/design/brand-iteration.md` |
| The design direction, a new reference, how a rule gets promoted | `docs/design/verdict-2026-10-02.md`, `docs/design/doctrine.md` |
| A shared primitive, or a new component | `docs/reference/components.md` |
| Routes, layouts, hydration, rendering | `docs/reference/architecture.md` |
| `lib/types.ts`, `lib/data.ts`, `lib/api.ts`, any mutation | `docs/reference/domain-model.md` |
| The graph: `components/local-graph.tsx`, `components/orbit-layout.ts` | `docs/reference/design-system.md`, `docs/reference/components.md`. Run gate 5 after any layout change. |
| The capture flow: `components/capture-flow.tsx`, `lib/capture-ingest.ts` | `docs/reference/domain-model.md`, `docs/reference/recipes.md` |
| The Inbox: `components/inbox-queue.tsx`, `components/review-packet.tsx` | `docs/reference/domain-model.md`, `docs/reference/decision-log.md`, `docs/history/open-fixes.md`, and Known live defects in `docs/roadmap.md` |
| Evidence, activation, revalidation, Ask | `docs/reference/domain-model.md`, `docs/reference/recipes.md` |
| A locked product decision, or why a surface is the way it is | `docs/reference/decision-log.md` |
| A common change, such as a page, an accessor or a token | `docs/reference/recipes.md` |
| Choosing work, or what done means | `docs/roadmap.md` |
| The open bugs, numbers and copy backlog | `docs/history/open-fixes.md` |
| The product's reasoning, scenarios and validation questions | `docs/history/2026-08-14-product-reasoning.md` |
| Anything else | `docs/README.md` |

A change to a locked decision or a shared primitive updates the matching doc in the same commit. Keep this file at or under 28,000 bytes. Codex reads 32,768 bytes across the whole `AGENTS.md` chain and cuts the rest silently, and the gap leaves room for a nested file. Check with `wc -c AGENTS.md`. `tests/agents-md.test.mjs` fails over 28,000 bytes and on any repo path named here that does not exist.
