# Components

> What this is: the map of `components/` and the authoritative list of shared primitives, moved out of `AGENTS.md` on 2026-11-03 and corrected against the code at `84a4bb8`.
> Status: live reference. Update it in the same commit when a shared primitive lands or moves.

A scan of `components`, `lib` and `hooks` on 2026-11-03 found two orphan files, `components/graph-ask.tsx` and `components/publish-dialog.tsx`.

## Components by area (all in `components/`)

- **Reader + edit copilot:** `artifact-reader.tsx` (**the central surface**: `ModeBtn`
  Read/Edit, `Section` per-block `contentEditable`, `ProposalBar`+`DiffText`/`applyProposal` = the
  content trust valve, `ArtifactHeader`, `ReadingTOC` textless outline, `ContextRail`/`ContextDrawer` with
  the tie groups (`TieGroup`), `ThemedFigureImg` (re-inks an embedded SVG figure by role per theme), `SaveStatus`,
  `FreshnessBanner`; uses `useDocSelection`), `edit-chat-bar.tsx` (the docked copilot: state-aware **pill
  idle → card when a thread/proposal/suggestion opens**; one box, intent inferred), `format-bubble.tsx`
  (inline marks at the cursor, **no block ops**), `section-comments.tsx` (block Discussions),
  `version-history.tsx` (block diff), `story-strip.tsx` (episodic memory rail), `artifact-graph-overlay.tsx`
  (full-canvas per-doc graph over `weave-backdrop.tsx`), `artifact-page-client.tsx`.
- **Today / Home:** `components/home/*` (`continue-hero`, `day-line`, `orient`, `needs-you`, `home-facts.ts`,
  `use-last-seen.ts`), `today-ui.tsx` (`Section` with `countHint`, `Row`, `RowList`, `SectionAction`,
  `EmptyRow`), `today-date.tsx` (`SectionCount`), `ask-suggestions.tsx`, `seen-stamp.tsx` (stamps the visit
  on pagehide), `catch-up.tsx` (only `EPISODE_LABEL` is imported, by `timeline-view.tsx` and `search.tsx`; `CatchUp` and
  its `EpisodeRow` are dead and account for 8 design-lint hits).
- **Library/cards:** `cover-art.tsx` (`CoverArt`; `coverSeed` is exported with no consumer) over the three cover
  modules: `neighbourhood-cover.tsx` (lays it on the card), `cover-read.ts` (reads the doc, no React) and `cover-cloth.ts`
  (weaves it, no React or data). Also
  `artifact-ui.tsx` (`StatusPill`, `TypeBadge`, `Connections`, `PeopleStack` with its peek, `CollectionTag`,
  `LinkCount`), `facet-filter.tsx`, `add-to-collection.tsx`, `add-documents.tsx`.
- **Collection:** `collection-members.tsx` (`MemberRows`), `collection-weave.tsx` (`RailCell`, the trunk
  model), `collections-property.tsx`, `new-collection-popover.tsx` (describe-to-create),
  `share-collection-dialog.tsx` (holds the "one ladder" copy and mock local roles; see Permissions in
  `docs/reference/decision-log.md`).
- **Inbox:** `inbox-queue.tsx` (Decisions), `inbox-activity.tsx` (colleague monitor),
  `inbox-governance.tsx` (trust ledger), `inbox-agent-band.tsx` (`AgentBand`, `FeedHead`, `undot`), `proposal.tsx` (**`Valve` / `ChoiceValve` / `provisional`**, the shared trust-valve primitives),
  `confidence.tsx` (`ConfidenceWord`, `confidenceLevel`, `CONFIDENCE_COPY`), `merge-sheet.tsx`,
  `review-packet.tsx`, `decision-state.tsx`, `decision-detail.tsx`, `activation-observation-dialog.tsx`
  (exact manual downstream candidate; never direct activation).
