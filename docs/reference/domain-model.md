# Domain model

> What this is: the typed graph, the trust records, the mutation contract, a schema digest and the `lib/api.ts` accessor index, moved out of `AGENTS.md` on 2026-11-03 and corrected against the code at `84a4bb8`.
> Status: live reference. `lib/types.ts` and `lib/api.ts` are the source of truth, and they win over this file.

## The typed graph

**Current mock graph nodes:** `Artifact` (id, `type` HTML|MD|DOC, `state` processing|living|archived, `prov`, `space_id`
permission boundary, `collection_ids`, `author_id`, `public`+`hub_slug`, presentation `gist`/`summary`/
`scale`/`updated`, optional `staleness`); `Block` (sub-node: `anchor` citable id, heading, text,
optional image/callout); `Person`; `Topic`; `Decision`; `Source` (external provenance: transcript/
meeting/audit/doc/file/link/Loom/GitHub; capture state + locator/timecode when present); `Collection` (`slug`, `color`, `kind`, `owner_id`, `public_member_ids`,
`member_order`, `intro`); `Space` (personal|team|org, visibility).

**Edges** are typed, directional, with **three-state provenance**:
`Edge { type, from, to, prov, confidence?, rationale?, anchor?, created_by }`.
`ProvState = "user_created" | "ai_generated" | "human_verified"`. `ai_generated` = pending the Verify
queue (**drawn dashed**); confirming flips it to `human_verified` (**solid**) — the trust valve.
`EdgeType`: `links_to`, `sourced_from`, `mentions`, `in_collection`, `authored_by`, `decided`,
`supersedes`.

**KG concepts (all derived in `lib/api.ts`, not stored as view-models):** Verify queue (`PendingEdge`,
`listPending`/`verifyEdge`/`restoreEdge`); provenance/evidence (`getArtifactGraph`,
`getArtifactEvidence`, `Freshness` fresh|stale|superseded); **episodic memory** (`Episode` — captured/
proposed/**confirmed**/approved/activated/revalidated/commented/resolved/edited/superseded;
`Discussion`/`Comment` durable threads with
before/after `suggestion`s); conversational edit (`EditProposal`, `proposeBlockEdit`/`refineProposal`);
governance/trust ledger (`LearnedRule` is keyed by `edgeType` × `collectionId`, origin earned|granted, mode auto|
suggest, derived trust; capability is a separate type, `AgentCapability`, ids link/file/draft/verify, and is not a field
on the rule; `AUTO_CONFIRM_FLOOR = 0.7` is a veto floor, private to `lib/api.ts`); agent runs (`AgentRun`); Ask
(`askArtifact` → `ArtifactAsk`/`AskCite`; `askGraph` → path highlight); collections/publishing
(`publishArtifact`/`publishCollection`/`artifactByHubSlug`, `CollectionCandidate` gather); analytics
(`getAnalytics`); capture reviews (`CaptureReview`, `mergeArtifacts`); neighborhoods (`getNeighborhood`/
`collectionGraph`/`teamGraph`/`pendingGraph` — depth-bounded, never a global star-map); permissions
(`Space` + `spaceMembers` + `canView(id, viewer)`).

**The trust-record layer (shipped and seeded, kept off the graph):**

- `Source` = an external system/input; `Artifact` = stable identity across revisions; `ArtifactVersion` =
  one immutable captured state; `EvidenceRef` = an exact version + block/source anchor.
- `Claim` = the smallest citable knowledge assertion. It can be useful without formal organizational
  approval and remains provisional until verified.
- `Decision` = the authority-bearing specialization: evidence refs + scoped **authority** + **driver** +
  activation condition. Authority and driver may be the same person or different people.
- `ApprovalEvent` = the organizational authorization fact. `RevalidationEvent` preserves the old→new
  evidence-ref set when authority renews a Decision after drift. `ActivationEvidence` = the exact downstream
  observation and remains immutable/`ai_generated`; `ActivationDispositionEvent` append-only records Authority
  confirm/dismiss. `DecisionRecord` projects a confirmation as `human_verified` without rewriting or deleting
  the observation. Outcome evidence (whether the change worked) is later and optional.
- `ReviewPacket` and review / incident / handoff contexts are derived work surfaces over these records,
  not mandatory canonical objects. Outputs and saved lenses are also projections.
