# Architecture

> What this is: the route map, repository layout, the `lib/` layer and the render mechanics, moved out of `AGENTS.md` on 2026-11-03 and updated for Step 1 on that date.
> Status: live reference. When it disagrees with the code, the code wins.

## Routes

There is one route group. `app/(app)/**` is the signed-in shell: the sidebar plus a mobile `SidebarTrigger`, with no topbar (`app/(app)/layout.tsx`). `app/artifact/**`, `app/decision/**` (its own layout), `app/a/**`, `app/c/**` and `app/api/**` live **outside** the shell. `app/page.tsx` → `redirect("/today")`.

| Path | Screen |
|---|---|
| `/today` | **Today** renders the Home: Resume → Orient → Decide → Ask as four client islands (`components/home/*`: `ContinueHero`, `Orient`, `NeedsYou`; `AskSuggestions`), every number sourced once (`home-facts.ts`). The sidebar, ⌘K, the root redirect and the 404 page all land here. |
| `/home` | A one-line `redirect("/today")`. Link nothing to it. |
| `/library` | **Library**: every artifact; list⇄grid, facet `FacetBar`, multi-select bulk file/export/archive, drag to collections. |
| `/inbox` | **Inbox** = the agent's console. Three tabs via `ViewTabs`: Decisions (`InboxQueue`), Activity (`InboxActivity`), Governance (`InboxGovernance`). Deep-link `?tab=` / `?decision=`; waiting Activation can add a structured proof candidate. |
| `/activity` | Server redirect → `/inbox?tab=activity`. It reads no params. |
| `/team` | **Team** on the explorer shell: Graph (the space field), List, Timeline; the bell opens the review dialog (pending links and stale docs, ✓/✕ per row, "Verify on the map"). |
| `/topics`, `/people` | The same `Explorer` shell centered on a topic / person (Suspense-wrapped for `?focus=`). |
| `/collection/[slug]` | **Collection**: tabs Contents (`MemberRows` with the per-row rail, drag-reorder, agent "gather" approval, publish tail), Map (`LocalGraph` on the page plane), Audience (KPI row + `TrendChart` + `BarList`). Whole page is a drop target. Exact, viewer-checked resolution waits for local hydration before showing a missing collection; that client-rendered not-found is HTTP 200. |
| `/artifact/[id]` | **Artifact reader** (the core surface): `<ArtifactReader>`, own chrome, `generateStaticParams` over all artifacts. |
| `/artifact/[id]/version/[label]` | Exact, immutable, read-only evidence leaf; stored HTML/SVG uses the sandboxed snapshot viewer. |
| `/decision/[id]` | Stable five-state Decision/current-truth recall leaf with Decision-scoped Ask. All five seed states are enumerated, including `de_sms` and `de_cadence`; unavailable Activation proof degrades within the record. |
| `/api/github/pr`, `/api/github/commit` | Public-only, no-store GitHub revision snapshot routes; no credentials or domain mutation. |
| `/a/[slug]` | **Public artifact page** by `hub_slug`, on the public register (`docs/reference/design-system.md`). Seed/public only: a server component over seed state. |
| `/c/[slug]` | **Public collection hub**: client-rendered + localStorage-hydrated so freshly published collections resolve; leads with the collection's published map. |
| `app/(app)/[...missing]/page.tsx` | The catch-all that keeps a stale link inside the shell. |
| `app/(app)/not-found.tsx`, `app/(app)/error.tsx` | Shared system states inside the signed-in shell. |
| `app/artifact/{not-found,error}.tsx`, `app/decision/{not-found,error}.tsx` | Focused reader boundaries outside the shell; missing states return to Library or Inbox respectively, and errors offer retry. |
| `app/not-found.tsx`, `app/error.tsx`, `app/global-error.tsx` | Neutral public/root fallbacks; the global error boundary also replaces the failed root document. |

## Repository layout

