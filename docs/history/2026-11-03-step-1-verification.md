# Step 1 verification — 2026-11-03

## Scope and continuity

The user job is to recall a Decision or collection from its stable URL, understand unavailable content,
and recover from an error. Starting failures were two seed Decision 404s, silent collection fallback,
and inconsistent system states. The success state preserves identity, visibility, provenance and
lifecycle truth, with a real next action: return to Inbox/Library or retry the failed page.

- `decisionRecord` projects each activation observation independently. Missing exact proof remains
  unavailable/unverified; inaccessible proof IDs are removed from the view, never from canonical data.
  `decisionTruth` consumes that projection. Approval is never upgraded to activation.
- Collection routing uses `findCollectionBySlug` after browser-local hydration. An unknown slug is a
  **client-side HTTP 200 missing state**, not Q4 Roadmap and not a server 404. This preserves direct
  reload of valid collections that exist only in this browser. Internal fallback helpers remain debt.
- Shared NotFound, NoAccess and Error use existing tokens, neutral actions and the quiet public footer.
  Public leaves do not disclose restricted-vs-missing identity. Loading standardization is deferred.
- Retry refreshes server data as well as resetting the boundary; global retry reloads the document.
  Theme restoration preserves the explicit saved preference when a server failure rebuilds the page.

## Baseline

Clean `main` at `caa2a3c`, Node 26.3.0 and pnpm 11.7.0:

- Install, TypeScript and production build passed.
- Contract tests: 48 passed.
- Design lint: 0 errors, 74 warnings.
- Full ESLint: 35 errors, 16 warnings, matching the documented pre-existing backlog.
- Orbit benchmark: `PASS: true`.
- Production reproduced `/decision/de_sms` 404, `/decision/de_cadence` 404 and the incorrect
  `/collection/bogus-slug` 200 showing Q4 Roadmap.

## Final verification

After removing every temporary QA route and the root failure probe:

- `pnpm install`, `npx tsc --noEmit` and `pnpm build` passed. The build enumerates all five seed
  Decision paths and contains no QA routes.
- `node --test tests/*.test.mjs scripts/*.test.mjs`: **59 passed**, including 11 new API regression
  tests for all five Decision states, unavailable/hidden/dangling proof, viewer separation, exact
  citations, Review/Ask continuity, non-confirmable legacy observations, strict slugs and fresh-process
  recovery of a new local collection.
- `pnpm check:design`: **0 errors, 74 existing warnings**. No new design-rule finding.
- `node scripts/orbit-bench.mjs`: **PASS**.
- Full ESLint retains **35 existing errors and 14 warnings** (two fewer warnings than baseline).
  Changed files have one pre-existing error and four pre-existing warnings in the collection page;
  the other changed files are clean. Per-file/rule/severity/message comparison, excluding shifted
  source excerpts, adds **zero findings**. No rule was weakened.
- `git diff --check` passed. Public diff review found no credentials, machine paths or personal data.

Real Chrome verification used the production build, desktop widths 1280/1440 and a 390 × 844 viewport,
in both light and dark. Checks combined actual clicks/keyboard input, visible content, screenshot
inspection and overflow measurements.

| Surface | Verified result |
|---|---|
| `/decision/de_sms`, `/decision/de_cadence` | Correct identity and lifecycle, unavailable exact proof remains hedged. Both themes and widths. SMS → focused Inbox → Decision → scoped Ask preserves identity and proof limits. |
| `/decision/de_digest`, `/decision/de_embargo`, `/decision/de_sms_v1` | Existing approval, in-effect and superseded states remain readable on desktop. |
| `/decision/nonexistent_id` | Styled missing state, functioning Inbox return, saved theme retained after server recovery. Both themes and widths. |
| `/artifact/a_comp`, `/artifact/nonexistent_id`, `/artifact/a_notif/version/bogus` | Restricted, Artifact not found and Version not found remain distinct; no private metadata leaks or latest-version fallback. Both themes and widths. |
| `/artifact/a_notif/version/v3` | Existing exact-version, read-only reader still opens. |
| Unknown collection | Collection not found, with desktop shell/mobile navigation and a working Library action. No first-collection substitution. Both themes and widths. |
| New local collection | Created through the UI, directly reloaded, added two members, checked contents/sidebar count and Map; both menu reorder and real drag reorder survive reload. Unknown → valid collection navigation recovers correctly. |
| Public `/a` missing and `/c` unpublished | Quiet public missing state and unchanged not-published fallback respectively. No restricted identity disclosure. |
| Route error boundaries | Temporary client failure probes in app, reader and public scopes reached the real boundaries. Try again recovered each, in both themes and widths. |
| Server retry | A temporary dynamic server route failed while a server marker existed; after removing the marker, keyboard Try again fetched a successful server response without a manual reload. |
| Global error | A temporary root-layout child threw outside route boundaries. The replacement document retained Geist, CSS and the stored theme; Try again restored the original page. Both themes and widths. |

The failure probes and marker were local QA only and were removed before the release build.
No horizontal overflow was found on the checked 390px states; shared phone actions measured 44px high.
Keyboard activation was checked on return and retry actions. No new interaction or visual direction was introduced.

## Boundaries retained

This slice does not finish the broader F0 action IDs, add a backend, change default-allow authorization,
fix Decision local hydration, implement revalidation, standardize loading, or change branding.
The landing site was not touched. Step 2 close-out is next; no Step 2 implementation is included.