- `DecisionTruth` is the shared derived answer contract. It keeps four axes independent — extraction
  verification, authorization, activation, and evidence freshness — and carries exact version/event cites.
  `ClaimRecord` applies the same verification/freshness discipline to related Claims.

**Three independent trust facts:** verifying an extracted edge/Claim proves the record was captured
correctly; authorizing a Decision proves the scoped authority accepts it; confirming activation proves
reality changed. Never collapse `verification → authorization → activation` into one gesture or infer
that approval means activation. `Collection.owner_id`, `deriveOwners()`, and `effectiveOwner()` route the
current queue and may suggest candidates, but never establish Decision authority. **Commitment is not
activation:** assigning an owner, creating a task, entering a schedule, explaining the work, or saying
“go ahead” does not prove that reality changed.

**Seed (`lib/data.ts`):** 2 spaces (`sp_product`, `sp_leadership`); 9 people — **`pe_maya` (Maya Chen)
is the signed-in viewer = ME**, ∉ `sp_leadership` (so `a_comp` is the "you can't see this" search
target); 4 sources; 6 EvidenceRefs; 2 Claims; 5 Decisions; 3 Approvals; 4 ActivationEvidence records;
5 topics; 3 collections (Q4 Roadmap / Growth / Research); ~13 artifacts
— **`a_notif` is the demo hero** (richly blocked; `a_notif_v2` is its preserved superseded predecessor).

**Mutation contract (important):** put mutators in `lib/api.ts`. A mutator that changes rendered data calls `bumpGraph()` so
islands re-render through `useGraphVersion()`. `persistState` is a private function in `lib/api.ts`, so a component cannot
call it. Only a narrow slice persists: collections, per-artifact membership and publish fields, local capture bundles, and
local Activation records. All other trust state resets on reload by design, including `verifyEdge`, `approveDecision`,
`revalidateDecision`, `resolveCaptureReview` and `archiveArtifacts`.

`persistState` has 12 call sites, one in each of 12 mutators, and they split into two lists of six. No other mutator calls it.

- **These six do both, so a caller repeats neither:** `ingestEvidenceBundle`, `recordActivationEvidence`,
  `confirmActivationEvidence`, `mergeArtifacts`, `resolveCollectionCandidate`, `restoreCollectionCandidate`.
- **These six persist and never bump, so the caller must `bumpGraph()`.** Rule 10 of `AGENTS.md` names the same six, and
  no others belong on this list: `createCollection`, `addArtifactsToCollection`, `removeArtifactFromCollection`,
  `publishArtifact`, `publishCollection`, `reorderCollectionMembers`. `components/share-menu.tsx` and
  `components/share-collection-dialog.tsx` have no `bumpGraph`, so check them when you touch publishing.
- `hydrateState` is async, because it recomputes SHA-256.

**The viewer constant.** `VIEWER` is declared at `lib/api.ts:1567`. `canView` (:204) and `listArtifacts` (:301) sit above it and
default to the literal `"pe_maya"`, and so do later functions such as `verifyEdge` (:2540), `recentEpisodes` (:2600) and
`viewerRecents` (:3664). The value is the same. New code takes `viewer = VIEWER`, as `listClaims` (:734) and `decisionRecord`
(:898) do above the declaration. `components/search.tsx:87`, `components/section-comments.tsx:36` and
`components/share-collection-dialog.tsx:45` hold local copies of the string. Add no more.

**Time and recency.**

- `Artifact.updated` is a display label and has no date behind it. A fresh capture writes `now` (`lib/api.ts:456`, `:593`), and
  the seed holds `just now`, `17m`, `2h`, `3d` and `2mo`. It says when the document last changed, by anyone.
- Nothing records which artifact a viewer opened. `EpisodeKind` has no view event, and `lib/last-seen.ts` stamps only the
  viewer's last visit to the shell.
- `viewerRecents` (`lib/api.ts:3664`) is the closest signal. It holds what the viewer touched, meaning their own episodes and
  the artifacts they authored, filtered by `canView`, freshest first. The Home hero and the "Jump back in" group in ⌘K read it.
- Copy names what its source holds. A list on `updated` is "Recently updated". "Recently opened" would be false over either
  source until an open is recorded.
