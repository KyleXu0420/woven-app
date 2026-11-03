# Recipes

> What this is: how to make a common change without breaking the grammar, moved out of `AGENTS.md` on 2026-11-03 and corrected against the code at `84a4bb8`.
> Status: live reference. When a recipe and the code disagree, the code wins.

- **Add a page** → `app/(app)/<name>/page.tsx`; wrap the body in `PAGE_FRAME` (`lib/frame.ts`); one
  `text-2xl` h1 (eyebrow `PageBreadcrumb` on a detail page), no ⓘ, no hint sentence; read data
  through `lib/api.ts` (never inline arrays); add the nav item in `components/app-sidebar.tsx`. Public/
  full-bleed pages go OUTSIDE `(app)/`.
- **Add data / an accessor** → extend the shape in `lib/types.ts`, seed it in `lib/data.ts`, expose a
  reader/mutator in `lib/api.ts`. A mutator ends with `bumpGraph()`, and calls the private `persistState()` only if it
  changes the persisted slice (see the mutation contract in `docs/reference/domain-model.md`). Components call the
  accessor + `useGraphVersion()`.
- **Add a read accessor** → start from a reader that already gates on the viewer. For artifacts, filter
  `listArtifacts(undefined, viewer)`. For anything else, apply `canView(id, viewer)` yourself. Take `viewer = VIEWER` as the
  parameter, as `listClaims` and `decisionRecord` do. A read neither persists nor bumps. Name it for what its source holds
  (see Time and recency in `docs/reference/domain-model.md`).
- **Add a shared UI element** → check `docs/reference/components.md` first (SegToggle, IconButton, Valve, DIVIDED, Row, FeedHead,
  NodeMark, TypeBadge, PersonAvatar…). Only hand-roll if none fit, and make it a *named* exception in that file.
- **Change a design token** → edit the `:root` **and** `.dark` value in `app/globals.css` (both themes);
  never inline a hex in a component, use the utility. A new translucent ink joins the alpha family in
  `@theme inline` with its measured contrast beside it, never as a site's `/NN`. Restart the dev server after
  an `@theme` edit.
- **Draw a list of things** → open rows on `DIVIDED_FLUSH` (or `DIVIDED` inside a surface), each led by the
  subject's `NodeMark`, a `FeedHead` per group, state only on exception, a trailing cluster that wraps on a
  phone.
- **Add an edge type / graph concept** → add to `EdgeType` in `lib/types.ts`, seed edges in `lib/data.ts`,
  resolve it in the relevant `lib/api.ts` graph accessor; render dashed while `ai_generated`, solid once
  `human_verified`; route the proposal through the Verify queue (`listPending`/`verifyEdge`) — nothing
  enters as fact without the human confirm, and the confirm records an `Episode`.
- **Wire an agent action** → it proposes (`ai_generated`), never commits; surface it in the Inbox valve
  (`Valve`/`ChoiceValve`) or the reader Suggestions rail; confirming calls `verifyEdge`/the matching
  resolver, which also `recordEpisode`s, and the row and its tie weld. Autonomy only if a trusted `LearnedRule` covers it (mode `auto`,
  above `AUTO_CONFIRM_FLOOR = 0.7`).
- **Ingest evidence** → preserve the external `Source`, capture an immutable `ArtifactVersion`, then create
  `EvidenceRef`s to exact version/block/timecode/external-state locators. Never make a ref follow `latest`,
  and never treat the Reader's `EvidenceItem` view-model as the canonical record. For the B3 UI, build
  validated `CaptureInput`s with `lib/capture-ingest.ts` and await `ingestEvidenceBundle()` once. It persists and bumps
  itself, so the UI does neither. `reference_only` means **no EvidenceRef**; never turn reachability of a URL into a
  claim that its content was captured. The mutation derives SHA-256 and Blocks from raw; callers do not
  supply either derivative as proof of the stored payload.
