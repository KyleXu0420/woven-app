# Design system

> What this is: the full design rules and calibration for Woven, moved out of `AGENTS.md` on 2026-11-03 and corrected against the code at `84a4bb8`.
> Status: live reference. `app/globals.css` and the components are the source of truth, and they win over this file.

The reasons behind these rules are in `docs/reference/decision-log.md` and `docs/design/brand-iteration.md`. The measured detail is in `docs/design/rules-detail.md`.

## Hard rules

`pnpm check:design` runs `scripts/check-design-rules.mjs` over `app`, `components` and `lib`. It has 10 rules. Four run at `error`: `no-raw-hex`, `no-pure-black-white`, `no-palette-colour`, `weight-cap-400-500`. Six run at `warn`: `no-alpha-ink`, `no-fractional-px`, `off-scale-box`, `no-unnamed-text-size`, `no-middle-dot`, `no-unnamed-radius`. The baseline on 2026-11-03 is 0 errors and 74 warnings, clustered in `components/entity-peek.tsx` (41), `lib/api.ts` (19) and `components/catch-up.tsx` (8). Add no new hit in a file you touch. Comments in the script saying a rule flips when "line A" lands are stale; the rules stayed at `warn`.

**Color**
- **One chromatic accent = forest `--primary`, and it is CHROME/AGENT/CONFIRM only.** Two treatments:
  *provisional/proposed* = forest **wash + hairline** (`bg-wash border-line-wash`, dashed on a graph tie),
  *committed* = inked forest. **Forest weight is decided by the action, never by the neighbour**, three
  questions in order: **WRITES?** (no: it dismisses, opens, asks, undoes, navigates) → NEUTRAL, no forest
  anywhere. **HOW MANY?** (acts on many objects, or repeats down a list) → WASH, `variant="confirm"`, never
  solid. **TICK-SHAPED?** (one half of an accept/reject pair on one object) → a MARK, icon-only; otherwise a
  WORD, a `Button` with its label and count. SOLID (`<Button>` default) is a write on exactly one object that
  does not repeat and is the only commitment offered (a dialog or sheet footer commit, beside a ghost
  cancel). **≤1 solid-forest button per view; weight tracks scope.** Hover **deepens, never pales**: never
  `opacity-*` or `/80` on forest. `confirm` ships as the variant, never as a copied className.
- **Data series & data figures = NEUTRAL ink.** **Forest is never a chart series.** Settled content
  (Library, collection members, search results) stays neutral; selecting it is neutral `tint-2`, never forest.
- **`--chart-1..12` = DATA-IDENTITY only** (collections/topics/people/artifact families, via
  `lib/identity.ts`): **never a button, link, text, status chip, or chrome.**
- **Staleness = the semantic `--warn` token** (ochre), never raw amber, never a `--chart-*` tint
  **even at the same hex** (see Gotchas below). No 5th hue; success reuses forest.
- Warm ground, **never `#fff` / `#000`**; depth by **tone not shadow**: no gradient, glow, halo, overlay
  or hover spotlight. Use token vars, not raw hex. Open debt: `TrendChart` fills under its line with a
  `linearGradient` (`app/(app)/collection/[slug]/page.tsx:195-200`), the only gradient in `app/` or `components/`.
  Either the rule gets a named exception or that site gets fixed.
- **Translucent inks are named tokens.** Never write an opacity modifier on `foreground`, `primary`,
  `muted-foreground`, `border` or `ring` (lint `no-alpha-ink`). Use `tint-1/2/3`, `wash`, `mark`,
  `line-edge/hover/stroke/wash/confirm`, `foreground-prose`, `foreground-hint`, `ring-focus` (see the alpha-ink
  family below).

**Type**
- **All-sans is LOCKED.** Geist for UI + display + reading; `--font-serif` is dormant plumbing that
  **resolves to Geist**. Reading distinctiveness = **size + leading + measure, not a serif.**
