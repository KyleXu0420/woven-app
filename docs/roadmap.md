# Woven roadmap

> What this is: the one roadmap. It carries Codex's 2026-08-09 product-completion bar, operational layer and global action plan whole, the batches B0 to B6, and the open list, with status checked against `84a4bb8` on 2026-11-03.
> Status: live reference. Update the status cells in the same commit as the work. The 2026-08-09 text as it stood is kept in `docs/archive/AGENTS-main-2026-08-09.md`.

## How to read this

- **Batches B0 to B6 set the order and the product direction.** The action IDs F0 to C2 are the acceptance contract, so they say what done means. Most of what shipped since 2026-08-09 is decision-continuity work (B1 to B3) and visual convergence, which barely touched F0.
- **The 2026-08-09 text predates the vNext pivot.** It says "individual-contributor wedge" and the north star Drop → Weave → Verify → Read/Ask → Publish → Learn. Read those under the current definition in `AGENTS.md`: the work owner, and the wedge review → authorization → activation → revalidation → recall. Its 2026-08-09 phase table is superseded and stays in the archive.
- **Two lists use the label P0.** The IDs P0.1 to P0.7, P1.x and P2.x below are plan phases. Bug priorities are called Fix 1 to Fix 3 here, with the detail in `docs/history/open-fixes.md`.
- **Scoreboard at `84a4bb8`:** 34 action IDs, 0 done, 17 partial, 17 not started. No item has ever been marked done. B1 and B2 closed against their own rubrics with changed-file lint.

## Open list, in order

This order is a recommendation from the 2026-11-03 audit. The owner can change it.

1. **Fix the main-journey bugs — complete, 2026-11-03.** All five seed Decisions render; unavailable activation proof stays unverified. Unknown collection slugs show a shared missing state after local hydration (HTTP 200), while valid local collections survive reload. Not-found, restricted and error states share working return/retry actions. See [Step 1 verification](history/2026-11-03-step-1-verification.md) and `docs/history/open-fixes.md`.
2. **Finish the close-out left by the two-line split.** Delete `components/graph-ask.tsx` and `components/publish-dialog.tsx`, the unused `CatchUp` export (keep `EPISODE_LABEL`), `DropButton`, `coverSeed` and the `hint` prop of `PageHeading`. Check whether `awayDigest` has any other caller. Remove the dead `public/` scaffold and the Droploft assets in `public/brand/` if unused. Update the code comments that still mention line A or line B. Move the design-lint rules still at `warn` to a counted ratchet or to `error`, migrating or baselining the remaining sites first so the build stays green. Update the stale title in `app/layout.tsx`.
3. **Lock the gate before more product work,** because a push to `main` deploys production with no CI. Add a `test` script, pin the Node version, add CI running tsc, tests, design rules, lint and build, and clear the 35 ESLint errors with real fixes and no weakened rules. Do this as its own commit series. The React Compiler errors in `components/artifact-reader.tsx` and `components/story-strip.tsx` are real.
4. **Fix the number root (F0.8, first slice).** Make `needsYou()` the Attention list so `needsYou().length === inboxBadgeCount()`, add `at`, `blocks` and `run` to `NeedItem`, move sort to one rule, delete the local derivation in `lib/home.ts`, and change the Activity tab to `needsYouRunCount`. Add contract tests with a second viewer.
5. **Remove fake success (F0.9 control inventory, P0.7, Operational rule 6).** Inventory visible controls and wire, label as preview, or remove each: SaveStatus "All changes saved", Nudge, capability and decision-point switches, collection publish toggle-off, "will retry", "read-tracked", hard-coded woven.dev URLs, Hub views and Readers, the bulk Archive toast, "soon" menus. The owner decides the Settings question: minimal real Settings or an identity-only menu.
6. **Clear the small truth and copy backlog** alongside step 5: items 8 to 12 and the items found on 2026-11-03 in `docs/history/open-fixes.md`, the remaining middle dots in `lib/api.ts`, and ⌘K sharing the Home selectors. Move `trustActivity` and seed time onto one seeded clock.
7. **Finish B3 NEXT:** browser coverage for File, Link and Loom success, exact HTML/SVG interaction and blocked navigation, activation candidate confirm and dismiss plus reload, Library live update, representative failures. Record the verification note.
8. **Build the shared-truth core inside the narrowest vertical slice.** CommandContext and an injected Clock (F0.1), typed results and error states for verify, approve, merge and capture-review (F0.2, F0.3), AuditEventV1 with compensating Undo (F0.6). This fixes the stale confirmed episode, stubbed capture-review effects and approvals lost on reload. Then route Reader edits through a canonical versioned command with real save states (P0.3).
9. **Flip authorization to deny-by-default (F0.4).** Unknown membership denies in `canView`, viewer is threaded through every graph, people, topic, collection and export accessor, and a Theo-versus-Maya regression suite covers direct URL, search, Ask citation, graph hop, collection, export and public hub. Fix collection candidate filtering (P1.6). Do this before any more team-facing Ask.
10. **Complete the B3 proof.** Connect one immutable deployment, config or product-state observation and run one prospective dogfood episode end to end. The owner picks the episode and source.
11. **Run one blind absolute-score checkpoint** after steps 1 to 6. A mean of 7.5 or above stops visual iteration. Around 6.5 reopens the redo question. Carry the remaining craft inside slices: backlog items 16 to 20, the `Checkbox` and `EmptyState` primitives, ring-2 versus ring-3 (37 versus 9 sites), the two remaining dark-sink sites, SegToggle contrast, Explorer tails, the phone people peek.
12. **Only after a real episode proves value, start B4,** then B5 evals, then the P1 projections and VS.3, then the P2 shell and VS.4. C2 and B6 stay gated on a validated buyer and a proven loop.

The Woven landing site is a separate repo, unreleased, on the owner's machine. It is out of scope here. Do not infer anything about it.

**Owner-only forks:** cover maturity direction; `--warn` versus `--chart-2` (same `#b8863b`); merging the 12 hand-copied collection swatches into a `CollectionSwatch`; the favicon pair; the unratified 2026-10-02 calls (Story avatars, figure bars, Library phone bulk select); the Settings question; which real episode and source B3 uses; the design-rule debts in `docs/reference/design-system.md` (TrendChart gradient, Sparkles sites, icon scale, mono keycap). The 2026-09-02 review said the publishing and analytics claims must go before any publication, so confirm whether that still applies.

