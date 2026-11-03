# ReviewPacket design QA

- Source visual truth: `/tmp/woven-review-packet-audit/01-before-review-packet.png`
- Implementation screenshot: `/tmp/woven-review-packet-audit/05-final-review-packet.png`
- Responsive evidence: `/tmp/woven-review-packet-audit/04-after-review-packet-390-full.png`
- Route and state: `http://localhost:4322/inbox?decision=de_cadence`, focused `needs_revalidation` packet, light theme
- Desktop viewport: 1920 × 815 CSS px at DPR 2; source and implementation were captured from the same browser, viewport, route, state, and density.
- Narrow viewport: 390 × 844 requested; browser content width measured 375 CSS px at DPR 2. No horizontal overflow (`scrollWidth === clientWidth`).

## Full-view comparison evidence

The source exposed four equally weighted record buckets after a duplicated state summary. The final capture replaces that flat 2×2 grid with one causal reading path: current truth → changed exact source and affected Claim → Decision terms → chronological history → lifecycle call. The primary judgment now follows the evidence, while stable Decision and Ask exits remain tertiary.

## Focused-region comparison evidence

The ReviewPacket itself was legible at the full desktop capture and separately inspected at 390px. The narrow capture confirms the same DOM/visual order without clipping or horizontal scrolling. Exact source and affected Claim remain one bounded change region; Decision terms and history reflow beneath it; all three footer actions remain visible.

## Required fidelity surfaces

- Fonts and typography: preserves the app's existing Geist stack and scale. Real headings now establish section hierarchy; small uppercase labels are reserved for axis/category scanning.
- Spacing and layout rhythm: removes the four-way equal grid, groups cause and impact, and uses one consistent 16–20px section rhythm. Desktop uses primary/supporting proportions; narrow mode follows semantic DOM order.
- Colors and tokens: uses existing `secondary`, `border`, `primary`, and `warn` tokens only. Changed state remains text-labelled and is not conveyed by ochre alone.
- Image quality and assets: no raster imagery is present in the target component. Existing Lucide icons are retained; no substitute CSS, div, or handcrafted SVG art was introduced.
- Copy and content: removes implementation-facing “derived now,” adds state-specific brief labels, renames record categories into task language (`What changed`, `Decision terms`, `What happened`, `Your call`).
- Interaction and accessibility: close/reopen was exercised; collapsed `Review packet` exposes `aria-expanded=false` and `aria-controls=review-packet-de_cadence`; packet sections use labelled regions/headings; history uses an ordered list; exact evidence retains keyboard focus treatment and a practical minimum height. Revalidation, Activation, and Approval briefs were each opened: their state-specific headings, evidence-first order, and `Still current` / `Confirm activation` / `Approve` footer actions all resolved correctly.

## Comparison history

- P1 found in source: evidence, Claim impact, Decision contract, and trust events had equal visual weight, forcing the reviewer to reconstruct causality. Fixed by the causal reading sequence and grouped change region. Post-fix desktop and narrow captures show the new order.
- P1 found in source: `Still current` appeared before the evidence being judged. Fixed by moving lifecycle actions into the packet footer under `Your call`. Post-fix interaction check confirms the action remains visible and functional.
- P2 found in source: lifecycle state, people, and action chrome repeated between the row and expanded packet. Fixed by reducing the expanded parent row to identity + state and letting the packet own the context. Post-fix capture shows no duplicate summary or top action.
- P2 found during implementation: the packet toggle had no expanded relationship. Fixed by extending shared `ChoiceValve` with optional `ariaExpanded`/`ariaControls`; close/reopen behavior and attributes were verified.

## Findings

No actionable P0/P1/P2 visual or interaction findings remain for this bounded component. Browser console error/warning check returned none. Production build, typecheck, changed-file lint, and `git diff --check` pass.

## Follow-up polish

- P3: a later content pass could shorten the current-truth paragraph once real connector evidence replaces the dense seeded explanation.

final result: passed