- **Geist Mono = the agent's byline + real code/paths/values ONLY** (a hash, a `key = value`), never
  eyebrows, counts, states, nav, badges, timestamps, IDs, or edge labels (Geist sans + `tabular-nums`). A
  hash is never body text: it is a 7-character mono chip that copies the full value (`HashChip`).
  **Keycaps are an open owner call.** `docs/design/brand-iteration.md` allows them in mono. The code draws them in sans
  (`Keycap` in `components/search.tsx` and `components/app-sidebar.tsx`, the `<kbd>` in `components/ui/icon-button.tsx`), and
  the comment in `components/search.tsx` calls a keycap chrome. One keycap uses mono
  (`components/artifact-graph-overlay.tsx:228`), and the comment above it, "matching every other <kbd>", is stale. New
  keycaps copy the sans `Keycap`. Leave the mono one until the owner decides.
- **UI weight capped at 400/500, emphasis by SIZE.** **Sentence case everywhere**; UPPERCASE survives only
  on a tiny format badge (`HTML`/`MD`).
- **Write the rung, never a pixel.** `text-[Npx]` is not written, and 14 and 13.5 are not rungs. Two kinds of residue
  stay. Neither grows, and neither gets folded unasked. The first is three 10px monograms, marks sized against their
  shape: `components/identity.tsx:34-35`, exempt from the lint, and `components/app-sidebar.tsx:287`, a counted warning.
  The second is text inside graph SVG (`labelFs` in `components/local-graph.tsx`, and the 11px stamp at :2109). No 10px
  badge is left in the code. The owner's call on 2026-08-15 was 「对，10px 也折掉，圆角和头像的账一起数」, and the record says
  three avatar-letter sites stayed. A site never writes `leading-*` (only `leading-none` where the box is the glyph).
  Every page h1 is `text-2xl`; hierarchy under it is the breadcrumb's job. The Decision h1 is the one named exception, `text-3xl` on purpose (`components/decision-detail.tsx:101-104`). Ladder below. Open debt on
  2026-11-03: 28 lint hits are hand-sized interface text, in `components/entity-peek.tsx` (23 sites at 12/13/14px,
  for example :41 and :222) and `components/catch-up.tsx` (5). `components/entity-peek.tsx` also carries 9 of the 10
  `leading-*` sites, and `components/search.tsx:1160` is the tenth.
- **No middle dot and no em-dash chains in product copy.** Facts join with a comma, a sentence break, or
  space inside a hairline band; record text that carries dots goes through `undot()` / `houseSeparators()`.