## Known live defects

Read these before touching the paths they name.

- **Inbox revalidation has no reachable success path.** The revalidate row offers only the packet toggle, so no action ever emits `keep`, and the `choice === "keep"` branch at `components/inbox-queue.tsx:669-672` is dead. That branch would also call `revalidateDecision` with no refs, which always fails. Capture always mints a new artifact id (`lib/api.ts:565`), so the same-artifact lineage check at `lib/api.ts:1255-1270` can never match. The mutator returns `undefined`. Nothing in `lib/` or `components/` writes `superseded_by`, and RevalidationEvent result `superseded` is never written.
- **`/decision/[id]` does not hydrate.** `StoreHydrator` mounts only in the `(app)` layout; `hydrateState` is also called by the collection resolver, `ArtifactPageClient` and `/c`. A hard reload or direct open of a Decision shows seed state without local candidates or dispositions, while `/inbox` shows them. This comes from reading the code, so reproduce it before fixing.
- **Generic Ask is unfiltered.** `askGraph`, `nodeRelations` and `getNeighborhood` take no viewer. `lib/export.ts` has no viewer check.
- **Direct API coverage is still narrow.** Step 1 adds Decision projection/truth/Ask and strict collection resolution, including local collection creation and recovery. Most mutators still lack direct tests.

## Batches B0 to B6

**Approved product baseline:** trusted operational memory, work-owner situational actor,
`review → authorization → activation → revalidation → recall` wedge, versioned evidence + Claims as
canonical center, Decision as the authority-bearing Claim, ReviewPacket as derived work surface,
Home/Review primary entry, Evidence substrate, Ask long-term return, GitHub + files/links + Loom import
first, no recorder/project-management/analytics/observability expansion, product proof before any external narrative.

**B3 is the live batch. Its remaining work is under B3 NEXT below. Finish a batch's model, surface, verification and docs before moving on.**

| Batch | Bounded vertical outcome | Status |
|---|---|---|
| **B0** | Category, actor, wedge, boundaries, domain invariants, and autonomous collaboration model | **LOCKED** |
| **B1** | Rebuild one **representative continuity fixture** in mock data (Notification Strategy standing in for the earlier HTML/SVG + Loom + PR episode): ArtifactVersion/EvidenceRef, Claim/Decision, authority/driver, approval, activation candidate/evidence, revalidation, supersession; expose lifecycle in Today/Inbox/Reader; define the eval rubric | **COMPLETE — 2026-08-12** |
| **B2** | Complete the mock UX spine: Home → derived ReviewPacket → Decision/current-truth detail → scoped Ask, without forcing a Work Thread object or renaming all routes first | **COMPLETE — 2026-08-12** |
| **B3** | Ingest files/links and Loom; connect GitHub PR/commit/merge plus the minimum deployment/configuration/observable product-state source required by the selected activation condition; prove real activation continuity on one prospective dogfood episode | **IN PROGRESS — exact local evidence + capture-window-stable public GitHub PR / exact public commit + append-only manual downstream-candidate review implemented; visual QA partially complete; real downstream source/episode remain** |
| **B4** | Persistent event/domain store, auth, Spaces, source-derived permissions, retention, and audit | pending |
| **B5** | Evals for extraction, exact citation, authority/driver suggestion, activation detection, drift, abstention, and extra confirmation burden | pending |
| **B6** | Only after the loop is proven: evaluate Slack/Linear/Figma/deployment/customer-system connectors | pending |

**B1/B3 validation questions (do not replace with vanity usage metrics):** does review continuity cost the
work owner meaningful time; are Claims and exact refs correct; is the approval→activation gap worth tracking;
are activation detection and drift alerts precise enough to trust; can a later user recover current state +
why; is the extra human confirmation burden acceptably low; does the system abstain when evidence/authority
is ambiguous.

**B3 locked activation acceptance boundary:**

- Capture the HTML/SVG interaction, Loom explanation/timecodes, and GitHub PR or full-SHA commit revision as
  distinct immutable versions with exact refs; verify extracted Claims before the authority can approve the
  Decision contract.
- Approval moves the Decision to `waiting_activation`. PR opened/reviewed/approved/merged, a task, schedule,
  Loom, or verbal intent never moves it directly to `in_effect`; an observed merge is a candidate only.
- The candidate must cite stable downstream evidence and be evaluated against the Decision's specific
  `activation_condition`. A production/user-visible condition requires matching deploy/config/render/test or
  equivalent observable product-state evidence; only the scoped authority can confirm satisfaction.
- A relevant later revision must raise `needs_revalidation` while preserving the historical Approval and
  Activation. “Still current” requires a genuinely new immutable version + new exact refs; changed refs are
  never renewed in place. A meaning/scope/condition change requires a successor Decision instead.
- The safety target for false `in_effect`, exact-ref fallback to latest, unauthorized confirmation, and
  permission leakage is **0**. Prefer candidate/hedge/abstain over manufacturing continuity.

**B3 implemented prototype boundary (2026-08-13):**

- File accepts UTF-8 `.html/.htm/.svg/.md/.markdown/.txt` up to 512 KiB, rejects lossy/non-UTF-8 decode,
  preserves accepted bytes as raw text + SHA-256, recomputes the hash and reader Blocks at the mutation
  boundary (caller-supplied derivatives are not trusted), and writes a stored `ArtifactVersion` plus
  resolvable exact `EvidenceRef`.
- A generic HTTP(S) link or Loom without a user-supplied transcript is `reference_only`: Source + locator +
  relationship only, never a content snapshot or settled ref. Loom with a manual transcript stores that
  transcript as exact Markdown and labels it manual/no API; optional timecode stays on the Source.
- Capture is one batch mutation → persist local records → `bumpGraph()` once → return a truthful receipt.
  Library subscribes to graph changes; browser-local Artifact routes hash-verify hydration and permission-
  check before resolving. Stored HTML exact routes render in a read-only `sandbox="allow-scripts"` iframe
  with no same-origin and a restrictive CSP. Static links/forms/meta refresh/base are neutralized, a capture-
  phase guard blocks navigation, and a parent probe restores the frozen payload if the iframe escapes;
  captures that reference external assets warn that the exact
  viewer requires a self-contained HTML/SVG bundle for full fidelity.