```
woven-app/
├── AGENTS.md                  the agent manual, kept under the 32 KiB budget (tests/agents-md.test.mjs)
├── README.md                  short description and run commands
├── package.json               scripts: dev, build, start, lint, check:design, check. No test script, no engines.
├── next.config.ts             sets devIndicators:false only
├── eslint.config.mjs          flat: next/core-web-vitals + next/typescript
├── components.json            shadcn (style "base-nova", on Base UI)
├── tsconfig.json              strict, noEmit, paths @/* → ./*
├── .claude/launch.json        Claude Code preview configs: 4322 and 4519, with a Mac-only node path
├── app/
│   ├── layout.tsx             root: Geist + Geist Mono via next/font/google, <html> metadata
│   ├── page.tsx               redirect("/today")
│   ├── not-found.tsx  error.tsx  global-error.tsx
│   ├── globals.css            ALL design tokens, the type ladder, the weld. NO tailwind.config.
│   ├── (app)/                 the shell: sidebar plus a mobile trigger, via (app)/layout.tsx
│   │   ├── today/  home/(redirect)  library/  inbox/  activity/(redirect)
│   │   ├── team/  topics/  people/
│   │   ├── collection/[slug]/
│   │   └── [...missing]/  not-found.tsx  error.tsx
│   ├── artifact/             layout.tsx, not-found.tsx and error.tsx; outside the shell
│   │   └── [id]/
│   │       └── version/[label]/  exact, read-only evidence snapshot (`#block` is the citable locator)
│   ├── decision/             layout.tsx, not-found.tsx and error.tsx; [id]/ is five-state recall + scoped Ask
│   ├── api/github/            public no-store PR + full-SHA commit snapshot routes
│   ├── a/[slug]/              public artifact page (generateStaticParams over public artifacts)
│   └── c/[slug]/              public collection hub (client-rendered + localStorage hydrate)
├── components/                feature components + components/ui/ shadcn-on-Base-UI primitives
├── hooks/                     use-mobile.ts
├── lib/                       types, data, api + focused helpers
├── scripts/                   check-design-rules.mjs, orbit-bench.mjs, orbit-render.mjs, orbit-fixtures/, shot.mjs,
│                              home.test.mjs
├── tests/                     node --test contract suites (activation, capture, GitHub, Decision reads, collection resolution, this manual)
└── docs/                      see docs/README.md
```

Other tooling. `scripts/orbit-render.mjs` renders a layout on a fixture as an SVG, so a candidate can be looked at as well as scored. `scripts/shot.mjs` drives real hover, focus and click states in headless Chrome, and hardcodes the macOS Chrome path at `scripts/shot.mjs:69`.

## The `lib/` layer

- **`lib/types.ts`**: the typed-graph schema, the single source of truth. Its header cites a design document that is
  not in this repo.
- **`lib/data.ts`**: the seed graph + browser-local immutable version records.
- **`lib/api.ts`** (152 value exports): the mock accessor/mutator layer **every page
  reads through** instead of hard-coding arrays. It is the replaceable frontend seam. Going live also needs the
  production list in `docs/roadmap.md`.
- **`lib/store.ts`**: React-free "graph changed" signal (`bumpGraph`/`subscribeGraph`/`getGraphVersion`);
  **`lib/use-graph-version.ts`**: `useSyncExternalStore` hook so islands re-render on mutation.
- **`lib/identity.ts`**: deterministic id→tint (`--chart-1..12`) + `initialsOf`. The hash is FNV-1a plus a MurmurHash3
  fmix32 finalizer. A curated `TINT_OVERRIDE` wins first. People use `personTintVar` (the warm subset `[1,2,7,8,11,12]`);
  for an unlisted person id `tintVar` and `personTintVar` can disagree, so use the person variant for people.
- **`lib/frame.ts`**: `PAGE_FRAME` (the one centered width register). **`lib/utils.ts`**: `cn()`, with tailwind-merge
  extended so `text-read*` stay font sizes.
- **`lib/pending.ts`** (`pendingByOwner`, shared by Inbox Activity and Today's Orient), **`lib/home.ts`** (the Needs-you `KIND` sort table, `ruleSentence`, `HOME_MEASURE` = 75ch, agent sentences),
  **`lib/last-seen.ts`** (the away window), **`lib/text.ts`** (`upperFirst`, `plural`, `houseSeparators`).
- **`lib/activation.ts`**: pure structured Activation-condition matcher + shared candidate selection;
  **`lib/capture-ingest.ts`**: URL/Loom validation, 512 KiB guard, SHA-256, and HTML/Markdown/text snapshot
  block parsing; **`lib/github-ingest.ts`**: strict public PR/commit URL contracts + deterministic snapshots.
- **`lib/use-doc-selection.ts`**: reads the live browser selection over the static doc
  (text/image/block/none) + `selectionActions()`, the chatdoc heart.
- **`lib/notifications.ts`** (`notify` + named `toasts`), **`lib/diff.ts`** (block + word diff over
  normalized `Block[]`), **`lib/export.ts`** (Markdown / self-contained HTML / **JSON-with-graph-
  neighborhood**; no viewer check yet), **`lib/artifact-drag.ts`** (`useCollectionDrop`), **`lib/collections.ts`** (exports
  a second, load-time `collectionBySlug` that falls back to `COLLECTIONS[0]`).
- **Persistence (prototype only):** a private `persistState()` and an async exported `hydrateState()` snapshot
  collections, per-artifact membership and publish fields, and **browser-local captures** (Artifact/Block/Source/
  ArtifactVersion/EvidenceRef/Edge/Episode plus ActivationEvidence and append-only ActivationDispositionEvent tied to
  exact refs) to `localStorage` `"woven:state:v1"`. Hydration revalidates local-id topology and recomputes raw→SHA-256
  before any captured record enters memory; invalid/tampered capture bundles fail closed. Seed-only trust events,
  edits and archive still reset. Hydration runs in the `(app)` layout (`StoreHydrator`), the collection route's
  resolver, `ArtifactPageClient`, and `/c`. `/decision/[id]` has no hydrator, so a hard reload there shows seed
  state (a known defect in `docs/roadmap.md`).

## How the app renders and re-renders

- **RSC vs client.** Pages are Server Components by default; interactive surfaces are `"use client"`
  islands (Library, the reader, Explorer, capture, dialogs). The reader routes (`/artifact`, `/a`, `/c`)
  live outside the `(app)` shell so they get full-bleed chrome. `/artifact/[id]` retains
  **`generateStaticParams`** for seed prerendering but delegates resolution to `ArtifactPageClient`, which
  validates raw hashes while hydrating local capture state, then permission-checks before any artifact/version/
  graph read. A denied internal reader shows `Restricted`; an absent artifact or exact version shows its
  corresponding not-found state without falling back to the latest version. Captured versions therefore survive
  reload in the same browser. `/a/[slug]` remains seed/public only. `/c/[slug]` is client-rendered +
  `localStorage`-hydrated for prototype collections.
- **Layouts.** `app/(app)/layout.tsx` has no topbar. It holds the sidebar plus a mobile `SidebarTrigger`.
  `app/artifact/layout.tsx` and `app/decision/layout.tsx` have Tooltip, Search and Toaster providers without
  the app sidebar. Neither layout hydrates; `ArtifactPageClient` owns the reader's hydration.
- **Collection resolution.** `/collection/[slug]` uses `findCollectionBySlug` for exact slug and viewer
  checks. If no collection is available yet, it waits for `hydrateState()` before rendering the shared app
  not-found state with a Library return action. This is a browser-local missing state (HTTP 200), not a server
  404: the server cannot distinguish an unknown slug from a collection saved only in that browser. Restored
  collections keep their exact identity on direct open/reload. The resolved content subscribes to graph
  changes and recomputes its mutable projections after hydration.
- **System states and retry.** `components/system-state.tsx` shares `not-found`, `no-access`, and `error`
  variants across `app`, `reader`, and `public` scopes. The app scope stays inside the existing sidebar/main;
  reader and public scopes own a full-height main, and public states carry the quiet Woven footer. Internal
  readers may distinguish Restricted from missing, but public/root absence stays neutral and reveals no
  private object details. Route-local error boundaries retain their surrounding layout and retry the request,
  including a fresh server payload; the global boundary supplies its own document, stylesheet, font, and
  full-page retry when the root layout fails. Collection/Artifact hydration failures are rethrown on render
  so they reach these boundaries. `ThemeRestore` reapplies the explicit stored theme after document recovery;
  it preserves the existing light default when no preference is stored.
- **B2 leaves.** `/decision/[id]` is statically generated for visible seeded Decisions but subscribes to
  `useGraphVersion()` in its client detail, so session mutations re-derive immediately. `/artifact/[id]/
  version/[label]` resolves `ArtifactVersion` + `versionBlocks()` after hydration and intentionally
  suppresses every current-object mutation/context control. Stored HTML uses `ExactEvidenceSnapshot`; its
  iframe allows inline self-contained scripts but no same-origin/network/form/base navigation; captured
  navigation elements are neutralized and a probe restores `srcDoc` if script escapes. Do not point
  an `EvidenceRef` at `/artifact/[id]#block`; that route is latest, not the cited snapshot.
  A local Artifact with no version and a `reference_only`/`unavailable` Source resolves to the dedicated
  read-only reference leaf, never an empty editable Reader.