- **Team/graph:** `local-graph.tsx` (**~2200 lines**: `LocalGraph`, `layout()`, `GraphKey` behind
  `graphKey`, `FoldChip`, `WELD_MS`, label seating; dashed = pending, `onVerifyEdge`) over `orbit-layout.ts`,
  `entity-profile.tsx` (`NodeMark`, `EntityProfile`), `entity-peek.tsx` (`SourcePeek`/`LinkPeek`/
  `PersonPeek`/`DecisionPeek` + `PeekTrigger`), `explorer.tsx` (`Explorer`, the subject switcher, fold rows),
  `timeline-view.tsx`.
- **Capture:** `capture-flow.tsx` (`CaptureProvider`/`useCapture`, `GlobalDropZone`, `CaptureDialog`,
  `CAPTURE_SHORTCUT`; `DropButton` is exported with no caller, because the way in is the sidebar's Capture box in
  `app-sidebar.tsx`; real File / Link / Loom / public-GitHub intake → one evidence queue).
  File content and manually supplied Loom transcripts become exact browser-local snapshots; ordinary links
  and Loom without transcript are explicitly `reference_only`. Public PRs freeze head/reviews/commits; public
  commit URLs require the full 40-character SHA. No generic URL fetch, private-GitHub auth, Loom API,
  recorder, or STT. `exact-evidence-snapshot.tsx` renders captured self-contained HTML read-only in a
  CSP-restricted sandbox and exports `HashChip` / `isHashLike`.
- **Share/publish/identity/controls:** `share-menu.tsx` (`SharePanel`; `ShareMenu` has no consumers),
  `identity.tsx` (`PersonAvatar`/`AgentAvatar`/`AnonAvatar`/`OverflowAvatar`/`IdentityGroup`),
  `agent-mark.tsx`, `woven-mark.tsx` (`WovenMark`, `WovenWordmark`), `controls.tsx` (`ViewTabs`/`SegToggle`/
  `FilterChips`), `classes.ts` (`FOCUS_RING`, `DIVIDED`, `DIVIDED_FLUSH`, `POPOVER_SURFACE`, `MENU_SURFACE`),
  `app-sidebar.tsx`, `page-heading.tsx` (`PageHeading`, `PageBreadcrumb`), `theme-toggle.tsx`,
  `store-hydrator.tsx`, `search.tsx` (⌘K: ranked Navigate, Act, Find, Answer lanes).
- **No importer** (do not build on them): `graph-ask.tsx`, `publish-dialog.tsx`. Artifact publishing runs through
  `share-menu.tsx` and `search.tsx`.
- **Outside `components/`:** `hooks/use-mobile.ts`.
- **`components/ui/*`** (shadcn-on-Base-UI primitives): `badge`, `button` (`confirm` variant), `card`,
  `confirm-dialog` (`ConfirmDialog` = the one second-step for consequential actions), `dialog`,
  `dropdown-menu`, `icon-button`, `input`, `popover`, `separator`, `sheet`, `sidebar`, `skeleton`, `switch`,
  `toast` (`WovenToaster`), `tooltip`.

## Shared library: reach for these, don't hand-roll

From the 2026-07-28 full-app audit, kept current through the 2026-10-02 evolve pass:

- **`SegToggle` / `ViewTabs` / `FilterChips`** (`controls.tsx`): the three control roles.
- **`DIVIDED` / `DIVIDED_FLUSH` / `FOCUS_RING` / `POPOVER_SURFACE` / `MENU_SURFACE`** (`classes.ts`): the row
  dividers, the focus ring, the two floating materials. `controls.tsx` re-exports only the first three. Server
  components import from `classes.ts` directly, because a constant exported from a client module becomes a proxy.
- **`IconButton`** (`ui/icon-button.tsx`): label REQUIRED. Bespoke exceptions are deliberate (dense
  toolbars, hint-tooltip triggers, input-embedded controls); keep their glyphs on the icon scale in
  `docs/reference/design-system.md`.
- **`Button variant="confirm"`** (`ui/button.tsx`): the WASH rung, the one place forest 6/10/14 is written.
- **`Valve` / `ChoiceValve` / `provisional`** (`proposal.tsx`): the shared trust valve (Inbox, /team, ⌘K).
  `ChoiceValve` carries optional `ariaExpanded`/`ariaControls` when a choice reveals an inline review.