- Capture success routes an exact input directly to its immutable `/artifact/.../version/...` leaf; only a
  reference-only input opens the stable locator Artifact. “Open evidence” never silently means “open latest.”
- A reference-only Artifact leaf is deliberately read-only and explains that only the locator was saved;
  it offers the original source link/timecode but no editor or language implying exact captured content.
- Strict public GitHub adapters accept only canonical `https://github.com/{owner}/{repo}/pull/{n}` or
  `/commit/{40hex}` URLs, call public REST with `no-store` and no token, validate runtime response identity,
  and freeze deterministic Markdown. PR capture rejects paginated/incomplete collection responses, verifies
  the declared commit count and head inclusion, then re-reads repo/number/head/update/merge identity after
  reviews and commits were collected; any detected capture-window drift returns 502. This is a bounded
  fail-closed consistency check, not a transactional GitHub snapshot. Commit output includes full SHA,
  parents, author/committer and changed files. Private repos, auth, webhooks and polling are
  deliberately absent. GitHub is code/review evidence, never synthetic downstream Activation proof.
- Structured `activation_requirement {kind,target,environment?}` and the pure matcher guard read state and
  Authority confirmation. Runtime observations always enter `ai_generated` with a visible current exact ref;
  the mutator cannot accept actor/trust overrides. Confirmation and dismissal append disposition events—no
  candidate is deleted or rewritten. Unknown/partial/contradicted candidates cannot
  enter `in_effect`; a connector record without an exact ref also cannot enter `in_effect`. The seeded embargo
  fixture carries its own frozen downstream publication payload/ref so the five-state demo does not bypass
  that boundary; older seed observations without raw exact refs remain historical/unavailable. Seeded PR
  merge is supporting/candidate evidence, not production deployment proof.
- A `waiting_activation` Decision with no proof now enters the Inbox as `Add downstream proof`. The dialog
  shows the locked condition/requirement, requires the user to state the actually observed target/environment
  (so staging or a different target cannot inherit production truth), observation time/type, system + stable
  locator, exact captured EvidenceRef backed by raw snapshot + hash, assertion, and revision mapping, then stores only an
  `ai_generated` candidate. Seed-derived version labels and reference-only URLs are ineligible; when no
  compatible capture exists, the dialog routes back into Capture instead of accepting a text-only claim.
  Matching candidates still need scoped Authority confirmation; incomplete/conflicting candidates stay open.
  Observation type derives evidence kind: a GitHub Source can only substantiate `merge/code_change` when its
  typed fact is a genuinely merged PR with merge SHA; open PRs and standalone commits cannot impersonate a
  merge, and code evidence stays partial against a deployment requirement. Loom/transcript/meeting/link Sources cannot substantiate
  Activation. File/doc/audit snapshots may carry downstream observations for Authority review.
- Revalidation without caller-supplied refs to a genuinely new immutable version fails closed. Replacements
  preserve artifact/source/block lineage one-to-one and change both version and content hash; an unrelated ref
  or same-snapshot alias cannot renew the Decision. The old changed ref is never mutated back to current.

**B1 acceptance rubric (all must hold before marking complete):**

- The seed demonstrates all 5 lifecycle states without conflating extraction verification, Approval, or
  Activation: `needs_approval`, `waiting_activation`, `in_effect`, `needs_revalidation`, `superseded`.
- Every Decision has exact version-bound evidence, independent authority/driver roles, and a falsifiable
  activation condition; approving requires a verified extraction + current evidence + complete contract.
- Agent-observed activation enters as a candidate; only the scoped authority can confirm it. Changed evidence
  raises revalidation and a superseded ref cannot be silently renewed.
- Today prioritizes the highest-risk continuity call, Inbox resolves the 3 actionable trust transitions, and
  Reader explains state + evidence + authority + driver + activation without adding a new navigation object.
- `npx tsc --noEmit`, a changed-file lint, and `pnpm build` pass; desktop + narrow browser checks cover the
  seeded state and at least one approval, activation-confirmation, and revalidation transition. Whole-repo
  `pnpm lint` was a known B1 baseline failure (41 React Compiler errors across legacy surfaces); B2 removed
  four Search errors. On 2026-11-03 the whole-repo count is 35 errors + 16 warnings. Do not hide the remainder by
  weakening rules.

**B1 verification record (2026-08-12):** typecheck, changed-file lint, build, and `git diff --check` green.
Chrome verified Today's revalidation priority, Inbox's 3 lifecycle action groups and count updates, Reader's
all-5-state peeks, authority/driver/activation detail, Story trust episodes, and approve → activation-confirm →
revalidate mutations at desktop plus 390×844. No browser console errors. The verified mutation session was
intentionally session-scoped and reset with the prototype.

**B2 acceptance rubric (all hold):**

- The same `decision_id` survives Today → focused Inbox → stable Decision detail → scoped Ask; ReviewPacket
  is rebuilt from records and never stored. Search and Reader route every visible Decision state to detail.
- Review, detail, and Ask agree on the four independent truth axes and lifecycle answer. A changed Decision
  may still show confirmed Activation; a superseded Decision preserves history and links only to a visible
  successor.
- Every Decision evidence link resolves an exact version/block route. Missing/unreachable snapshots are
  non-clickable and make current truth hedge; candidate Activation stays visually provisional.
- Focused Inbox owns Approve / Confirm activation / changed-evidence review. A “Still current” commit is
  available only after a genuinely new exact ref exists; after mutation the stale action disappears, the
  packet re-derives, and detail/Ask report the new state. Revalidation preserves old refs/events. (Today no UI path
  reaches that commit: see Known live defects.)
- Exact Reader is read-only, Decision detail does not duplicate/self-link a ReviewPacket, and desktop +
  390×844 keep the primary title, action, Decision scope chip, and evidence targets usable.

**B2 verification record (2026-08-12):** `npx tsc --noEmit`, B2 changed-file ESLint, `pnpm build`, and
`git diff --check` green. Chrome verified Today → focused packet, exact `v3#b_cadence`, all five Decision
detail routes, Decision-scoped Ask, superseded→successor recall, candidate Activation, and a full
needs-revalidation→in-effect mutation where the old ref/event history remains visible. Desktop and 390×844
were visually checked; exact Reader exposes no current-object mutation controls. This dated record predates the
2026-08-13 revalidation hardening, so its revalidation mutation no longer reproduces. Its lint count was 37 errors + 13
warnings; the current count is 35 + 16.