- **The mutation → re-render signal.** The graph is a plain in-memory module, not React state. Mutating
  it does nothing visible until **`bumpGraph()`** runs (`lib/store.ts`, a version counter + subscribers);
  client islands subscribe via **`useGraphVersion()`** (`useSyncExternalStore`) and re-render. The full mutation
  contract, including which accessors persist without bumping, is in `docs/reference/domain-model.md`.
- **`StoreHydrator`** verifies then re-applies the persisted snapshot on mount, in the `(app)` layout only.
  B3 captured Artifacts/Blocks/Sources/Versions/Refs/Edges/Episodes, ActivationEvidence, and
  ActivationDispositionEvents tied to local exact refs are idempotently upserted only after topology + raw-hash
  validation; seed-only/session episodes, edits, and archive not included in the captured bundle still reset. Do not
  imply this is a production event store.
- **⚠ The Vercel build trap.** `useSearchParams()` forces a CSR bail-out and **fails `next build`** unless
  wrapped in `<Suspense>`. This broke the deploy once (`ca04eb9`) while `tsc` stayed green. Only `Explorer` uses it
  (`components/explorer.tsx:854`), wrapped on `/team`, `/people` and `/topics`. `/inbox` reads `?tab=` and `?decision=`
  through `window.location.search` instead (`app/(app)/inbox/page.tsx:25-28`). When you read a query param, wrap in
  Suspense or read `window.location.search` in an effect.