- Three readers parse these labels and none covers them all: `agoMinutes` (`lib/api.ts:2590`), `daysAgo`
  (`app/(app)/library/page.tsx:80`) and `ageOf` (`app/c/[slug]/page.tsx:51`). Add no fourth. Open fixes has the detail and the
  plan, one helper in `lib/text.ts`.

## Schema digest

This digest follows `lib/types.ts`. Read that file for the exact shapes. Types left out of the list below: `DecisionAction`, `DecisionActionKind`, `NeedItem`, `ActivationEvidenceKind`, `ActivationObservationType`, `ActivationAssertionOperator`, `ReviewKind`, `EvidenceRefState`, `CalloutTone`.

Enums: `ProvState = user_created | ai_generated | human_verified`; `ArtifactState = processing | living |
archived`; `ArtifactType = HTML | MD | DOC`; `EdgeType = links_to | sourced_from | mentions |
in_collection | authored_by | decided | supersedes`; `SpaceKind = personal|team|org`; `CollectionKind =
typed | simple` **(product language is Simple vs Smart; `typed`→rename to `smart` when the rule engine
lands)**; `EditProposalKind = rewrite|tone|add`; `RunKind = capture|link|draft|file|scan|verify|
summarize`; `RunStatus = running|done|needs_you|failed`; `EpisodeKind = captured|proposed|confirmed|
approved|activated|revalidated|commented|resolved|edited|superseded`; `DecisionState = needs_approval|
waiting_activation|in_effect|needs_revalidation|superseded`; `DiscussionTag = decision|question|todo`.
`SourceCaptureState = snapshotted|reference_only|unavailable`; `ActivationEnvironment = production|
staging|preview|not_applicable`; `ActivationConditionSatisfaction = unknown|partial|satisfied|contradicted`.

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
Person {id;name;role;initial}  Topic{id;name}
Source {id;label;kind:transcript|meeting|audit|doc|file|link|loom|github; at?; note?; href?;
        external_id?; capture_state?; timecode_seconds?;
        github_fact?{kind:pull_request|commit;repo;sha;merged_at?;merge_commit_sha?}}

ArtifactVersion { id; artifact_id; label; by; byName; summary; changes[]; at; current?;
                  source_id?; content_hash?; snapshot?{format;raw;blocks[]} }
EvidenceRef { id; artifact_id; version_id; label; block_id?; source_id?;
              state:current|changed|superseded }
Claim { id; text; artifact_id; evidence_ref_ids[]; prov; superseded_by? }
ClaimRecord { claim; verification:provisional|verified; freshness; evidence[] } // derived
Decision { id; text; artifact_id; evidence_ref_ids[]; authority_id?; driver_id?;
           activation_condition?; activation_requirement?{kind;target;environment?}; superseded_by? }
ApprovalEvent { id; decision_id; authority_id; at; evidence_ref_ids[] }
RevalidationEvent { id; decision_id; authority_id; at; previous_evidence_ref_ids[];
                    current_evidence_ref_ids[]; result:still_current|superseded }
ActivationEvidence { id; decision_id; kind; label; system; external_id?; href?; at;
                     recorded_by; prov; target?; environment?; condition_note?; evidence_ref_id?;
                     observation_type?; observed_at?; assertion?{subject;operator;expected;actual};
                     revision?{repo?;commit_sha?;deployment_id?;config_revision?;artifact_digest?};
                     capture_mode?:connector|manual_url|manual_upload|manual_paste;
                     disposition?:open|confirmed|dismissed } // derived projection; never stored on raw observation
ActivationDispositionEvent { id; decision_id; activation_evidence_id;
                             action:confirmed|dismissed; authority_id; at; reason? }
CaptureInput { client_id; title; artifact_type; origin:file|pasted_text|link|loom|github; format?; raw?;
               href?; source_label; source_external_id?; source_github_fact?;
               source_capture_state; timecode_seconds?; destination_collection_id? }
CaptureBatchResult { artifact_ids[]; source_ids[]; version_ids[]; evidence_ref_ids[];
                     exact_snapshot_count; reference_only_count; persisted; warnings[] }
DecisionRecord { decision; state; authority?; driver?; approval?; approvals[]; revalidations[];
                 activation[]; activation_dispositions[]; evidence[] }