**B3 verification record (2026-08-13, dated; the contract suites now also include the 13 home tests):** Node contract suites pass **32/32**: 15 Activation contracts,
8 Capture/UTF-8/hash contracts, and 9 GitHub URL, complete-commit-set, capture-window-stability, and
deterministic-snapshot contracts. `npx tsc --noEmit`, targeted ESLint, `pnpm build`, and `git diff --check`
are green. Real public PR and full-SHA commit routes were exercised with `Cache-Control: no-store`.
Connected Chrome verified the reorganized focused ReviewPacket at desktop and 390×844 without horizontal
overflow, the downstream-proof empty state, public GitHub capture, reload/hash-validated persistence, the
immutable read-only exact evidence leaf, stable Decision recall, and permission-denied Artifact failure.
No browser console errors appeared. The in-app browser itself still timed out attaching. Visual QA remains
partial: successful local file upload was blocked by Chrome's disabled “Allow access to file URLs” extension
permission, and File/Link/Loom success flows, exact HTML/SVG interaction/navigation recovery, successful
manual Activation candidate confirmation/dismissal, Library live update, and representative failure states
still require coverage.

**B3 NEXT:** finish browser coverage for File/Link/Loom, exact HTML/SVG interaction and blocked navigation,
successful downstream candidate confirm/dismiss plus reload, Library live update, and representative failure
states. Then connect one immutable deployment/config/product-state observation and run one prospective
dogfood episode end to end.

**Production gap (important, not the next proof by itself):** `lib/api.ts` remains a session-scoped mock.
Production needs durable domain/event storage, identity/auth, source-derived permissions, connector ingestion,
jobs/retries, audit/retention, agent evaluations, and operational reliability. Postgres/event log is a likely
direction; pgvector, a specific model pipeline, and MCP are not locked merely because earlier docs named them.
The B2 Decision path fail-closes exact refs, but generic `askGraph` / `nodeRelations` / `getNeighborhood`
still lack a viewer argument and must be permission-filtered before production retrieval. B3 persistence
is browser-local and intended only to prove immutable input continuity; it is not multi-user storage or a
connector job system. Local Activation disposition history is append-only inside the prototype, but the whole
browser store is not a production audit log. Structured Activation matching is now enforced, but target/
environment/assertion/revision metadata in the manual observation form is still user-supplied and Authority-
attested rather than connector-attested. Public GitHub is unauthenticated pull-only ingestion and the repository currently has no historical
PR to dogfood; it does not continuously ingest, deduplicate, or map a downstream build back to code. A real
deployment/config/product-state authority must produce an immutable observation and revision mapping before
one real episode can be considered proof.

**Legacy prototype debt — do not claim unless the active vertical slice requires it:**

- **Shared `Checkbox` primitive** — the multi-select box differs across Library / Collection /
  add-documents; the one audit follow-up deliberately deferred (needs the component, not a className nudge).
- **`AgentMark state="thinking"`:** Capture and Search have no thinking state yet. Gathering, edit refining, Orient and
  the Activity band are wired. The splash `WovenWordmark` lockup is not placed. The static favicon is `app/icon.svg`;
  `app/favicon.ico` dates from the initial commit and may still be scaffold art (not confirmed).
- **The reader's Ask zone / Today's four-zone rhythm** — Ask is the most differentiated capability but
  visually the weakest; still the last polish.
- **Fork-1 product-wide pass** (every provisional surface a wash, every confirmed one inked) beyond
  reader/inbox.
- **Smart-collection rule engine** unbuilt (`typed → smart` rename pending); candidates flow via Inbox.
- **Audience analytics exploration** (per-artifact drill-down, completion/drop-off, click-to-filter, real
  range-varying KPIs) is frozen; it is not part of the vNext wedge. Its chart and the Governance sparkline
  go onto the house dataviz rule (`docs/reference/design-system.md`) only when next touched.
- **Open from the 2026-10-02 pass, owner calls:** a phone entry point for Library bulk select (then the
  hidden slot can stop taking taps); the reader rail now scrolls at 900px tall; Story dropped its avatars
  (reverses 07-11, needs ratifying); the figures in `lib/data.ts` still paint forest bars; `lib/api.ts` still joins
  with middle dots; no named warn/destructive wash token. The Decision h1 at `text-3xl` is deliberate per its comment
  (`components/decision-detail.tsx:101-104`), so that item closes if Kyle agrees.
- **Delete `components/graph-ask.tsx`** (no importers). `/home` already redirects and `emergent-mark.tsx` is gone.
- **Voice/STT exploration:** frozen; vNext imports Loom/transcripts as evidence rather than becoming a
  recorder or meeting bot.
- **Immersive graph phase-2:** arc/timeline label overlap, cross-scale zoom, live presence, embed the
  doc's graph in the public hub.
- **Prototype persistence scope:** B3 browser-local capture records persist and `/artifact/*` hash-verifies hydration
  before resolving them. Manual Activation candidates plus append-only confirm/dismiss dispositions tied to those
  captured refs also persist, so reload keeps the proof review on routes that hydrate. `/decision/[id]` has no hydrator
  (see Known live defects). Archive, merge rewrites, seed-only trust transitions, and public `/a/*` publication of local
  captures do not persist or resolve as production data; `/c/*` remains its own client-hydrated prototype.

## Product-completion bar (2026-08-09)

**Status at `84a4bb8`: partial.** Mostly unmet. #2 cross-surface truth fails: Activity tab counts liveRunCount, needsYou and the badge are different lists. #3 demo truth fails: trustActivity weeks stop at Jul 7 (lib/api.ts ~1702) while Today's date is live, and seed observations are fixed in 2026-08. #4 full state set fails: no loading/error fixtures. #8 fails: ESLint red, reduced-motion handled in only two CSS rules plus capture-flow. #5 and #7 have real work behind them (capture routing to the exact leaf, orbit-bench).

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

## Operational completion (2026-08-09)

**Status at `84a4bb8`: partial.** #1 partly met: Governance speaks Trusted/Watching/Held back with no raw knobs, but has no preview, diff or reset. #2, #3 and #5 unbuilt: no role model, member lifecycle or audit view. #4 unbuilt: episodes, runs, rules and disposition events are separate stores. #6 violated: capability and decision-point Switches write `.enabled` and nothing outside inbox-governance reads them (lib/api.ts:3710-3720); Nudge is a toast only (components/inbox-activity.tsx:346).

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