**Controls / components (reach for the shared primitive, don't hand-roll; see `docs/reference/components.md`)**
- **Segmented switch → `SegToggle`** (track-and-thumb: recessed track **no border** + raised thumb **no
  ring**). Three control ROLES stay **deliberately distinct, do not unify**: `ViewTabs` (underline+forest,
  page-level) / `SegToggle` (in-view) / `FilterChips` (facet). Inside a tab strip a count wears the tab's ink.
- **Accent = ACTION not SELECTION.**
- **Icon-only button → `IconButton`** (label REQUIRED → aria-label + tooltip; sizes `icon-xs/sm/icon/
  icon-lg` = 24/28/32/36, **never hardcode `size-[Npx]`**). A tooltip is a label: ink fill, text-xs, no arrow.
- **Tick/cancel = `Valve`**: ✓ = the WASH mark (`variant="confirm"`), ✕ = ghost, both icon-only with the
  word in the tooltip; `icon-xs` on a row's title line. Only a Confirm/Dismiss pair is a Valve. A second
  choice that is a different action (Archive old / Keep both, Automate this / Not now) keeps its words on
  `ChoiceValve`. Batch "Confirm all N" = a `Button variant="confirm"` word, only for a real batch (2+).
- **Confidence is a word at rest** (`ConfidenceWord`): high renders nothing, "Likely" muted, "Unsure" in
  500 ink; the % lives only in the hover. Never bars, a meter, a hue, a circled mark or forest.
- **Small numbers:** demand (waits on this person) = `text-foreground font-medium tabular-nums`, hidden at 0;
  inventory = muted; a fold "+N" = a `tint-1` chip. Never in a pill, never forest, never revealed by hover.
  **A trailing action** (`SectionAction`) = 13px muted → ink on hover, flush to the column edge, ending in
  one mark: `ArrowRight` when it leaves, the kbd when it invokes. Never forest, never `›`. Its `onClick` form
  renders no mark. That form has one caller, the "All N" action in `components/story-strip.tsx`, which opens an
  overlay. No rule covers an in-page action yet.
- **Radius ladder**, three rungs by **what the box is**: **sm 4 = MARK** (ticks, swatches, keycaps,
  micro-chips; 8–20px), **md 10 = CONTROL** (rows, menu items, icon tiles, inputs, chips, tracks; 24–40px),
  **lg 16 = SURFACE** (cards, panels, popovers, dialogs, sheets, canvases, covers). `rounded-full` = action
  language only (buttons/badges/avatars/dots), never an input or card. **There is no xl rung**:
  `--radius-xl..4xl` are aliases pinned to 16 so old sites cannot invert the ladder; write `rounded-lg`. Fix
  the primitive and every instance follows. Exempt only where radius is **encoding** (the NodeMark alphabet).

**Dividers / rails**
- **Row dividers via the shared container class**: `DIVIDED` (inset 12px) inside a contained surface,
  `DIVIDED_FLUSH` for a list that sits in the page column and shares its edges (closing `border-b`). Rows
  carry **no `border-t`**. **Never a left-edge accent stripe / hairline rail** on any component (it reads as
  templated-AI); encode state via chip / icon color / leading mark / bg tint / type.
- **A grouped-list header is a label on a hairline** (`FeedHead`): 12/500 muted label, a bare count after
  it, a 1px `line-edge` rule, the label on the rows' mark edge. **No fill**: the 09-12 tint-2 band is
  reversed (2026-10-02).

**Cards**
- **Minimize cards.** Lists, rails and feeds = open rows on hairlines, not a stack of bordered cards.
  **A graph is the page plane**: no card, no well, no ⓘ. **Cards survive only for:** floating surfaces
  (popover/toast/dialog/dragged card), the Library grid **cover-card**, and callouts. A card at rest has a
  hairline, not a shadow.

**Layout**
- **`PAGE_FRAME` (`lib/frame.ts`) owns page width: ONE centered register `max-w-[1040px]`** (`focused`/
  `browse` are aliases kept so callers don't churn; `fill` for a page whose last block runs to the bottom;
  `full` for graph canvases). Browse surfaces are single-column row lists; the Library grid is the one grid.
- **Responsive:** prose flows (an icon inside a sentence is inline, not a flex sibling); a leading marker
  sits on the first line (`items-start`), not the row's centre; truncate only what has a fuller form one
  click away; on a phone a trailing cluster wraps under the title. Hand-off controls are ≥44px below md. `md` is
  768px, the Tailwind default, because `app/globals.css` sets no breakpoint. Both hinges are in use (28 `max-md:`
  and 16 `max-sm:` sites on 2026-11-03), so read the neighbouring code for the one a surface uses. With no
  neighbour to follow, use `md`, the one hinge `lib/frame.ts` names.

**The always-in-force doctrine**
- **Nothing enters the graph as fact until a human confirms** (suggest-then-verify). **The confirm IS
  the episode** (`verifyEdge` also `recordEpisode`), and it has one motion, the weld (below). Provenance is
  grammar (dashed/wash = proposed, solid = trusted). An Ask answer is a **single cited claim verifiable in
  place.**
- **A row leads with the kind mark of its subject** (`NodeMark`, 12px, in the subject's hue), in Library,
  Collection, Inbox, Activity, Governance and every ⌘K result. Never a lucide file icon, never a person
  avatar or the agent's seal as a bullet. Nav icons stay lucide (chrome).
- **The agent is credited once per surface** (the `AgentBand` byline). The generic `Sparkles` icon is
  never the agent; `AgentMark` is. Open debt: Sparkles still renders in agent-answer and Ask contexts at
  `components/artifact-graph-overlay.tsx:162` (in forest), `components/edit-chat-bar.tsx:111` and
  `components/entity-peek.tsx:275`. `components/graph-ask.tsx:4` is an orphan. Which sites count as the agent is a
  judgement call to confirm with the owner.
- **No ⓘ and no hint sentence on any page header.**
- **Voice:** agent = present-tense, one fact per sentence, numbers in full ink, ≤75ch; never chats, sells
  or apologizes. Actions = verb-noun ("Capture", "Confirm"), never "Submit/OK". Banned adjectives:
  seamless / powerful / revolutionary / effortless. Numerals always digits.
- **Icons** = Lucide, outline, 2px, `currentColor`, on the 16/20/24 scale. The ship scale is wider than that:
  `size-3.5` (14px) is the Button's default icon at xs, sm and icon-xs (`components/ui/button.tsx:71-74`) and about
  93 call sites write it; about 43 call sites write `size-3` (12px). Allow 14 in compact controls or sweep the sites;
  that call is open. Icons are chrome, never the agent's voice.
- **Full state set** on every interactive component (default/hover/active/focus-visible/disabled/
  loading). **Focus-visible = `FOCUS_RING`** (`ring-2 ring-focus`, the forest ring), never browser blue.
- **The brand mark (`WovenMark`, `AgentMark`) is hand-designed by Kyle: do NOT auto-generate or
  redesign it** without an explicit ask.

## Calibration

The whole system = three materials in disciplined use: **warm paper** (never white), **Geist**
(all-sans), and **Geist Mono reserved for the agent's voice**. One chromatic identity: **forest**. Depth
from tone, not shadow. The hard rules above are the checklist; this is the calibration. The token digest is at the
end of this file.

**Alpha-ink family (settled 2026-09-05; do not re-argue).** Neutral fills `tint-1/2/3` = foreground
6/10/14% in both themes: **tint-1** = hover on ground, a menu item's `:focus`, an object at rest (chip, kbd,
icon well, avatar dish), a sunk track; **tint-2** = selected/open (`data-active`, `aria-expanded`,
`data-popup-open`), press on ground, hover on an object; **tint-3** = press on an object, hover on the
selected. Forest fills: **`wash`** = primary 4%, the provisional surface, always with `border-line-wash`
(alone it is invisible); **`mark`** = primary 10%, inline highlight, icon dish, status chip; the confirm
button's 6/10/14 lives only in the variant. Lines: `border` = divider and a bordered control at rest,
`ring-line-edge` = a raised surface's edge, `line-hover`, `line-stroke` = a control's own outline at rest
(checkbox, facet chip), `line-wash`, `line-confirm` = a committed outline. Inks: `text-foreground` (UI
words), `text-foreground-prose` (running prose a reader reads), `text-muted-foreground` (secondary words),
`text-foreground-hint` (non-text glyphs only, never a word); disabled = `disabled:opacity-50`. An object keeps
its own token on every ground (alphas composite): never raise a chip because its row changed state. Warn and
destructive have no named wash yet (`bg-warn/10` stays).

**Type ladder** (ONE `@theme` block in `globals.css`; `--text-*: initial` first, so an undeclared rung does
not exist; each rung owns its leading and tracking): xs 12/16 label, meta; sm 13/18 secondary, controls,
chrome, the body of every Dense surface; base 15/22 row title, section label, input, dialog title, button;
lg 17/24; xl 20/26 heading; 2xl 28/34 the page h1 and stat figures; 3xl 44/50 display; 4xl 64/68. Reading
register only: `text-read` 19/30, `text-read-heading` 22/28, `text-read-display` 40/46 (the reader, the
public pages). A Dense surface (sidebar, tab strip, agent band, menu, popover) pairs sm/500 over xs/400; an
Interface row pairs base/500 over sm/400. A section is parted from its rows by space (Section `mt-8`), never
by a size of its own. On a coarse pointer, fields float to 16px from a rule outside every `@layer`.

**Controls grammar (`controls.tsx`):** ① **ViewTabs** = page-level, `border-b`, active = ink + 2px forest
underline. ② **SegToggle** = in-view, `rounded-md bg-secondary p-0.5` track + raised thumb (no border/ring).
③ **FilterChips** = `h-7 rounded-full px-3 text-sm`. **Dividers:** `DIVIDED` / `DIVIDED_FLUSH` live in
`components/classes.ts`, a module with NO `"use client"`, because a string exported from a client module is a
proxy inside a server component and silently never renders.

**Graphs: one alphabet, four axes.** Shape = kind (artifact rounded square, collection near-square at an
artifact's size, topic hexagon, decision diamond, person a filled circle, source a hollow ring with the ground inside and its hue
on the line only, meaning an origin outside the base; the two are never drawn alike); size = depth; hue = identity (the
collection's own; forest only for proposed ties and the confirm beat); line = provenance by STYLE (dashed =
`ai_generated`, solid = verified) **and** evidence by WEIGHT (fork 2, 2026-10-02). A node still processing
is a dashed outline, never a faded fill. Nothing scales on hover: the pointed mark holds still, its name goes to
weight 500, and the rest of the field steps back. Whole-node scale, ring and mark scale 1.3 were each rejected
(`components/local-graph.tsx:1461`, `:1943`). Nothing glows.
- **Amplitude:** confirmed tie 1.5px; a heavily evidenced tie 2.5px (`EVIDENCE_HEAVY` = 3, counted from the
  data: shared artifacts on the space field; elsewhere the confirmed ties joining the same two nodes. Confirm
  episodes are not a count, and no ego map reaches 3 on the seed, so every confirmed tie there is 1.5px); proposed 1.5px dashed 4/4 in full
  forest. Names 13px ink, seated where they cross no line, mark or name (`chooseLabelSides`), over a 0.3em
  knockout in `--graph-ground` (set it to whatever ground the field paints on). A glyph's narrowest span is
  ≥8px at 1440. Team ties wear their collection's hue.
- **Space field:** rings by KIND (it is all depth 1); the renderer's radius (`markRadius`) is the truth the
  layout and labels use; layout output is rounded to 1/100px. After a layout change `node
  scripts/orbit-bench.mjs` must PASS.
- **Reach is not a setting.** There is no depth switch. A first-ring node with further ties wears the fold
  chip "+N" (`FoldChip`, tint-1): hover ghosts its ring, click unfolds it in place ("−" folds back); the list
  mirrors the same expanded set. A **wide fan** (≥8 names under one hub) takes its whole sector, stepped by
  need, sides before corners.
- **The key:** every field wears one textless hover key in its top-left corner (`graphKey` → `GraphKey`):
  two rows, the lines (confirmed, the heavy rung where this field has one, proposed) and the shapes it draws.
  No ⓘ, no legend card.
- **The weld, the one signature motion:** confirming a proposed tie closes its dash solid in 240ms ease-out
  (`.weld-tie`; `WELD_MS` from `local-graph.tsx`) while the review row's proposed words go muted → ink
  (`.weld-ink`); the row leaves after the beat; a second ✓ during the beat does nothing and the commit
  re-checks the edge is still pending. Reduced motion = no animation. Never on the agent glyph.

**Other data-viz:** trust/audit, always paired with the list. One series = a neutral 1.5px ink line, flat fill
or none, labelled hairline axes, the leader in ink. `TrendChart`'s gradient fill is open debt (see Color above).
KG = local neighborhood (depth 1–2).

**Surfaces (settled 2026-09-14 → 10-02):**
- **The cover is the document's own cloth** (`NeighbourhoodCover` behind `CoverArt`'s unchanged API, 2026-10-07,
  `5369ae4`). It is a window onto the cloth at a fixed sett, about an 8px end with a 1px seam, so a bigger box shows
  more cloth and never a bigger thread. Warp stripes are sections, width by word count. The yarn is the hue of the
  collection the card's chip leads with, undyed if unfiled. A plain-weave weft appears once the document has any
  confirmed link. The two strongest links float in the neighbour's hue. A document with no links is the warp alone.
  Proposed links, restricted neighbours and words are never drawn. Placement: the band in the Library card's 3:1
  head; a swatch of the band's box (230 by 75.66) on a tint-1 mat on the Continue hero from sm; the full strip on a
  phone. Kyle picked this. Do not revert it to a ring, a gradient or a first paragraph. The spec is the header
  comment of `components/cover-cloth.ts` (sett, warp, weft, floats, seams). The header of
  `components/neighbourhood-cover.tsx` says what drives the cloth and where it lies, and `components/cover-read.ts`
  reads the doc.