- **Propose a Claim / Decision** → create the smallest citable `Claim` over exact refs. Specialize it as a
  `Decision` only when authority, driver, scope, and a falsifiable activation condition exist; the extraction
  enters provisional and must be verified before authorization is possible.
- **Assemble a ReviewPacket** → derive it from current evidence, Claims, Decision records, open questions,
  and diffs. Do not persist a parallel truth or force users to create a Work Thread object merely to review.
  Surface it only in focused Inbox; order it as conclusion/current truth → Activation condition → reducer-
  selected exact Activation proof → Decision evidence + affected Claims → chronological trust history →
  lifecycle call. Detail recalls the durable Decision and must not embed/self-link the packet.
- **Authorize a Decision** → call `approveDecision` only as the scoped authority. Approval requires verified
  extraction, current exact refs, and a complete Decision contract; record a separate `approved` Episode.
- **Observe / confirm Activation** → connectors or agents call `recordActivationEvidence`; the mutation
  requires a current, visible, captured exact ref and always constructs `ai_generated`/agent trust regardless
  of stale caller fields. Show the exact downstream revision in Review. Authority confirmation/dismissal
  (`confirmActivationEvidence(id,'confirm'|'dismiss')`) appends an `ActivationDispositionEvent`; confirmation also records `activated`, and the read model projects
  the observation as `human_verified` without rewriting/deleting it. First compare the candidate to the Decision's exact
  `activation_condition`; block confirmation on unknown/partial/contradicted satisfaction. Manual input must
  cite an existing exact `EvidenceRef`, capture expected versus actual, and retain a revision mapping; it
  creates a candidate, never a direct “Mark active.” Source semantics are enforced: GitHub only proves a
  code change, and Loom/transcript/meeting/link cannot prove Activation. A PR/commit/merge is
  always a candidate first and cannot prove a production/user-visible condition without matching
  deploy/config/render/test or other observable product-state evidence. A task, owner, date, or explanation
  is not activation.
- **Revalidate / supersede** → a changed ref raises `needs_revalidation`; the authority may renew only when
  no cited ref is superseded **and** the caller supplies current exact refs to a genuinely new immutable
  version. `revalidateDecision(..., replacementEvidenceRefIds)` records the old→new mapping; with no new
  snapshot it returns `undefined`. Never clone a changed ref against the old version or mutate a shared ref back
  to current. If the old Decision is replaced, link `superseded_by` and preserve its old refs, Approval,
  ActivationEvidence, and Episodes for recall. Today no UI path reaches a renewal, and nothing in `lib/` or `components/`
  writes `superseded_by` or a `superseded` RevalidationEvent result. Read the defect note in `docs/roadmap.md` first.
- **Answer current truth** → resolve the latest non-superseded Claim/Decision the viewer can access, state its
  lifecycle honestly, cite exact refs and activation evidence, and include why it changed. Abstain on missing
  permission, evidence, or authority instead of manufacturing continuity.
- **Wire the review spine** → Today links `/inbox?decision=<id>`; Inbox owns lifecycle mutations and derives
  one packet; packet/Search/Reader exits use `/decision/<id>`; `openSearch(...,{kind:"decision",id,title})`
  locks Ask to that Decision. Keep the same id and `decisionTruth()` across every surface.
- **Produce a product map / flow diagram** → default to a self-contained HTML artifact plus an editable
  SVG export in the task output folder; preserve selectable text and real vector geometry. Only create a
  Figma version when Kyle explicitly requests one.
- **Run an autonomous product batch** → take the live work in `docs/roadmap.md`; read the locked decisions in
  `docs/reference/decision-log.md` and the matching reference file first; state assumptions once at the batch boundary;
  make reversible UX/code choices without asking; update the docs when knowledge changes; implement and verify the
  complete vertical slice. Stop only at the escalation boundaries in `AGENTS.md`, not for routine option-picking.
- **Before committing** → run the gates in `AGENTS.md` in order, browser-verify the exact surface, then commit in the
  house shape. Push only when the change is done and verified, or the owner asks. A push to `main` deploys production.