## Global completion action plan (2026-08-09)

**Current shipping target:** make Woven feel complete by closing one narrow, honest product loop before
adding breadth. The dependency order is:

`F0 shared truth → P0 individual-contributor wedge → P1 collective-brain proof → P2 operational shell → C2 commercial expansion`

Each arrow is a product gate, not merely a suggested calendar order. A later surface cannot create its
own version of access, counts, time, history, or success. A feature is admitted only when it advances the
north-star loop, reads shared truth, produces an explicit next hand-off, and has an honest non-happy state.

**How to use this list:** the status column shows what is open. Mark an item `done` only when its complete acceptance
criteria and the release-quality gate below pass; a component mock or polished screenshot is not completion.
The deterministic adapter may prove the prototype experience, but a real-team beta must run the same
contracts over durable, authorized storage.

### F0: shared-truth foundation (P0 prerequisite)

| ID | Action and acceptance criteria | Status | Evidence at `84a4bb8` |
|---|---|---|---|
| F0.1 | **Establish one `CommandContext`.** Every query and command receives `actorId`, `viewerId`, `workspaceId`, `activeSpaceId`, effective role, request/idempotency ID, and an injected `Clock`. Remove business-layer dependence on hard-coded `VIEWER`, `sp_product`, browser time, and magic "now" strings. Tests can run the same operation as Maya and Theo in a fixed instant and Space. | not started | grep finds no CommandContext or Clock. `VIEWER` is a const (lib/api.ts:1567). The literal "pe_maya" appears 75 times and sp_product 22 times across lib, components and app, including seed data. About 20 accessors take a defaulted `viewer` param, but none of workspace, Space, role or request ID exists. Mutators hard-code the actor (ingest writes pe_maya). |
| F0.2 | **Make domain states explicit.** Separate `Origin` (`human \| agent \| import`) from `VerificationStatus` (`proposed \| verified \| rejected`) and specify allowed transitions for artifacts, edges, ingest jobs, agent runs, learned rules, memberships, grants, and publications. Invalid transitions return typed errors; repeating an idempotent command never duplicates an object or event. | partial | Only the Decision lifecycle is explicit: DecisionState plus pure guards in lib/activation.ts, covered by 15 contract tests. ProvState (lib/types.ts:6) still fuses origin and verification. There is no VerificationStatus or Origin type. Mutators return undefined or void rather than typed errors (approveDecision lib/api.ts:1212). No idempotency anywhere. |
| F0.3 | **Introduce async query/command ports.** Components call typed domain queries and commands; the current `lib/api.ts` becomes a deterministic in-memory adapter rather than the permanent contract. Commands own validation, mutation, invalidation, and result state; components do not mutate arrays, author authoritative local state, call `bumpGraph()`, or declare success from a timer. | not started | lib/api.ts is 151 synchronous exports over mutable arrays; ingestEvidenceBundle is the only async mutator found. 11 component/page files reference bumpGraph (29 lines). SaveStatus declares success from a timer (components/artifact-reader.tsx:1044-1053). |
| F0.4 | **Enforce deny-by-default authorization.** Unknown workspace/Space membership denies access. Reader direct URLs, Today, Library, Collections, Search/Ask citations, Explorer graph hops, Team rollups, export, and public delivery return the same allow/redact/not-found outcome. Regression fixtures prove that a restricted artifact cannot be discovered indirectly while an authorized teammate can use it. | partial | canView is explicitly default-allow: no space or no membership record returns true (lib/api.ts:204-209), the opposite of the criterion. The Decision/claim path, listArtifacts, search and the Reader route do gate on canView (22 call sites; components/artifact-page-client.tsx:146). getNeighborhood, nodeRelations, nodeStats, nodeConnections, teamGraph, collectionGraph, askGraph, listPeople, listTopics, listCollections and collectionMembers take no viewer. lib/export.ts has no viewer check and its JSON export embeds the neighbourhood. No restricted-artifact regression fixture. |
| F0.5 | **Unify access, share, and publication truth.** Model workspace ACLs, direct grantees, link grants/tokens, public discoverability, public member sets, publication revision, and revoked/published timestamps without collapsing `workspace`, `link`, and `public` into one boolean. Reader Share, Collection Share, Search actions, headers, Audience, `/a`, and `/c` read and mutate this one source. | not started | publishArtifact collapses workspace/link/public into one boolean: `a.public = visibility !== "workspace"` (lib/api.ts:2109), so 'link' is not stored at all. No grants, tokens, revision or revoked_at. Artifact publishing and Collection public_member_ids are separate paths. Collection toggle-off does nothing (components/share-collection-dialog.tsx:149). |
| F0.6 | **Define `AuditEventV1` and atomic command semantics.** Every successful consequential command returns an `eventId` and records workspace/Space, human/agent/system actor, action, stable object + version, reason, UTC instant, command/correlation/causation/run/rule/decision IDs, provenance, and before/after. Failure leaves no half-change; Undo writes a compensating event instead of erasing history. | not started | No AuditEvent or eventId. The only append-only record is ActivationDispositionEvent (lib/types.ts:171), and root AGENTS.md says the browser store is not an audit log. Episodes hold a relative label (`at: "now"`). Undo does not compensate: restoreEdge (lib/api.ts:2570) reverts the edge but the 'confirmed' episode written by verifyEdge stays, so Story keeps saying Confirmed. |
| F0.7 | **Define the persistence and projection boundary.** Repositories cover workspaces, memberships, artifacts/blocks, edges, collections, grants/publications, ingest jobs, runs/rules, and events. Story, Activity, Governance, Audit, Audience, and Attention are named projections, not competing stores. The demo adapter stays deterministic; the beta adapter adds transactions, versions, durable events/outbox, retry, and reload/cross-browser survival under the same contract tests. | not started | Persistence is one localStorage snapshot (lib/api.ts:2195-2233, hydrateState :2237). No repositories, transactions, versions or outbox. Projections are not named; Story, Activity and Governance read their own arrays. |
| F0.8 | **Establish one Clock, count selectors, and per-viewer Attention model.** Store instants, derive relative labels, and make Today "Needs you", Inbox decisions, sidebar badges, and Team rollups filters of `AttentionItem { actor, owner, space, kind, urgency, age, objectId, action, reason }`. Visible counts equal visible actionable rows for the same viewer and query; urgency is not a confidence score. | partial | Summed selectors exist (inboxBadgeCount :2512, inboxDecisionCount :2500) and lib/last-seen.ts takes an injected `now`, but there is no Clock or AttentionItem. needsYou() (:1937) is a different list: no owner filter, omits suggestions and runs, includes collection candidates. lib/home.ts papers over this by computing 'more' from the badge and hiding the breakdown on mismatch. /inbox Activity counts liveRunCount, not needsYouRunCount (app/(app)/inbox/page.tsx:62). Episode and run `at` fields are relative labels. |
| F0.9 | **Build completion fixtures and contract tests.** Maintain at least full, empty, first-use, loading, error, restricted, stale/conflict, destructive-confirm, and undo scenarios. Inventory every visible control: wire it to a command, label it read-only/preview, or remove it. Run the same permissions, counts, publication, event, and idempotency contracts against each adapter. The current repo has no test script and an existing ESLint failure baseline; clear both and lock the gate before treating green CI as evidence. | partial | 45 node tests in 4 suites at 84a4bb8 (activation 15, capture 8, GitHub 9, home 13), none on permissions, publication, events or idempotency. package.json has no `test` script. No .github CI, while a push to main deploys production. `eslint .` today: 51 problems, 35 errors and 16 warnings. Design lint: 0 errors, 74 warnings. No fixture set for empty/loading/error/restricted/conflict, no control inventory, no second adapter. |