- **The row grammar** (Collection Contents, Library): line 1 = the NodeMark (dashed while processing), the
  title, then ONE trailing cluster: the type code, and a state only on exception (`StatusPill` "Source changed
  2d ago" / "Processing"; superseded = a tint-1 chip). "Living" never renders at rest. Fixed cells follow from
  lg (collection, people, age); line 2 = the gist in text-sm on the title's edge. A checkbox owns a reserved
  slot outside the link, so nothing moves when it shows; ⋯ hangs in the right margin at md+, in flow below.
- **The people stack opens** (`PeopleStack artifactId`): the whole stack is a hover peek (Popover
  `openOnHover`, 160ms; tap and Enter too) listing each person, their latest action here and when, newest
  first, each row linking to `/people?focus=<id>`. No native title.
- **The explorer shell** (`/team`, `/topics`, `/people`): eyebrow (`PageBreadcrumb`) → ONE h1 = the
  subject's mark + name, the name is the switcher → `ViewTabs` List / Graph / Timeline, trailing slot empty →
  the view on the page ground. A control exists only where its data does. Library and Inbox take the same
  header: h1, no ⓘ, no hint sentence.
- **An Inbox row:** the subject's NodeMark in a 28px lead column; a proposed claim's relation and target
  muted, subject in ink, until the weld; `ConfidenceWord` in the title line's trailing cluster before a Valve
  at icon-xs; the reason line text-sm. The automate offer hangs under the AgentBand byline: no card, no seal.
- **⌘K fills its takeover:** one three-track grid (`FRAME` in `search.tsx`) puts the field, the results and
  the footer on one 720px column; one paper ground, no bands; groups under `FeedHead`-style labels; entity
  rows lead with their NodeMark, an Ask row with the mark of the center it resolves to (AgentMark when none);
  the footer = three hints about the focused row in plain words + a "?" keycap for the rest, hidden below
  640px. **The scope chip** names what Ask is locked to with that thing's NodeMark + name (artifact, decision
  or space); the space chip is a real filter.
