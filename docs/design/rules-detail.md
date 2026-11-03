# Design rules in detail

> What this is: the measured rule text behind `docs/reference/design-system.md`, written between 2026-09-03 and 2026-10-07, with the commit that proves each rule.
> Status: live reference, last edited 2026-11-03. Rules the code later overturned are cut or marked. Where it disagrees with the code, the code wins.

## Graphs (rail, public mark, ego map, space field)
- ONE alphabet, four axes, one job each: shape = kind (artifact rounded square rx side/4; collection near-square
  rx side/10, same size as an artifact at its depth; topic hexagon; decision diamond; person a filled circle; source a hollow ring, the ground inside and its hue on the line only);
  size = depth; hue = identity (the collection's own; forest only for proposed ties and the confirm beat; a
  space-field centre is the frame, so it is ink); line = provenance (dashed = ai_generated, solid = verified; a
  node still processing is a dashed OUTLINE, never a faded fill). No glow: no ambient gradient, halo, drop-shadow
  or hover spotlight. Nothing scales on hover: the pointed mark holds still, its name goes to weight 500, and the
  rest of the field steps back. (b4311c9, fd5c930; the hover rule as it stands in components/local-graph.tsx)
- The space field rings by KIND, not depth (the space graph is all depth 1). The renderer's radius
  (`markRadius`: member count / contribution weight) is the truth the layout and the label pass use. Layout
  output is rounded to 1/100 px (server and browser V8 differ in the 14th digit; React reports the mismatch).
  `node scripts/orbit-bench.mjs` scores the layout: PASS = no spoke grazes a mark it does not end at (< 14px)
  and no bead (a collection on a person's line to the centre); name crossings are advisory. (4d9fedc, 83575d5)
- Names choose a seat — below, above, right, left, then the four corners — that crosses no line, mark or name
  (`chooseLabelSides`, greedy: centre, collections, people), and paint over a 0.3em stroke of the ground colour
  (`--graph-ground`, default the card; a graph on the page ground sets it) so a line that must pass behind a
  name breaks around the glyphs. A knockout in the ground's own colour is not a glow. (af30790, eb80bce)

## Home (/today)
- Numbers are sourced ONCE: the date line, the Needs-you count and the sidebar badge read `inboxBadgeCount()`
  from one snapshot per graph version (`components/home/home-facts.ts`). A hand-off row reconciles: 1 shown +
  N more = the badge; a breakdown prints only when the kinds the page can see add up to N. (3217c7d, aedcf73)
- "Since you were away" has an away: the shell stamps the visit on pagehide / tab hidden (`SeenStamp`); a
  reader never writes; "away" is a session gap of 30 minutes, so a page change or a tab switch never shrinks
  the window (`lib/last-seen.ts`). The zone's byline names the window in the agent's mono voice. (05780e0)
- A living doc whose source moved is not "Living": `StatusPill stale` renders the warn dot and the fact.
- A zone with nothing to show renders `EmptyRow` and keeps its header and action; the marker names the actor
  (the agent only where the agent is the subject).
- The mobile trigger's band lives in the layout that declares the trigger (`SidebarInset max-md:pt-14`), never
  in the page frame. Every hand-off control is ≥ 44px below md.
- The printed rule under a ranked list is generated from the table that sorts it (`lib/home.ts KIND`), tested in
  `scripts/home.test.mjs`. Since 2026-10-02 it sits in the count's hover (see the evolve pass below).

## Copy
- The generic Sparkles icon is not the agent; `AgentMark` is. A decision-scoped Ask row is derived from the
  decision record, never typed.

## Forest action weight (2026-09-04) — decided by the action, never by the neighbour

Every forest control is settled by three questions about the ACTION, answered in order, off the diff, without
opening the page and without looking at what sits beside it. Nothing here resolves by matching a sibling
surface: a rule that resolves by looking at a neighbour changes whenever the neighbour changes, which is how
one proposition became eight statements.

1. **WRITES?** Does the click add something to the record — a confirmed edge, an approval, a created artifact,
   a publish, a stored observation? If no (it declines, dismisses, undoes, closes, navigates, opens, reveals,
   asks or selects) the control is NEUTRAL: no forest, at any radius, at any size, in any hand-written string.
   Forest is the colour of assent; a control that assents to nothing does not wear it.
2. **HOW MANY?** Does one click act on more than one object, or does the same control repeat down a list?
   Either answer bars SOLID. A bulk commit is never the brightest object on the surface, and repetition is
   itself the proof that no single click ends the work.
3. **TICK-SHAPED?** Is it one half of an accept/reject pair on a single object, carrying no count and no noun?
   Then it is a MARK — `IconButton`, icon-only, the word in the tooltip. Otherwise it is a WORD — a `Button`
   carrying its label, and its count if it has one.

Q1 and Q2 fix the WEIGHT. Q3 fixes only the FORM. They never trade against each other.

| register | when | treatment |
|---|---|---|
| SOLID | writes, acts on exactly one object, does not repeat, and is the only commitment offered for it | `<Button>` default. A dialog or sheet footer's commit. Always paired with a ghost cancel. |
| WASH | writes, but acts on many or repeats | `variant="confirm"` — as a MARK for a row's ✓, as a WORD for a labelled batch or a ChoiceValve's recommended choice |
| NEUTRAL | writes nothing | `ghost` / `outline` / plain neutral ink. Every link, dismiss, ask, undo, open. |

Standing consequences, which may not be re-argued:
- **A repeating control is never solid.** If it renders N times down one list, Q2 has already answered.
- **Weight tracks scope.** A control acting on more objects is never lighter than one acting on fewer. If the
  heaviest control on a surface acts on the fewest objects, the surface is wrong; "it looks better" is not an
  exception.
- **One control, one action.** A button whose verb changes with its state is two controls, written as two.
- **Wash is forest ALPHA over whatever ground it lands on, never an opaque token.** `bg-primary/[0.06] →
  /[0.1]` deepens on paper and lightens on charcoal from one class. (`--primary-wash` is not a live token.)
- **Hover has two halves**: the surface deepens AND the label's contrast against it does not fall. Forest never
  hovers with `opacity-*` or `/80` (forest at 80% is 4.42:1 on paper, 4.78:1 on charcoal — both under AA at
  13px). A wash moves its ink too: `hover:text-primary-hover`, which flips by theme.
- Ship `confirm` as a **variant**, never as a copied className: the Button base carries
  `border border-transparent`, and hand-concatenated the transparent border wins and the hairline vanishes.

**Tick/cancel — amends the ruling of 2026-07-02 in one word.** A ✓ and the ✕ beside it stay icon-only plus
tooltip, never labelled, and the weight difference is still carried by FILL. Which fill changes: *"Confirm
carries a fill; the fill is solid only when the action is the single terminal commit for one object. Dismiss
carries none."* The 2026-07-19 note's "match the sibling surface" clause is DELETED; its other half (a batch
only earns its place at 2+) is kept and is now derived rather than asserted.