**F0 is done when** one object has one answer for visibility, publication, owner, status, time, count, and
history regardless of entry point; every visible mutation returns a typed result and canonical event.

### P0: close the individual-contributor wedge

| ID | Action and acceptance criteria | Status | Evidence at `84a4bb8` |
|---|---|---|---|
| P0.1 | **Turn every Capture source into an honest ingest path.** Upload, Paste, Claude import, and Record use one typed job/command flow that creates a real Artifact, Blocks, source/provenance, proposed relations, Attention items, and capture event. Progress, cancel, retry, and failure are truthful; the Done screen derives its links, placement, and proposal count from the committed result and never claims "woven in" before commit. | partial | Sources changed to file, link, Loom and public GitHub; Claude import and Record are gone by decision. ingestEvidenceBundle (lib/api.ts:526) really commits artifact, blocks, Source, version, EvidenceRef and episode, and the receipt derives from the result including `persisted`. Missing: proposed relations (only a human_verified sourced_from edge is created), Attention items, a job model, in-flight cancel, retry. The B3 record below lists File/Link/Loom success flows as not browser-verified. |
| P0.2 | **Make review and Verify apply the claimed effect.** Merge, rename, archive, extraction, and edge confirmation update their target and resolve the queue atomically. Failure keeps the task; Undo restores the target and queue state while adding a compensating event. Reader, Inbox, Today, Library, Collection, Team, Story, and graph projections reconcile immediately. | partial | verifyEdge and mergeArtifacts mutate for real, and Undo exists for edges. resolveCaptureReview only clears the queue; its comment says the per-kind effect is 'prototype-stubbed' (lib/api.ts:2520-2522). Merge has no Undo. verifyEdge, approveDecision, revalidateDecision, resolveCaptureReview and archiveArtifacts never call persistState, so they vanish on reload. The merge snapshot omits archived state and seed edges. Undo leaves the confirmed episode. |
| P0.3 | **Make Reader edits canonical and reload-safe.** Rename, manual block edit, inserted note, accepted AI edit, and colleague suggestion write the same versioned artifact. Save UI reflects real pending/saved/error/conflict state with retry. Library, Search, Ask citations, Story, and public delivery resolve the new title/content rather than Reader-only React state. | not started | Block edits, inserted notes, accepted AI edits and rename are all React state (setBlocks at components/artifact-reader.tsx:1212-1237 and :1400, setDocTitle :1256). lib/api.ts has no block or title mutator. 'All changes saved' is a 900ms timer (:1044-1067), a fake success on the app's main surface. |
| P0.4 | **Prove one cited personal Ask.** Answer one useful claim over the viewer's accessible graph, cite the exact artifact/block and provenance, deep-link to the evidence, and show an honest insufficient- evidence state. Ask never synthesizes from a node the viewer cannot otherwise open. | partial | answerQuery (lib/api.ts:3594) gates the centre with canView and returns a hedge. Decision-mode answers use exact, version-bound refs through decisionTruth (B2 verified). Graph mode goes through askGraph, which has no viewer and cites node labels rather than blocks. All answers are deterministic templates, which is stated as not real synthesis. Good enough for the mock spine, not the full criterion. |
| P0.5 | **Close publish → visit → revoke.** Publishing creates a server-resolvable, public-safe artifact or collection revision; collection hubs link only to public-safe readers. Preview names the exact public member set and restricted conflicts. Unpublish/revoke invalidates the old URL and records the event; the interface hands successful publishing to the next truthful Audience state. | partial | /a/[slug] is a server component reading seed module state (generateStaticParams, artifactByHubSlug), while publishArtifact mutates client memory. A newly published artifact therefore does not resolve at /a, and Unpublish of a seed-public artifact does not change what the server serves. /c is client-hydrated from localStorage, so it works only in the same browser. Copy-link gives hard-coded woven.dev URLs (components/publish-dialog.tsx:19, share-menu.tsx:37), not the deployed host. No preview of restricted conflicts, no event. |
| P0.6 | **Make foreground hierarchy and hand-offs state-aware.** Today Continue uses the viewer's most relevant unfinished work with a stable fallback; Needs You uses canonical Attention; Inbox sorts by urgency, owner, age, and blocked-by; populated Collection headers shift from fill/review to publish/manage/learn. Resolve an item from any entry point and every adjacent count/CTA updates in the same tick. | partial | /today now renders the four islands: pickHeroId(viewerRecents) with fallback a_notif, and KIND-ranked Needs you (lib/home.ts). Collection Publish is state-aware. Remaining: canonical Attention (F0.8); Inbox sort has no age or blocked-by, only kind priority (lib/api.ts:1178); populated Collection headers have no Ask or Review lead; the Activity tab count disagrees. |
| P0.7 | **Finish the visible wedge to human quality.** Run copy/pluralization, locale, keyboard/focus, reduced-motion, responsive density, truncation, and colour-independent-state passes. The full/empty/loading/ error/restricted/conflict/undo states use Woven's quiet grammar; no enabled-looking control ends in a toast, local-only state, or no-op. | partial | Large craft progress landed (type ladder, forest rule, Library, Inbox). Failing: enabled controls ending in a toast or no-op (Nudge, collection toggle-off, 'All changes saved'); 'soon' menu rows (components/app-sidebar.tsx:298, :430-442); 33 no-middle-dot warnings; no shared empty/error/conflict states. No release-gate pass recorded across 1280, 1440 and wide. |