- **`ConfidenceWord`** (`confidence.tsx`): the one confidence vocabulary; import it by its own name.
- **`NodeMark`** (`entity-profile.tsx`): the kind mark that leads rows, ⌘K results and rail ties. The cover does not use it.
- **`FeedHead`** and **`AgentBand`** (`inbox-agent-band.tsx`): the label on a hairline (props `count`,
  `kind="demand|inventory"`, `note`, `lead`, `flush`) and the one agent byline per surface. A count = the
  summed viewer-actionable rows it stands for (the sidebar Inbox badge is a deliberate cross-tab superset; do
  **not** "fix" the inequality). `undot()` lives here too.
- **`TypeBadge` / `StatusPill` / `PeopleStack` / `CollectionTag`** (`artifact-ui.tsx`); **`CoverArt`**
  (`cover-art.tsx` over `neighbourhood-cover.tsx`): the card and hero pieces (Library card ↔ Home hero).
- **`LocalGraph`** (`local-graph.tsx`) with `graphKey` (the hover key), `FoldChip`, `WELD_MS`: every graph
  field, including the collection Map, the public hub and the per-doc overlay.
- **`PageHeading` / `PageBreadcrumb`** (`page-heading.tsx`): the h1 and the eyebrow.
- **`Section` / `Row` / `RowList` / `SectionAction` / `EmptyRow`** (`today-ui.tsx`): shared row grammar.
  `Row` has `interactiveTrailing` so a Valve never nests inside a clickable Row; `Section countHint` puts a
  sentence about a count in the count's hover. `Row` starts its marker at the column edge in a `w-6` slot, with
  a `-mx-2` hover wash. The Library list rows differ; see Named exceptions below.
- **`PersonAvatar` / `AgentAvatar` / `AgentMark`** (`identity.tsx`, `agent-mark.tsx`).
- **`HashChip` / `isHashLike`** (`exact-evidence-snapshot.tsx`): any hex revision value, 7 characters + copy.
- **`PAGE_FRAME`** (`lib/frame.ts`); **`houseSeparators` / `upperFirst`** (`lib/text.ts`).
- **`entity-peek.tsx`**: the leaf peeks. `ContextRail` is a private function inside `artifact-reader.tsx`, so it is not
  a primitive to reach for.
- **`lib/export.ts`** (JSON carries the graph neighborhood), **`lib/diff.ts`**, **`lib/artifact-drag.ts`**.
- **`SharePanel`** (`share-menu.tsx`): the artifact Share surface, a public/workspace toggle only. `ShareCollectionDialog`
  is a separate surface. There is no shared ladder in code yet.
- **`DecisionStateLabel`** + `activationTrustLabel` / `ACTIVATION_MATCH` / `observedAtLabel`
  (`decision-state.tsx`): the one lifecycle and proof vocabulary for Inbox, the review packet and Decision
  detail (`Needs approval`, `Approved, waiting for activation`, `In effect`, `Needs revalidation`,
  `Superseded`).
- **`ReviewPacketView`** (`review-packet.tsx`): the one derived judgment context used by focused Inbox;
  reads as one causal brief: conclusion → Activation condition → selected exact Activation proof → Decision
  evidence + affected Claim freshness → trust history → lifecycle call, followed by stable-detail and
  Decision-scoped Ask exits. It owns no state; do not embed it inside Decision detail or persist it.

## Named exceptions

Rule 30 of `AGENTS.md` allows a divergence from a shared primitive only when it is named. This list started on 2026-11-03, so an older divergence may still be missing. Add yours here in the same commit.

- **Library list rows.** They are hand-built, in a local function also named `Row` at `app/(app)/library/page.tsx:128`. They hold a 16px select slot in front of the mark and end in a `w-16` age slot. A shared `Row` placed above that list sits about 30px left of the list's marks at desktop (cold test, 2026-11-03). No owner decision covers that offset. Rule 30 still applies to a new row, so use the shared `Row`, import it under an alias such as `Row as ShortcutRow` because of the name clash, and add the offset to this entry.