Kept, unamended: ≤1 solid-forest button per view; forest is chrome / agent / confirm only.

## Type ladder — one statement (2026-09-04)

The framework's rung NAMES are the only way a size is written; the rung VALUES are the doctrine's. Both
halves already existed — AGENTS.md wrote 15/13/12 on 07-30, and 22fa470 retired text-[Npx] for the
framework names on 08-14 — but nobody had bound them, so `text-base` rendered 16px, a size on neither the
type scale nor the Interface register, and the ladder was stated three ways (AGENTS 15/13/12, the utilities
16/14/12, the home files' text-[15px]). It is bound in ONE `@theme` block in globals.css; `--text-*: initial`
comes first, so a rung not declared there does not exist.

| rung | px / lh | tracking | job |
|---|---|---|---|
| text-xs | 12 / 16 | – | label, meta, sub-line |
| text-sm | 13 / 18 | – | body-sm: secondary line, controls, tabs, chrome, menus; the body rung of every Dense surface |
| text-base | 15 / 22 | – | body: row title, section label, input, dialog and sheet title (set on the primitive in ui/dialog.tsx and ui/sheet.tsx, never by a site override), button label |
| text-lg | 17 / 24 | – | body-lg |
| text-xl | 20 / 26 | -0.01em | heading |
| text-2xl | 28 / 34 | -0.015em | title: the page h1 sits here, one size on every page; stat-cell figures share the rung (data on the title's size, not a second title) |
| text-3xl | 44 / 50 | -0.02em | display |
| text-4xl | 64 / 68 | -0.025em | display-xl |
| text-read | 19 / 30 | – | READING register only: published body |
| text-read-heading | 22 / 28 | -0.01em | reading H2 |
| text-read-display | 40 / 46 | -0.02em | reading title |

Consequences:
- `text-[Npx]` is not written. Sanctioned residue: 10px on tiny badges / monograms, 11px on one badge with no
  rung beneath it, SVG graph labels (their own vocabulary). On 2026-11-03 the code holds three 10px monograms and no
  10px badge, and the one `text-[11px]` is in `components/catch-up.tsx`, in dead code. `docs/reference/design-system.md` has the
  sites.
- 14 is not a rung, and neither is 13.5. "secondary 13–14" in the register sentence collapses to 13; a 14 that
  was the title half of a pair is 15, the sub half is 13; a 13.5 row title is text-sm, where the Activity and
  Governance rows already went in 22fa470.
- Every existing rung site moves with the values and none is re-decided by hand: the rung name carries the
  pair-half 22fa470 assigned, the value is the register's. Read against 22fa470, the 64 sites it lifted 13→14
  return to 13, the 37 sites written 14 collapse to 13, the 46 sites it lifted 15→16 return to 15, and the 11
  sites it dropped 15→14 land on 13.
- A Dense surface — sidebar, tab strip, agent band, menu, popover, the list inside a dialog — pairs text-sm/500
  over text-xs/400, 13 over 12, and the step is weight and ink, not size. An Interface row pairs text-base/500
  over text-sm/400, 15 over 13.
- A section label is text-base/500, the row-title rung; a section is parted from its rows by space, never by a
  size of its own.
- A site never restates line-height or tracking on a rung (`leading-snug`, `tracking-[-0.01em]`) — the rung
  owns them. (Open: rows still carry `leading-snug`; a separate census decides whether the body rung's 22 or snug's 20.6 is the row.)
- Interface and Reading rungs never mix on one surface.
- iOS zooms a focused field under 16px; the ladder has no 16. One floor, fields only, coarse pointers only, and it
  sits OUTSIDE every @layer: a field's own text-sm lives in @layer utilities and beats a layered floor (measured:
  14px with the floor in @layer base). A field wears text-base or text-sm; on a coarse pointer the floor wins over
  both. `@media (pointer: coarse) { input, textarea, select { font-size: max(1em, 16px) } }`
- A page title is text-2xl, 28, on every page; hierarchy under it is the breadcrumb's job. The Decision h1 is the
  one named exception, text-3xl on purpose (`components/decision-detail.tsx`).
- `text-read*` shares the text-* namespace with colours: no `--color-read*` token is ever declared.

## Leading belongs to the rung (2026-09-04)

`text-xs` is 12/16, `text-sm` 13/18, `text-base` 15/22 (`lg` 17/24, `xl` 20/26, `2xl` 28/34, as declared in
`@theme`); **a site never writes `leading-*`** — not `snug` / `tight` / `normal` / `relaxed` / `loose` / `[n]`,
and not behind a breakpoint prefix (`max-sm:leading-snug` is the same defect). Multi-line Interface prose takes
its rung too: text that reads tight is a measure or a size decision — narrow the column, or go up one rung —
never an added leading. `leading ≥ 1.55` belongs to the Reading register alone (`text-read` 19/30), and the
registers never cross in either direction.

The single leading a site may write is **`leading-none`, and only where the box is the glyph**: a monogram, a
count pill, a format/state badge — one line centred in a fixed box. A fixed height that stands in for "one line
of text" (`h-[1.29rem]`, `h-5`) is a leading in disguise: write it as `h-(--text-base--line-height)` so it
follows the rung.

Settled by measurement, not to be re-argued: the ink gap between wrapped lines of 15px Geist is 1.14 x-heights
at 22, 1.02 at 21, 0.89 at 20 — 20 would give the body paragraph the 12px label's breath and set it tighter
than the 13/18 paragraph beneath it.

## Alpha-ink family (settled 2026-09-05; do not re-argue)

Never write an opacity modifier on `foreground`, `primary`, `muted-foreground`, `border` or `ring`. Use the named tokens below. The one allowed literal is the `confirm` variant in `ui/button.tsx` (6/10/14, settled).

**Neutral fills — `bg-tint-1/2/3` = foreground 6% / 10% / 14%, same numbers in both themes**

| Role | Token |
|---|---|
| hover on ground (row, list item, menu item, ghost icon button, sidebar item) | tint-1 |
| menu-item `:focus` (the keyboard's hover; focus-visible is the solid `--ring`, not a fill) | tint-1 |
| object at rest (chip, kbd, count pill, icon well, avatar dish) | tint-1 |
| sunk well / track (band, segmented track) | tint-1 |
| selected / open (sidebar `data-active`, `aria-expanded`, `data-popup-open`, active facet) | tint-2 |
| press on ground (row `:active`) | tint-2 |
| hover on object (chip, icon well, secondary button) | tint-2 |
| press on object (secondary button, chip `:active`) | tint-3 |
| hover on selected (an open trigger, the active sidebar item) | tint-3 |

Secondary button = tint-1 -> tint-2 -> tint-3. Sidebar hover is tint-1, not `--sidebar-accent`.

**Forest fills — `bg-wash` = primary 4%, `bg-mark` = primary 10%, confirm button = 6/10/14**

| Role | Token |
|---|---|
| provisional / proposed surface (ALWAYS with `border-line-wash`; the wash alone is invisible) | wash |
| inline added/highlight span, icon dish, status chip, Added badge | mark |
| the confirm button rest / hover / press | button variant only — never hand-restate it |
| selection of settled content, a person's editing focus, a suggestion-chip hover, a comment highlight | NOT forest — neutral tint-1/tint-2 |

**Lines**

| Role | Token |
|---|---|
| divider, rest border of a bordered control | `border` (the token) |
| edge ring of a raised surface (card, popover, menu, float) | `ring-line-edge` = foreground/10 |
| hover hairline or ring, selected-row outline | `line-hover` = foreground/20 |
| a control's own outline at rest (checkbox box, facet chip, select) | `line-stroke` = foreground/30 |
| provisional hairline (with `bg-wash`) | `line-wash` = primary/15 |
| committed outline (confirm button, chosen option, selected card ring) | `line-confirm` = primary/40 |
| selected | solid foreground or forest |
| focus-visible | solid `--ring`, never an alpha |

**Inks — three for words, one for glyphs**

| Role | Token |
|---|---|
| UI words, headings, row titles, labels on controls | `text-foreground` |
| running prose a reader reads (reader body, /a/ article, gist, summary, decision/review/version/share/profile paragraphs, search answer) | `text-foreground-prose` (solid: #3b3b38 light 9.9:1, #cdcac3 dark 10.8:1) |
| secondary words: timestamps, meta, kbd, group labels, text hints, done/pending steps | `text-muted-foreground` (no alpha, ever) |
| non-text glyphs that only reveal or dismiss: info dot, toast close, hover chevron, drag grip, dotted decoration | `text-foreground-hint` (solid: #878681 light 3.2:1, #807b6f dark 4.2:1) — never on a word |
| disabled | `disabled:opacity-50` on the whole control — not an ink |

**Stacking.** An object keeps its own token on every ground: the same class is right on the page, on a hovered row and on a selected row, because the alphas composite and a tint-1 chip already reads one rung above whatever it sits on (measured 1.12 light / 1.18 dark above a hovered row). Never raise a chip because its row changed state — only the chip's own hover or press moves it — and never add a group-hover bump to an object for its container's hover. Opaque `bg-card` objects on a row stay `bg-card`; forest objects separate by hue and `line-confirm`, not by rung.
**Written as tokens** (globals.css `@theme inline`, each with its measured contrast beside it): `bg-tint-1/2/3`,
`bg-wash`, `bg-mark`, `ring-line-edge`, `border-line-hover`, `border-line-stroke`, `border-line-wash`,
`border-line-confirm`, `text-foreground-prose`, `text-foreground-hint`, and `ring-focus` (the focus ring, 40% of
`--ring`; it was stated at /25, /40 and /50 — the ring WIDTH, ring-2 vs ring-3, is a second axis still open).
The lint `no-alpha-ink` (scripts/check-design-rules.mjs) flags any opacity modifier on foreground / primary /
muted-foreground / border / ring; it allows the data & status vocabulary (`bg-foreground/20` dots, `/30`
progress, `/40` series, the `/15` scrim) and the confirm variant in ui/button.tsx. It runs at `warn` level today.

## Agent mark (the seal, 2026-09-08, `c7599c3`)

agent 标记是 seal。forest 盘（color-mix 70% 混到底色）上挖出一条纸色波线，峰谷峰加收尾，占盘宽 70%，没有独立节点。盒子越小线越粗（2.4 / 2.9 / 3.4）。做头像时它自己就是那只盘，永远不放进另一只盘里，永远不是环。forest 底上换 tone=paper（纸盘 forest 波）。只有波动，盘不动。favicon 是 seal。（09-05 c436f95 单线字形；09-08 c7599c3 seal；agent-mark.tsx）

- **Motion never redraws the mark.** Idle: the wave breathes inside the still disc. Thinking: the wave's luminance
  pulses. Still / reduced-motion: nothing. The disc never moves.
- **Interlaced forms are dead**, not re-arguable: a crossing is the one thing a 12px glyph cannot keep open and
  the one thing the logo does not have. The "woven" statement is the logo's job, not the 12px mark's.
- Measure at DPR 1 (`DPR=1 node scripts/shot.mjs …`): the default DPR 2 draws a 12px glyph as 24 device pixels
  and flatters every candidate; the panels' 1× blow-ups changed two verdicts.

## Small numbers and trailing actions (2026-09-10)

**A small number** is Geist tabular-nums on the row's rung, right-aligned so its trailing edge is the column's
edge (the same edge the section "+", an arrow or a kbd ends on). Never inside a pill or a border on the
ground, never forest, never any hue, never revealed by hover — drawn in every state or not drawn at all. It is
one of three things, and the ink says which:

| kind | means | off a diff |
|---|---|---|
| demand | something waiting on this person (rail Inbox count, "Needs you 13") | `text-foreground font-medium tabular-nums`; hidden at 0; when the rail collapses it moves onto the icon's corner at 12px (`SidebarMenuBadge kind="demand"`) — never a dot |
| inventory | how many exist (collection sizes) | `text-muted-foreground tabular-nums`; dropped where the surface is not for it (collapsed rail) |
| fold | "+N" standing in for objects not drawn (avatar stack, collection fold) | `bg-tint-1 text-muted-foreground font-medium tabular-nums`, no ring — the one number that takes a ground, because it sits among grounded objects; OPAQUE in a stack (mixed over the page ground) because tint-1 is an alpha and a 6px overlap shows the seam |

Why the rail's count pill died: a tint-1 pill on the already-tinted rail measured 1.05:1 and rendered as
nothing but a 24px indent. Why not a dot in the collapsed rail: a dot drops the count, and the count is the
message; a dot is also status vocabulary, which is circled or coloured.

**A trailing action** (a section header's link) has one form: 13px, muted at rest, full ink on hover and
focus, flush to the column edge, ending in exactly one mark that names its verb — `<ArrowRight/>` when it
leaves the section for another page (the primitive draws it; a caller never does), the `<kbd>` when it
invokes a command. Never `›` (disclosure elsewhere in the app), never forest, never full ink at rest, and never
an accent for "something waits": the section's own count says that once. `SectionAction`'s `accent` prop is
retired (accepted and ignored until every caller is swept).

Tab-strip counts (ruled 2026-09-12): inside a SELECTION control the count wears the tab's ink — full ink on the
selected tab, muted on the rest — one rung smaller, the label's weight, tabular. Not the demand/inventory rung:
there, ink says "selected", and a demand-rung count in full ink on a muted, unselected tab outranks its own
label. `SegToggle` and `ViewTabs` both do this; a caller never colours the count.

## Grouped-list header (settled 2026-10-02)

- **Grouped-list header = a label on a hairline** (fork 3, reverses 09-12's band): 12/500 muted label, bare
  count, 1px line-edge rule, label on the rows' mark edge. No fill.

The 2026-09-12 tint-2 band is reversed: five of seven blind judges read a stack of grey slabs. From the comment on
`FeedHead` in `components/inbox-agent-band.tsx`: 24px of air above the label from the previous group's closing
hairline, 8 below, then ONE hairline under it in line-edge. That rule is the first row's top line, so that row's own
divider is switched off. What the 09-12 panel settled and stays: the count is a bare tabular number, never a pill,
its weight by kind (demand 500 full ink, inventory 400 muted); a state phrase may sit in the count's slot instead,
parted by a vertical hairline; an identity swatch may lead the label. `flush` is for a list whose rows sit on the
column's own edges (the Team list). The label starts where the rows' marks start.

**A washed row is by definition a row**: its wash sits on its own box, inset and radius sm, its well
one rung up; nothing that labels ever sits on a wash.

## Responsiveness (2026-09-12) — three rules measured off a 9-route × 4-width sweep

1. **Prose flows; only objects are flex items.** A sentence is one text run; an icon inside it is inline
   (`inline-block align-[-2px]`), never a flex sibling with a gap. `inline-flex gap-*` is for a label+glyph pair
   that never wraps. (The LearnPrompt's "becomes [X], a responsibility in Governance" wrapped as two blocks.)
2. **A marker sits on the first lines, not the row's centre.** A row with a leading well/avatar/swatch beside
   text that can wrap is `items-start` with a slot as tall as the lines the marker belongs to (one body line
   for a single-line row, `h-9` for a title+meta pair); `items-center` floated the well 23px down a three-line
   row at 390.
3. **Truncate only what has a fuller form one click away.** A row title that opens the document may truncate;
   a fact that exists only here — a page h1, the agent band's summary, a rule's provenance, a lit row's
   instruction — wraps. On a phone the actions row drops under the title (`max-sm:flex-wrap`) instead of
   squeezing it.

## Confidence at rest (2026-09-12)

An agent proposal's confidence is a WORD at rest, and only when the word earns its ink: high (≥0.8) renders
nothing (sr-only "High confidence"); likely (≥0.6) "Likely" 13/400 muted; unsure (<0.6) "Unsure" 13/500 full
ink (a demand on attention wears demand ink). Never a meter or bars (a phone's signal glyph — borrowed; and at
15×10px the lit bars measured 2.79:1, the unlit 1.35:1), never a circled mark (status), never a hue (identity),
never forest. The exact % lives only in the hover, phrased in the same words ("Likely, a quick look is worth it,
68%"). Position: the title line's trailing cluster, one 16px gutter from what follows; never inside the Confirm /
Dismiss cluster. `components/confidence.tsx` (`ConfidenceWord`).

## Dialog with a list in it (2026-09-12) — the /team review panel

Measured off the DOM and rebuilt; the rules that fell out apply to any overlay that holds a list:

- **The house Dialog, never a hand-rolled fixed div.** The hand-rolled one drew its scrim in `foreground/15`,
  which LIGHTENS charcoal (foreground is light in dark), trapped no focus, took no Escape of its own and had no
  accessible name. `DialogContent` brings the black/30 scrim, focus, Escape and the label; the panel passes
  `showCloseButton={false}` when its header owns the close.
- **A dialog whose height depends on its tab is anchored at the top (`top-[10vh] translate-y-0`), not centred.**
  Centred, a 730px tab and a 180px tab re-centre on every switch — the header moved 276px on a click that should
  move nothing. Top-anchored, only the bottom edge moves. Never pad the short tab out with a min-height.
- **One text edge across every tab.** A grouped list's rows hang under the group's TEXT, not under its mark:
  `pl-5` = the mark (size-3) + its gap-2, so a title at 41 has rows at 41 and rationale at 41. A second tab's
  rows wear the same mark + gap and land on the same edge. The old panel had titles at 41 and rows at 21.
- **The call sits on the phrase's line; the reason belongs to the row.** A row is
  `grid grid-cols-[minmax(0,1fr)_auto]`: phrase in column 1, the word + ✓ ✕ cluster in column 2 inside a slot
  one line tall (`h-(--text-sm--line-height)`, `items-center`), the rationale `col-span-2` beneath. As a
  flex row the cluster reserved its column for the row's full height and the rationale wrapped at half width
  beside 125px of nothing; and `mt-0.5` + a 24px button in an 18px line put the ✓ 5.5px under the line's
  centre. Measured after: 0.5px.
- **A marked name in running text is prose, and the mark is welded to the first word.** A line may break on
  either side of an atomic inline, so `[mark][name]` as two flex items let a phone end one line with the mark
  and start the next with the name. `MarkedName` (`app/(app)/team/page.tsx`): a `whitespace-nowrap` span around the inline-block mark +
  the first word; the rest of the name flows. (Responsiveness rule 1, applied to a name.)
- **The reason line is text-sm.** The rationale is the sentence the reader decides on, not a caption; it wears
  the rung the Inbox's rationale line wears. (It was text-xs.)
- **A header action is a control on a shadcn size.** "Verify on the map" was a 127×18 bare text button with no
  hover ground; now `Button variant="ghost" size="sm"` (28px, the close button's height), muted → ink. On a
  phone the header wraps: the switch takes the first line, the actions the second, kept at the right edge by
  `ml-auto` so the close never lands mid-row. The group title wraps rather than truncates — nothing in the
  panel offers its fuller form one click away.
- **A row's state is the trailing word, its mark is its identity.** The Out-of-date rows carried a 6px dot
  coloured by state — node-shaped, so a mark whose hue meant something other than identity, in a hand-written
  alpha. Now the artifact's own `NodeMark`, and "review" (warn) / "superseded" (muted) as the 13px trailing word.

## The collection rail and its list (2026-09-14) — drawn per row, never measured

Settled by a blind Fable panel (5 lenses → 47 claims → 94 skeptics → one spec), built by Opus, re-measured by a
Fable auditor, 3/3 Fable judges for the after. Verdict on the rail: keep-fix (2 keep-fix · 2 redesign · 1 remove;
remove needs three).

- **An in-list rail is a real first cell, drawn per row from the row's INDEX.** Each member row owns a 40px cell
  (`hidden w-10 md:block`) holding one SVG; what it draws is decided by where the row sits in its trunk (first /
  through / last / stranger), never by measuring row centres. No `getBoundingClientRect`, no `ResizeObserver`, no
  state for a number the index already knows: the rest rail is in the server HTML, a reorder reflows, a hover
  re-renders the row, not the page. The indent dies with the column — below md there is no cell and no `pl-12`.
- **The bracket is one line over its whole span.** A stranger row inside the span carries the lane straight
  through (no tick, no node) the way tree(1)'s │ runs past a non-child. The panel's first rule — break the
  bracket around a stranger — drew a reordered member as an orphan └■ tied to nothing; three judges caught it.
- **A tie is one path from the lane to the node.** Through row: a 13.5px tick (lane at 16.5, node edge at 30).
  End row: curl + tick as ONE path, so a proposed tie dashes its curl too and a 3-3 dash gets three periods. At
  20.5 the tick was 9.5px / 4.5px after the curl — the provenance mark was a speck at 1x.
- **Inks by token, strokes on the half pixel; at rest the whole drawing is ONE ink.** Spine, verified tick and
  node all `--foreground-hint` (Kyle, 2026-09-14: nodes in `--muted-foreground` made four dark squares the
  heaviest objects in the list — "too solid"; weight arrives only with the hue on hover); proposed tie `--primary` dashed 3-3 at full strength (3.4:1 → 7.5:1); the collection hue
  only on lit pieces. 1px on x.5 fills one device column at DPR 1. No opacity attribute in the file. Motion is
  `.weave-ease` / `.weave-node` in globals.css with a reduced-motion guard — never `transition: all` inline.
- **The hover says only true things, and nothing recedes.** Hub lit → the whole trunk in hue; member lit → the
  hub-to-member span only, that member's tick and the hub's; a proposed tie stays forest dashed in every state.
  Rows outside the lit span keep their rest ink — dimming them read as disabled. Focus lights the same drawing.
- **The focus ring is the row's, inset.** On the link it enclosed the text column and ran through the node.
- **No column header on the Contents list** (Kyle, 2026-09-14, `8854776`; overrides the panel's "keep"). The
  four trailing values name themselves — faces, a globe with its title, a relative time — and the list is
  the house's open list, its first row flush under the tabs. (If a column header ever returns anywhere, its
  register is 12/500 muted, set apart from 12/400 meta by weight, not size.)
- **Row hairlines start at the text column, not the rail's edge.** Full-width they crossed the spine at every
  row — a horizontal rule through a vertical line. Inset by the rail cell's 40px at md+ (`md:[&>*+*]:before:left-10`
  on the DIVIDED_FLUSH container); the closing rule stays full width; below md there is no cell to clear.
- **A row's state is a word, not a ring.** The freshness ring → `StatusPill` ("Source changed 2d ago"). Line 1 =
  title + ONE trailing cluster (type, state), `items-start`, the cluster wraps under the title below sm.
- **The gist is text-sm** (the Library's rung). The globe inherits its cell's ink (no `opacity-60`). The ⋯ is at
  rest on a phone and on focus-within; Move up / Move down give reorder a touch and keyboard path.
- Held through the panel: the header row; the bracket with 5px curls; empty cells stay empty; the globe stays in
  its column; the uppercase type code; the 8×8 rx2 node; the ⋯ and grip in the margins at md+; the tie's
  provenance on the LINE (never a dashed node outline).

## The capture flow (2026-09-14) — one field, one verb, a named row

Settled by Kyle after an eight-round blind judge loop: round 1's sheet, round 8's launcher. Shipped `a5c7211`
in `components/capture-flow.tsx`.

- **The way in shares the search well's row: a compact INK-FILLED box at the well's right** (Kyle, after
  Attio's rail; `cbb7589`). `+` and its key `N` in an on-ink keycap, `bg-foreground / text-background` (the
  tooltip's inverted material — oat on charcoal), hover on `bg-foreground-prose`; the word "Capture" lives in
  the tooltip and the accessible name. Not forest — it opens and writes nothing — and not a split button: a
  split joins the variants of ONE action, and find/ask and add are two jobs. The box is 50px so the well
  keeps the 166px "Search or ask ⌘K" needs at 13px. (Rounds 4–8's full-width "+ Capture N" row was the
  intermediate; it cost the rail a row.)
- **One inferring field.** No type chooser: the field reads what it was given — a Loom share, a GitHub PR
  or commit, any other address a reference; files by drop or the paperclip. Seven zones (title,
  description, four-way tabs, a dashed drop-zone, a divider, a queue header, a dashed empty state) were a
  form assembled from templates.
- **Nothing explains itself before it is needed.** Snapshot-vs-reference is the row's one muted word;
  format and size limits appear only when a file is refused; there is no empty state — before the first
  row the sheet is the title and the field.
- **Rows on hairlines; a footer only once there is a row.** Cancel (ghost) and one SOLID commit carrying
  the count: `Capture 1 artifact` / `Capture 3 artifacts`. Never an arrow on the commit.
- **One verb.** The row, the sheet's title and the commit all say Capture; the accessible name keeps the
  noun (`Capture, new artifact`). `N` opens the flow from anywhere outside a field or a dialog.
- **Capture is a sheet, not a rail region.** Tried for six rounds; in a 224px rail a title truncates at
  twelve characters and the queue shoves the nav. The house Dialog, centred, as before.
- Kept from the loop, app-wide: a tooltip is a LABEL — ink fill, text-xs, no arrow, a keycap slot
  (`IconButton shortcut`); the sidebar group label wears `text-muted-foreground` on a 24px line (was a
  hand-written alpha on a 32px row). The dialog scrim stays the house black/30.
- Method note: an absolute-score loop with a memoryless judge cannot settle a structural fork (where
  capture lives); it re-decides the fork every round and pins at ~6. Fix the fork first, then loop.

## The people stack opens (2026-09-14) — `4930de0`

A row's people stack (faces + "+N") is a HOVER PEEK, not a tooltip: the whole stack is the trigger (the
house `Popover openOnHover delay=160`, rendered as a span so it can sit inside a row link; tap and Enter
open it too). The card lists every person on that artifact, one open row per person on hairlines, no
header: avatar · name 13/500 · the time of their latest action here (12/400 muted, tabular) · the action
as the story strip narrates it (the newest Episode with that actor on this artifact), or the relation
("Authored" from author_id or an authored_by edge, else "Mentioned in this artifact"). Activity first,
newest first (same minute → the later entry), then the stack's order. Rows link to `/people?focus=<id>`.
`PeopleStack` takes an optional `artifactId`; without it the card lists names and roles. The stack's
native title is gone — one hover, one answer.

## The explorer pages (2026-09-14) — one shell for /team, /topics, /people

Nine blind judge rounds on the Topics controls (5 → 6.5 → 6), then Kyle's unification (`68df1bd`). Rules:

- **One shell.** Eyebrow = the section (PageBreadcrumb, 12 muted, a link) → ONE h1 (28/500) = the subject's
  mark + name → ViewTabs List / Graph / Timeline → the view
  on the page ground. No PageHeading, no ⓘ, no hint sentence, no graph legend on these pages.
- **Three questions, three registers.** WHICH SUBJECT = the title (the name is the switcher: chevron, hover
  tint on the name, the picker drops from the name with each subject's mark, count and a tick on the
  current). WHICH VIEW = the underlined tabs. HOW DEEP = **not a setting** (Kyle, `975e317`): reach grows
  from the graph. A first-ring node with further ties wears the house fold chip "+N" beside its name (tint-1,
  muted 500, the people stack's and collection tag's own object); hover or focus the chip → that hub's ring
  ghosts in, one grey; click → it unfolds in place, the chip reads "−"; several open at once; the peek offers
  "Show N more" / "Hide N" in the same ghost register; the list mirrors it with a fold row per hub and ONE
  expanded set shared with the graph. Names are seated against the FULL field (every node the layout knows,
  drawn or not) so nothing moves when a hub unfolds; the chip takes the name's free end and dodges a live tie
  when the other end is clear; it is an HTML button over the drawing (house ring, Enter/Space, 24px hit).
  The tab row's trailing slot is empty on all three pages. (The Direct/Nearby SegToggle lived one day.)
- **A control exists only where its data does.** Team has one workspace → no chevron; the space has no
  second ring → no depth switch. Symmetry is not a reason to draw a dead control.
- **Team's views.** Graph = the space field; List = People / Collections / Artifacts under FeedHead labels
  (the label counts its rows); Timeline = the space's recent episodes. The stat line is gone; the bell is the
  h1 line's trailing action with an INK-FILLED count (`bg-foreground text-background`) — a demand, not forest.
- **Names from data keep their words; the workspace name drops its middle dot in the UI** ("Acme Product").
- **Method (the third pin at ~6).** A memoryless absolute judge re-decides a structural fork every round; six
  judges agreeing is a decision, one judge flipping it back is noise. Fix the fork (owner or the product's
  own grammar), then loop on execution — and stop when the hinge oscillates.
- Open: the graph's vocabulary key (removed with the ⓘ; a hover key in the field's corner if it is missed);
  "61 connections" has no home; two hidden artifacts (archived, other space) are outside the List's 11; a
  first-ring node whose further ties all belong to other hubs' sectors wears no chip (Q4 OKRs on /people);
  an unfolded ring can run past the viewport on a phone (no pan); Team's field draws leaves without folds.

## The evolve pass (2026-10-02) — what the whole-product verdict changed

Verdict: `docs/design/verdict-2026-10-02.md` (7/7 evolve, mean 6.4; anchor Are.na). Kyle took all six forks as
recommended. Commits `706e829` `da6b780` `aa3dd8e` `c004fc6` `8619598`.

- **Grouped-list header = a label on a hairline** (fork 3, reverses 09-12's band): 12/500 muted label, bare
  count, 1px line-edge rule, label on the rows' mark edge. No fill.
- **The agent is credited once per surface** (the AgentBand byline); rows lead with the NodeMark of their
  subject, never the agent's seal as a bullet.
- **No ⓘ and no hint sentence on any page header.**
- **A rule printed under a list goes into the count's hover** (fork 4; `Section countHint`), still generated
  from the table that sorts it. Agent prose: one fact per sentence, numbers in full ink, ≤75ch, text-pretty.
- **Graph amplitude** (problem 1): confirmed 1.5px; heavy evidence 2.5px at a threshold of 3, from the data's
  own count (shared artifacts on the space field; elsewhere the confirmed ties joining the same two nodes) — the line axis now carries provenance (style) AND
  evidence (weight), fork 2; proposed 1.5px dashed 4/4 full forest; names 13px; glyph narrowest span ≥8px;
  a hub's unfold is the in-place fan with a wide-fan rule (≥8 names: whole sector, need-based step, sides before
  corners); the fold count is the house chip; Team ties wear their collection's hue; every field has one
  textless hover key, no ⓘ, no card.
- **The confirm weld** — the one signature motion: a confirmed proposed tie's dash closes in 240ms ease-out
  while the review row's words go muted → ink; reduced motion = no animation; never the agent glyph.
- **Dark**: sidebar one rung deeper than the canvas (1.09:1, no divider); dark confirm/outline buttons step up.
- **Public artifact page**: eyebrow over title, hairline metadata band, no card, publisher monogram, no dots.

## The cover (current: the window cloth, 2026-10-07, `5369ae4`)

Kyle called the hub-and-ring "really ugly" on 2026-10-03; no hub, spokes, sunburst or node-link icon on a cover again.
The constellation, the contents page and the banded cloth were each replaced in turn. The history is in
`docs/design/brand-iteration.md`.

The cover is a window onto the document's own cloth at a fixed sett: an end about 8px wide with a 1px seam. A bigger
box shows more cloth and never a bigger thread. Warp stripes are sections, width by word count. The yarn is the hue
of the collection the card's chip leads with, undyed if unfiled. A plain-weave ground weft appears once the document
has any confirmed link. The two strongest links float in the neighbour's hue. A document with no links is the warp
alone. Proposed links, restricted neighbours and words are never drawn.

Library card: the band in its 3:1 head. Continue hero from sm: a swatch of the band's box (230 by 75.66) on a tint-1
mat, never the cloth filling the panel (Kyle: "too much"). Phone hero: the full strip.

Reading is in `components/cover-read.ts`, weaving in `components/cover-cloth.ts`, layout in
`components/neighbourhood-cover.tsx`. Their header comments are the spec.

A cover that lays itself out from a measured box must still paint on the server: until the box is known, set the page for the box the caller usually gives it, and hide a guess at the widths where its mode would be wrong (658f5fb, 3d7538a). Check a deployed cold load, not the dev server: locally the gap is invisible.