**P0 is done when** a new user can Drop/Paste → review/Verify → read/edit → Ask with evidence → publish →
revoke without encountering a fake success, contradictory count, inaccessible next step, or reload surprise.

### P1: prove the collective brain to a real team

| ID | Action and acceptance criteria | Status | Evidence at `84a4bb8` |
|---|---|---|---|
| P1.1 | **Expand Ask to permission-aware team synthesis.** Produce a multi-artifact answer from the active Space, with exact block citations, relation rationale, freshness, and provenance. Restricted evidence becomes a non-leaking stub only when useful; it never reveals title, excerpt, identity, or graph neighbors. | not started | No Space-scoped multi-artifact synthesis. askGraph is a single-centre template with no viewer, and no non-leaking restricted stub exists in Ask. The production gap below names generic Ask as unfiltered. |
| P1.2 | **Make evidence, list, and graph one projection.** Reader relations, Ask paths, Explorer List/Graph/Timeline, Topic/People discovery, and Collection Map share center, viewer, Space, depth, filters, provenance, and edge state. Verifying in any view updates the answer, graph, Story, Governance, and Audit. Every graph task has a keyboard-usable list equivalent and non-colour state encoding. | partial | Shared accessors feed Reader relations, Explorer and Ask (getNeighborhood, nodeRelations) and verifyEdge is the single confirm path with bumpGraph. There is no viewer, Space or filter contract, no Audit target, and keyboard list equivalence is unproven. Graph layout is well-tested by orbit-bench, but that is layout, not task equivalence. |
| P1.3 | **Project one event stream for four jobs.** Story narrates one artifact, Activity monitors agent work, Governance explains delegated authority, and Audit records immutable org facts, all carrying the same event ID. Projections rebuild from the event log; an Undo cannot leave a stale "confirmed" story behind. | not started | Story uses episodes, Activity uses seed runs, Governance uses learnedRules. There is no Audit surface and no shared event ID. Undo already leaves a stale confirmed story. |
| P1.4 | **Make delegation produce observable consequences.** Agent runs have queued/running/succeeded/ failed/needs-you/cancelled lifecycle, owner, progress, cause, retry, and related artifacts/events. A learned rule moves deliberately through `watching → trusted → held back → revoked`; confirmations teach the same loop regardless of whether they started in Reader, Search, Inbox, or Team. | partial | Rule lifecycle is real in-session: watching, trusted, held_back, revoke (ruleTrust :1853, revokeRule :1825), plus promotion and pause-on-correction. RunStatus lacks queued and cancelled (lib/types.ts:637). Runs are seed data with no progress, cause or retry; the home sentence still says 'will retry' (lib/home.ts agentNowSentences) with nothing behind it. Capability switches change nothing. |
| P1.5 | **Make Today, Inbox, and Team accountable projections.** Today is re-entry, Inbox is the work queue, and Team is the active-Space rollup—not three global queues. Every stat opens the exact rows behind it; take-over changes owner, nudge is real or explicitly unavailable, and resolving work updates all projections. | partial | Take-over (claimChange/effectiveOwner) really moves ownership in-session, and Team has per-row confirm and Undo. Nudge is `notify.success('Nudged …')` with no effect and no 'unavailable' label, which directly fails the criterion. The three queues do not share one Attention model. |
| P1.6 | **Close Collections curate → publish → learn.** Candidate pools include only accessible, non-archived active-Space artifacts. Approve/dismiss writes membership + event; public reads create privacy-safe `ReadEvent`s; Audience range/KPIs/member counts derive from those events and hand useful learning back to the Collection/Today instead of displaying seeded analytics as live truth. | partial | Approve/skip writes membership and persists (:2415, :2426) but no event. generateCollectionCandidates (:2364-2389) has no active-Space, archived or canView filter. No ReadEvent type; getAnalytics returns seeded tables (:2461). The legacy debt list freezes Audience analytics, so the learn half is deliberately parked. |
| P1.7 | **Give Library and Collections complete lifecycle semantics.** Define archive once, add Archived + Restore + bulk confirmation/Undo, keep filter/search/export within the same working set, and expose real processing/run state. Add smart-collection rules only after manual membership and candidate effects are true. | partial | Archive sets state and drops from Library, nothing more. No Archived view, no Restore (grep empty), archive not persisted. Bulk Archive has no confirm or Undo yet toasts 'Moved to the archive' (app/(app)/library/page.tsx:681). Smart-collection rules unbuilt. |
| P1.8 | **Complete team discovery without leakage.** People, Topics, Search, Explorer neighborhoods, exports, and public hubs filter at the data source. Labels do not collide/truncate at standard widths, list and canvas remain task-equivalent, and direct/deep links preserve the authorized center and context. | partial | searchEntities redacts and listArtifacts filters. People, Topics, graph hops, Team rollups and export do not filter at source (see F0.4). Open-list items also apply: phone people peek hidden below sm, Explorer expanded ring on phones. |

**P1 is done when** a teammate can ask, inspect evidence, verify a proposal, observe the learned/delegated
consequence, and see the same fact in Story, Activity, Governance, Audit, Today, Inbox, and Team.

### P2: build the minimum operational shell