- **Capture** (`capture-flow.tsx`): the way in is the ink-filled `+ N` box at the search well's right (it
  writes nothing, so it is not forest; "Capture" lives in the tooltip). One inferring field, no type chooser;
  rows on hairlines, snapshot vs reference as one muted word; a footer only once a row exists: ghost Cancel +
  one SOLID `Capture N artifacts`. One verb. The house Dialog, centred. `N` opens it outside a field.
- **Public pages (the Are.na register):** a publisher monogram dish + `PageBreadcrumb` eyebrow over a
  `text-read-display` title; a hairline metadata band (`border-y`, items parted by space, each read from the
  store or left out); open rows on hairlines; the "Published with Woven" foot with the WovenMark. `/c/`
  heroes the collection's real map, cut to published members and confirmed ties: a private title or
  collection name never reaches a public page.
- **The reader rail:** each kind draws its first two ties by name (NodeMark + name, grouped by kind under a label on
  a hairline) and folds the rest behind "+N" (`TieGroup`), never a count tile. "Woven into" is an aria-label, not a
  visible heading. A collection the doc is filed in is drawn by the Collections property below it, so the band
  leaves it out. Story shows three items, two lines each (what happened; kind, who, when), plus "All N".

**The agent mark (`agent-mark.tsx`, the seal, 2026-09-08, `c7599c3`):** a filled r=11 disc on the 24-grid with ONE wave
cut out (crest, valley, crest, run-out) at 70% of the disc's width. No node exists. The disc is forest mixed 70% toward
the ground. Only the wave's stroke changes with size: ≥24 is 2.4, 16–23 is 2.9, ≤15 is 3.4. `state="idle"` the wave
breathes inside the still disc, `"thinking"` the wave's luminance pulses, `"still"` or reduced motion nothing. The disc
never moves. `tone="paper"` inverts it for forest grounds. `AgentAvatar` adds no dish: the seal is the dish, and it is
never placed inside another. It is never a ring (circled = status) and never a row bullet, so the agent is credited
once per surface. Person (tinted-dish monogram), agent and anon are all **circles**. Interlaced and braided forms are
dead. Measure a 12px glyph at DPR 1. **Do NOT auto-generate the brand mark.**