- **Identity color.** A curated `TINT_OVERRIDE` wins first, then a deterministic hash of the entity id onto
  `--chart-1..12` (`lib/identity.ts`), so the same person/topic is the same hue everywhere. People use `personTintVar`,
  not `tintVar`. Pass the **id** (e.g. `actor`), never re-pick a tint.
- **Icons/motion** are chrome; animate on interaction, not ambient jitter; `prefers-reduced-motion` holds
  the agent mark still and drops the weld to an instant change.

## Gotchas outside design

- **`lib/types.ts` still names collection `kind` as `typed | simple`**: the product language is **Simple
  (hand-curated) vs Smart (rule predicate)**; rename `typed → smart` when the rule engine lands.
- **`lib/collections.ts` has its own `collectionBySlug`,** a load-time snapshot that falls back to `COLLECTIONS[0]`.
  `lib/api.ts`'s legacy version also falls back to `collections[0]` for existing internal callers. Those helpers
  remain debt; `/collection/[slug]` now resolves through the strict, viewer-checked `findCollectionBySlug`.
- **Code comments cite documents that are not in this repo** (`app/globals.css:8` and `:70`, `lib/types.ts:2`, `lib/api.ts:1`,
  `lib/data.ts:4`). Ignore those pointers. Comments that cite an `AGENTS.md` section refer to the manual as it stood before
  2026-11-03; those sections now live in `docs/`.
- **Line A / line B comments are stale.** A work split ran from 2026-08-14 and ended on 2026-11-03. No file is reserved.
  Comments in `scripts/home.test.mjs:4`, `lib/home.ts:4`, `lib/text.ts:7`, `lib/data.ts:39`, `components/page-heading.tsx:10`,
  `components/inbox-agent-band.tsx:112`, `app/(app)/inbox/page.tsx:52`, `app/c/[slug]/page.tsx:44` and `app/globals.css:217` still
  use that language.
- **`app/layout.tsx` metadata** still says "the home for AI artifacts". The category moved; see `AGENTS.md`.