DecisionTruth { decision_id; state; verification; authorization; activation; activation_evidence_id?;
                freshness; answer; cites[]; hedged? } // derived, shared by Review/detail/Ask
ReviewPacket { id; question; ask_prompt; record; artifact; current_truth; related_claims[];
               evidence[{ref;href?}] }     // derived on read; never stored
```

`AskCite` may carry `evidence_ref_id`, `approval_event_id`, `revalidation_event_id`,
`activation_evidence_id`, or `decision_id`, plus `trust:verified|candidate|unavailable`. A candidate or
unavailable cite is never a numbered settled source. A current Activation cite is trusted only when its
selected exact evidence leaf resolves for the viewer; external `href` is provenance metadata, never an
exact-proof fallback.

**Implemented Activation contract + production extension:** `Decision.activation_requirement` and
`ActivationEvidence.target/environment` plus observation/assertion/revision fields make kind, stable target,
environment, and observed result mechanically comparable; the pure result is derived, never trusted as a
stored self-assertion. A stable external locator or exact `evidence_ref_id` is mandatory, and every manual
candidate requires the exact ref even when it also carries a URL/ID.
Every runtime observation begins and remains stored as `ai_generated`; only the scoped authority can append a
confirmation for a derived `satisfied`, which the DecisionRecord view projects as `human_verified` without
rewriting history. Production still needs connector revision metadata and exact downstream refs
instead of manually supplied seed keys. A PR merge may satisfy a Decision whose explicit condition is the
merge itself, but it cannot satisfy deploy/config/publication/render/user-visible behavior without matching
evidence.

**First-slice implementation + remaining production gaps:** the additive arrays above now express the
locked authority/driver split and lifecycle without forcing them into `EdgeType`/`RefKind`. Seed records are
session-scoped; local captures and local Activation records persist in `localStorage`. Most seed `ArtifactVersion` history is still derived because original raw
payloads do not exist; the in-effect embargo fixture and B3 captures are immutable stored payload/hash/block
records in `artifactVersionRecords`. `EvidenceRef` is version-bound; Source now carries file/link/Loom/GitHub locator,
capture-state and timecode metadata. Public GitHub PR/commit snapshots exist; private GitHub and real
deployment/config/product-state connector observations plus richer permission locators remain. `EvidenceItem`
remains a Reader rail view and is **not** canonical `EvidenceRef`. Outcome
evidence stays separate. Never retrofit authority as one global workspace role or treat a verified `decided`
edge as Approval.

**View-models `lib/api.ts` resolves to (never stored):** `ArtifactGraph` (proposed/linkedTo/linkedFrom/
sources/people/decisions); `EvidenceItem` (per-block provenance, `block_id?`); `Freshness` (fresh|stale|
superseded); `PendingEdge` (a resolved ai_generated edge for the Inbox); `Neighborhood`{centerId; nodes:GraphNode,
edges:GraphEdge} (depth-bounded); `GraphRel` (the paired Links list); `ArtifactAsk`{answer; cites:
AskCite[]} where `AskCite` carries `edge_id?`+`pending?` so a cited edge is **verifiable in place**;
`Stat`{v;l;delta?;points?;unit?} (a `points[]` makes a KPI selectable → the chart's metric switcher);
`LearnedRule` (origin earned|granted; mode auto|suggest; trust DERIVED via `ruleTrust()`, never stored);
`Episode` (separate confirmed/approved/activated/revalidated events, with edge/decision/evidence ids); `Discussion`/`Comment`
(a `suggestion` = before/after on a block, resolved through the same ✓/✕ valve); `AgentRun`;
`CaptureReview` (multi-choice valve; `dupeArtifactIds` for Merge); `CollectionCandidate`.

## `lib/api.ts` accessor index

`lib/api.ts` is the mock accessor/mutator layer; **every page reads through it**, and nothing outside it imports `lib/data.ts`. It has 151 value exports, listed below, plus 12 exported types that are not. `grep -n '^export' lib/api.ts` shows them all. Grouped:

- **Artifacts / blocks:** `listArtifacts` `getArtifact` `getBlocks` `versionBlocks` `artifactVersions`
  `artifactVersionById` `evidenceHref` `currentCapturedEvidenceHref` `getFreshness` `artifactConns` `primaryCollection`
  `governingCollection`
- **Graph / relations / neighborhoods:** `getArtifactGraph` `getArtifactEvidence` `getProposals`
  `nodeRelations` `nodeConnections` `relationCount` `nodeMeta` `nodeStats` `nodeTimeline` `refOf`
  `resolveCenter` `getNeighborhood` `collectionGraph` `teamGraph` `pendingGraph`
- **Verify queue (trust valve):** `listPending` `pendingCount` `verifyEdge` `restoreEdge`
  `edgeConfirmation`
- **Claims / decision continuity:** `evidenceRefById` `canViewEvidenceRef` `claimById` `claimRecord`
  `listClaims` `decisionById` `decisionState` `decisionRecord` `decisionTruth` `reviewPacket`
  `listDecisionRecords` `listDecisionActions` `approveDecision`
  `revalidateDecision(decisionId,VIEWER,replacementEvidenceRefIds)` (prototype mutators reject actor ids
  other than the bound `VIEWER`; production must bind this to authenticated identity)
  `recordActivationEvidence` `confirmActivationEvidence` (`confirmActivationEvidence(id,'confirm'|'dismiss')` also carries
  dismissal) `decisionMeta`
- **Ask / search:** `askArtifact` `askGraph` `answerQuery` `searchEntities` `askSuggestions`
  (+ const `ASK_SUGGESTIONS`)
- **Collections / publish / hub:** `listCollections` `collectionById` `collectionBySlug`
  `collectionContents` `collectionMembers` `collectionPublicMembers` `createCollection`
  `addArtifactsToCollection` `removeArtifactFromCollection` `reorderCollectionMembers`
  `generateCollectionCandidates` `listCollectionCandidates` `collectionCandidateCount`
  `resolveCollectionCandidate` `restoreCollectionCandidate` `rescanCollection` `publishArtifact`
  `publishCollection` `artifactByHubSlug`
- **Analytics:** `getAnalytics` `workspaceStats`
- **Capture:** `ingestEvidenceBundle` (active File/Link/Loom/GitHub batch), `exactEvidenceRefForArtifact`,
  legacy `captureMeeting` spike,
  `listCaptureReviews` `captureReviewCount` `resolveCaptureReview`
  `restoreCaptureReview` `mergeArtifacts` `archiveArtifacts`
- **Boundary helpers:** `asActivationCandidate` (`lib/activation.ts`) forces runtime observations to agent
  candidates; `decodeUtf8Snapshot` (`lib/capture-ingest.ts`) preserves accepted UTF-8 bytes;
  `githubPullRequestCommitSetIsComplete` and `githubPullRequestCaptureIsStable` (`lib/github-ingest.ts`)
  enforce complete PR collections and capture-window consistency.
- **Conversational edit:** `proposeBlockEdit` `proposeEdit` `refineProposal` `proposeDecision`
  `proposeCite` (`recordDecision` is legacy Governance confirm/discard tally, **not** a domain approval)
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
- **People / topics / sources / spaces / permissions:** `listPeople` `personById`
  `listTopics` `topicById` `sourceById` `spaceById` `spaceOf` `canView` `changeOwner`
  `deriveOwners` `effectiveOwner`
- **Peeks / misc:** `getPeek` `agoMinutes` `hydrateState` (+ const **`VIEWER = "pe_maya"`** = the
  signed-in viewer)

Focused pure contracts outside `lib/api.ts`: `activationConditionSatisfaction` /
`activationEvidenceSatisfiesRequirement` / `activationEvidenceKindForObservation` /
`activationSourceSupportsObservation` / `selectActivationCandidate` in `lib/activation.ts`;
`normalizeHttpUrl` / `parseLoomUrl` /
`captureFormatForName` / `assertCaptureSize` / `sha256Text` / `snapshotBlocks` in
`lib/capture-ingest.ts`; `parseGitHubPullRequestUrl` / `parseGitHubCommitUrl` and deterministic snapshot
formatters in `lib/github-ingest.ts`. `/api/github/pr` and `/api/github/commit` own public REST runtime
validation. Do not reimplement these validators in a connector or UI.

Outside `lib/api.ts`: `pendingByOwner` is in `lib/pending.ts`. `lib/collections.ts` exports a different `collectionBySlug`, a load-time snapshot.