## Gotchas

**When code and a doc disagree, trust the code.**

- **`--accent` is neutral** (`#e9e9e4` light, `#141210` dark). **`--primary-wash` is not a live token**: the wash is `bg-wash`.
- **`--warn` and `--chart-2` are the same hex `#b8863b` but semantically SEPARATE tokens**: warn = caution semantic,
  chart-2 = a data-identity tint. **Never substitute one for the other in code.**
- **`globals.css` ships all 12 chart tokens.**
- **`PAGE_FRAME` is ONE centered width `max-w-[1040px]`.** A comment at `app/globals.css:271-276` still says pages are
  left-anchored; `lib/frame.ts` wins.
- **`text-base` is 15px, not Tailwind's 16:** the ladder is rebound in `@theme`. `rounded-xl`/`2xl` still compile
  (aliases pinned to 16); they are debt, not rungs. An `@theme` edit needs a dev-server restart.
- **`cn()` is not stock.** `lib/utils.ts` extends tailwind-merge so `text-read*` stay font sizes. `text-read*` shares the
  `text-*` namespace with colours, so no `--color-read*` token is ever declared.
- **The reader renders on the Reading rungs** (title 40, body 19, H2 22).
- **`PageHeading` still accepts `hint`.** It renders nothing and no caller passes it. Do not pass it.
- **Middle dots in records.** Display code cleans them with two helpers: `houseSeparators()` (`lib/text.ts`, pattern
  `\s*·\s*`) and `undot()` (`components/inbox-agent-band.tsx`, pattern `\s·\s`). The dots are in DecisionTruth answers, cite
  labels, action details, ask-suggestion subs, `responsibilityLabel`, the auto-confirm summary and capture labels in
  `lib/api.ts`, and in seed copy in `lib/data.ts`. The frozen snapshot payload of `a_launch_calendar_state` keeps its em
  dashes on purpose: its `content_hash` is the real sha256 of `raw`.