| ID | Action and acceptance criteria | Status | Evidence at `84a4bb8` |
|---|---|---|---|
| P2.1 | **Add an honest Workspace/Settings shell.** Start with a read-only summary sourced from real workspace, Space, member, role, and event data; do not add a generic settings nav around seeded cards. | not started | No settings route under app/(app). Avatar menu rows read 'soon' (components/app-sidebar.tsx:430-442). The brand record calls this worse than no menu. |
| P2.2 | **Complete Space and member lifecycle.** Support owner/admin/member/guest, Space inheritance and scoped overrides, invite pending/accepted/expired/revoked, member active/suspended/removed, and ownership transfer. Protect the last owner and retain event history through removal. | not started | Membership is a static `spaceMembers` map (lib/data.ts:48). No roles, invites, suspension or transfer. |
| P2.3 | **Explain and enforce permissions.** The admin readout says what each role can view, create, edit, publish, govern, invite, export, and administer in Woven language. Every displayed effective permission is computed from the same contract used at the read/write boundary. | not started | No role or capability model exists to display or enforce. |
| P2.4 | **Complete the org Audit projection.** Add actor/object/action/reason search, category/time/Space filters, readable before/after, deep links, authorized export, retention/redaction policy, and local + UTC timestamps. Human confirmations, autonomous agent work, member changes, access, export, and billing changes appear under the same event schema. | not started | No Audit surface; blocked on F0.6 and P1.3. |
| P2.5 | **Make agent responsibility adjustable, not model-theatre.** Controls name job, scope, direction, consequence, current/default value, preview/diff, reset, save, and audit hand-off. Expose `Trusted`, `Watching`, and `Held back`; do not expose raw temperature or confidence merely to look configurable. | partial | inbox-governance.tsx has the right vocabulary and working rule posture, grant and revoke. Missing preview/diff, reset, undo and an audit hand-off. Capability and decision-point switches are decorative (nothing reads `.enabled`), which must be wired, labelled or removed. |
| P2.6 | **Add integration health only for supported dependencies.** MCP/API/knowledge-source rows need real connection state, last sync, scoped permission, failure cause, retry, and audit history; otherwise keep them out of navigation or label a non-interactive product preview. | not started | No integration rows exist, which complies with 'keep them out of navigation'. Only public, credential-free GitHub routes exist (app/api/github). |

**P2 is done when** an owner can add and restrict a teammate, explain the effective access, change agent
responsibility, and reconstruct the consequence from Audit without any decorative enterprise control.

### C2: conditional commercial expansion

| ID | Action and acceptance criteria | Status | Evidence at `84a4bb8` |
|---|---|---|---|
| C2.1 | **Validate the buyer and billing unit first.** Decide whether Woven sells per workspace, active seat, usage, or another unit, who owns billing, and where the paywall belongs in the core loop. | not started | The buyer is an open unknown. Correctly gated. |
| C2.2 | **Add truthful entitlement and plan/usage readouts.** Only after real auth/workspaces exist, show plan, renewal/trial, limit/usage, seats consumed/available, billing owner, and who may change them; use owner-only read-only states until provider data is authoritative. | not started | Nothing in code. Blocked on real auth and workspaces (B4). |
| C2.3 | **Add provider-backed checkout, invoices, and webhooks.** The provider webhook—not an optimistic browser result—changes subscription status. Reconcile seats, member lifecycle, entitlements, invoices, payment failures, cancellation, and audit events; prove retry and out-of-order webhook handling. | not started | Nothing in code. Correctly deferred. |
| C2.4 | **Gate enterprise breadth behind demand.** SSO/SCIM, advanced retention, API keys, MCP admin, procurement, and deep integrations enter the roadmap only when a validated buyer requires them. | not started | Standing gate rather than a build item; holding, since no SSO, SCIM or API keys exist. |

**C2 is done when** product access, member state, displayed usage, invoice state, provider state, and Audit
all reconcile for the same workspace; until then billing is not part of the product-completion claim.

### Recommended vertical slices (ship in this order)

| ID | Slice | Status | Evidence at `84a4bb8` |
|---|---|---|---|
| VS.1 | **Dead output → living artifact** (`F0` + `P0.1–P0.3`): ingest one output, inspect proposals, verify it, edit it, reload it, and find the same artifact everywhere. | partial | Ingest and exact-leaf reload work. Reader edits are local, review effects are stubbed, approval and verify do not survive reload. |
| VS.2 | **Team answer → defensible evidence** (`F0.4–F0.8`, `P0.4`, `P1.1–P1.3`): answer one consequential team question, inspect exact evidence, verify a relation, and observe every projection update. | partial | Equivalent to B2's single-Decision spine (exact refs, stable detail, scoped Ask). Multi-artifact Ask, enforced permissions and event projection are absent. |
| VS.3 | **Delegation → observable consequence** (`F0.6`, `P1.3–P1.5`): trust one scoped rule, watch a run, take over or undo, and reconstruct why the system acted. | not started | Rule UI exists but runs are seeded and no event reconstruction is possible. |
| VS.4 | **Teammate → safe boundary** (`P2.1–P2.4`): invite a second persona, restrict one Space, prove every discovery/public/export route, and inspect the audit trail. | not started | Single hard-coded persona; no invite or role model. |
| VS.5 | **Workspace → honest commercial state** (`C2`, conditional): validate buyer, connect entitlement/provider, change a plan, and reconcile product access + invoice + Audit. | not started | Conditional; correctly parked. |

### Release-quality gate for every completed item

**Status at `84a4bb8`: not started.** Cannot pass at main: `pnpm lint` has 35 errors, no second viewer exists, permission regressions are absent, reload loses approvals and verifications. tsc, tests, design rules and build are green. No roadmap item has ever been marked done; B1 and B2 were closed against their own rubrics with changed-file lint.

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

### Explicitly deferred until the dependency exists

**Status at `84a4bb8`: partial.** Deferrals are holding: no STT, presence, billing or SSO. The carried craft debt is mixed: Checkbox primitive still absent (components/ui has none); Library row register and Reader rail substantially resolved; Collection Map and artifact-graph labels covered by orbit-bench; favicon/wordmark split still open; Clock still absent. Capture has no thinking state today, and the topbar item is gone with the topbar.

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

### The product-completion workflow for every agent change

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
7. Mark an item `done` only with evidence, then commit. The verification line names the flow and states checked.

**The largest structural gap remains the domain/backend boundary.** `lib/api.ts` is a synchronous mutable demo
adapter; Postgres/graph/vector storage, identity/workspaces, transactional commands, event/outbox, ingest/agent
jobs, server public delivery, cache/invalidation, and the permission model are unbuilt or sketches. Ask quality
still depends on graph density. Three honest market unknowns remain: do AI teams produce enough artifacts; is
"publish to a living page" painful enough; and who is the buyer. Resolve them through the vertical slices, not
by pre-building a broad admin suite.