- **The dark theme** is shipped but lightly reviewed.
- **A stale comment on the mark.** `app/globals.css:402-404` still describes woven threads and over-under. That predates the
  seal; `components/agent-mark.tsx` is the source.

## Token digest

This is a digest of `app/globals.css` (`:root`, `@theme inline` and `@theme`), which is the source. Read that file for the rest: the full `.dark` block, and the line-height and tracking on every type rung. The type ladder above carries the pairs.

Use the Tailwind-v4 utility (`bg-primary`, `text-warn`, `border-border`, `bg-chart-4`), never raw hex —
`@theme inline` maps the `--x` colour tokens to `--color-x` utilities (`--radius` is not one of them). `.dark` lifts each value (forest → sage
`#6fb58a`, ink → oat `#edeae2`, raised = *lighter*, on-primary flips DARK `#17231a`, sidebar `#100e0b` one
rung under the canvas `#1a1815`, `color-scheme: dark`).

```
surfaces   --background #f1f1ee  --foreground #1b1b18  --card/--popover #fafaf8
           --secondary/--muted #e9e9e4  --accent #e9e9e4 (NEUTRAL, not a wash)
           --border/--input #e3e2dc  --muted-foreground #5a5852  --radius 0.625rem  color-scheme light
inks       --foreground-prose #3b3b38 (prose)  --foreground-hint #878681 (glyphs only)
           --muted-on-ink #a8a294 / dark #5a5852 (secondary ink on the tooltip's ink fill)
forest     --primary #365e33  --primary-hover #2d5029 (deepens)  --primary-foreground #f5f3ec (oat)
           --ring #365e33   (no --primary-wash: the wash is the bg-wash alpha below)
semantic   --warn #b8863b (ochre)   --destructive #b23b2e (brick), foreground #f5f3ec   (success reuses forest)
alphas     tint-1/2/3 = fg 6/10/14%  wash = primary 4%  mark = primary 10%  line-edge fg 10%
           line-hover fg 20%  line-stroke fg 30%  line-wash primary 15%  line-confirm primary 40%
           focus = ring 40%   tint-on-ink = background 14% (a keycap on the tooltip)
           (all in @theme inline, as --color-*; see the alpha-ink family above)
sidebar    --sidebar #ecebe8  --sidebar-foreground #5a5852  --sidebar-accent #e6e5e0  --sidebar-border #e6e3da
           --sidebar-primary #365e33 (foreground #f5f3ec)  --sidebar-ring #365e33
chart      1 #6e8b6a sage, 2 #b8863b ochre, 3 #4e8378 teal, 4 #5b7793 slate, 5 #7a5c86 plum,
(data-id)  6 #9c5f84 mauve, 7 #b0617a rose, 8 #b06a4f clay, 9 #4a7f93 ocean,
           10 #6d6fa6 periwinkle, 11 #93883f gold, 12 #7e8a4c moss   (1–5 frozen; do NOT reorder)
radius     --radius-sm 4 (mark)  --radius-md 10 (control)  --radius-lg 16 (surface)  [xl..4xl = 16 aliases]
type       xs 12, sm 13, base 15, lg 17, xl 20, 2xl 28, 3xl 44, 4xl 64; read 19, read-heading 22, read-display 40
fonts      --font-sans = --font-serif = Geist ;  --font-mono = Geist Mono
```
