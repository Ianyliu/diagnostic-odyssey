# Muse handoff — Unified Planning Intelligence integration

**Last source-tested HEAD:** `c83ace4bae2b30a986ee24e1f4a5ce5ba92f1cc1` (15 October 2026 ET).
**Repository:** [Ianyliu/diagnostic-odyssey](https://github.com/Ianyliu/diagnostic-odyssey).
**Work item:** [draft PR #110](https://github.com/Ianyliu/diagnostic-odyssey/pull/110).
**Branch:** `integration/planning-intelligence-three-lanes-20261015`.
**Main at integration start:** `a3a94acfcfc4c0ef004d719e355f433f331b191c`.
**Scope:** nonproduction development/review only. No direct main merge, static-branch synchronization, Cloudflare deployment or inference-provider activation authorized here.

## 1. Why this exists

Three independent, unmerged features need to coexist without changing reviewed evidence, core Planning Brief serialization or author-controlled data requests:

- [PR #105](https://github.com/Ianyliu/diagnostic-odyssey/pull/105) `b6e741bef38aad12ddb32f72d64ed7207171977f`: deterministic source-grounded Planning Insights, optional PDF summary and source provenance.
- [PR #108](https://github.com/Ianyliu/diagnostic-odyssey/pull/108) `999674c5bc9a0214f24e64a519acfac1e60b2685`: default-off Future AI *concept*, four interactive illustrative workflows, no live inference or approved intervention narrative.
- [PR #109](https://github.com/Ianyliu/diagnostic-odyssey/pull/109) `6e2a7cb33110f98d7cd943438662d3f271785813`: user-operated six-goal Analyze with AI text handoff; no API calls. Frozen snapshot, explicit regeneration after changing scenario/source/selection, copy/download/manual-select semantics.

Keep these product claims distinct: the concept is NOT evidence that Diagnostic Odyssey currently searches literature or runs an AI model. The handoff copies a governed brief into text for user action; it is not an external transmission by the product.

## 2. Provenance of the integration

The integration branch was created at `main@a3a94acf`. GitHub Git Trees API was used to assemble genuine *ordinary two-parent merge commits* preserving all histories and without force-push.

| Commit | Change |
| --- | --- |
| `8494e04d986f10819500700d2bf5eec2b89d4910` | Preserve PR #108 complete tree/history |
| `a185ade52fe5f895b250c4ce6f6403479e08356c` | Merge PR #109, manually reconcile `BriefPage.tsx` for concept + handoff |
| `16e96dad098567249d58d63b681f00f182798b87` | Merge PR #105 at `b6e741b`, manually reconcile `BriefPage.tsx` to retain all three features |
| `3a1cc8426db58077a11fb1f2d322fe2da8ec0ead` | Add four-flag integration browser/PDF matrix |
| `c83ace4bae2b30a986ee24e1f4a5ce5ba92f1cc1` | Fix ESLint globals in new browser smoke script |

After the integration, a direct Git object-level comparison showed **all nonconflicting PR-changed paths byte-identical to their original final heads**: PR #105 22/22, PR #108 82/82, PR #109 17/17. Only `apps/web/src/pages/BriefPage.tsx` needed conflict resolution. It now contains the original reviewed Brief producer with stale-request warnings, the optional <PlanningInsights> block, the demo-gated concept link, and <AiHandoff> alongside the JSON/PDF export controls.

## 3. The #105 print correction

Direct code commit on the original PR #105 branch:

`b6e741bef38aad12ddb32f72d64ed7207171977f` — `fix(insights): compact opt-in print synopsis with governed source pointers`.

- Removed a print `break-inside: avoid` that displaced the whole planning section.
- Replaced verbose per-highlight printed universe/denominator/source-locator repetitions with record and source IDs, plus a combined paragraph explaining where the complete population definitions, denominators and exact source locators can be inspected.
- Added a Chromium PDF regression requiring the baseline opt-in summary to fit within eight pages total while keeping the underlying detailed reviewed Brief unchanged.
- The full validated source records and their native values/uncertainty are **not altered**. Still review the compact printed citation readability/provenance; this may warrant adjustments before judge/public-facing PDF distribution.

**Important:** `docs/planning-insights/example-summary.pdf` and older `docs/planning-insights/validation.md` still describe/illustrate the earlier nine-page layout. Regenerate/update after visually confirming the new output. Do not represent the old binary as proof of the updated source.

## 4. Exact-head verification at `c83ace4`

| GitHub workflow | Run | Result |
| --- | --- | --- |
| Standard CI (`npm ci`, typecheck, 409 unit tests, lint, build, scientific provenance/local context) | [38829027135](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38829027135) | SUCCESS |
| Four-combination integration browser and PDFs | [38829027150](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38829027150) | SUCCESS, 4/4 |
| Original Future AI default/demo browser/R checks | [38829027107](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38829027107) | SUCCESS |
| Original AI Handoff full exact-head tests/browser | [38829027123](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38829027123) | SUCCESS |
| Automated Jules review workflow | [38829027152](https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/38829027152) | SUCCESS (not a human approval) |
| Acquisition browser QA | path-filtered skip | SKIPPED, not failure |

The four matrix builds:

| Planning Insights flag | Future AI concept flag | Checked |
| --- | --- | --- |
| `off` | `off` | handoff still available; no concept or insights |
| `on` | `off` | handoff + deterministic insights |
| `off` | `on` | handoff + gated conceptual future experience |
| `on` | `on` | all three coexist and routes/exports remain stable |

Use `VITE_PLANNING_INSIGHTS_PREVIEW` and `VITE_FUTURE_AI_EXPERIENCE_DEMO` at build time. **Important:** in the present implementation, Insights defaults ON if no flag is set; the Future AI concept defaults OFF. This is a release decision requiring owner review, not an authorization to enable the concept.

Integration smoke checks cover visible controls, feature gating, handoff modal, navigation, concept goal switching, JSON preservation before/after exploration, and optional summary visibility.

The Chromium PDF verifier passed all opt-in checks including footer clearance and source handoff. Example observed combined-branch page counts (both Insights-ON matrix jobs):
- basic summary off: 8 pages
- basic summary on: 8 pages
- all local context selected: 24 pages
- extreme finite planning inputs: 9 pages

These counts are from the CI renderer/configuration; do **not** assume the old seven-page off-mode PDF and current eight-page off-mode PDF are necessarily byte-identical or scientifically equivalent without a separate exact-text comparison. Existing GitHub checks preserve governed JSON and snapshots; a direct pre/post PDF text comparison and human page-image review are outstanding.

## 5. What Muse should do next

1. **Fetch and verify latest remote state** of `main`, PR #110 and the three parent PRs. Do not assume the pinned SHAs if someone has pushed new commits.
2. **Inspect actual CI artifacts and render the four PDFs** from the combined `on/on` and `on/off` cases. Confirm visual pagination (no orphan headings, clipped long values, or misleading page breaks), source legibility and consistency. Pay special attention to `summary-off.pdf` versus the base Brief; opt-in print must not alter its default scientific content.
3. **Review the unified Brief visually** at 1440/820/390/360px, both themes and reduced motion. Three distinct entry points must remain legible, appropriately ordered, keyboard usable, and avoid an overly cluttered side panel.
4. **Strengthen cross-feature stale-state flow**: select a trusted Data Request, apply a changed Pilot scenario, confirm stale exclusion from JSON, identical warning boundaries in the concept and Brief, and a stale Analyze-with-AI handoff snapshot until explicit regeneration. Add an integrated browser test if coverage is missing.
5. **Compare reviewed content against main:** all 21 national estimates, two Typical Ranges, 34 WV indicators, and 7 governed snapshots must remain intact. Candidate A and unadmitted narrative interventions must remain invisible in released evidence, exports and recommendations.
6. **Only if clearly justified by duplication**, extract a small reusable trusted read-only projection used by the deterministic preview and concept. Their evidence roles and output contracts differ; do not conflate concept fixtures with reviewed records. No speculative refactoring, dependency additions or model-provider work.
7. Update the stale #105 example PDF and validation documentation **only after** source-fixed output is visually accepted. Commit the refreshed artifacts and results separately.
8. Rerun exact-HEAD CI including the existing two special workflows and four-matrix integration suite after every code change. Capture generated PDFs and screenshots. Provide a source-SHA-bound final engineering verdict and exact remaining limitations.
9. Keep PR #110 draft until independent owner review. Do not merge original PRs, PR #110, sync static branches, or deploy the app without explicit release authorization.

## 6. Reproduction

Node 22:

```bash
npm ci --no-audit --no-fund
npm run typecheck
npm test
npm run lint
VITE_PLANNING_INSIGHTS_PREVIEW=on VITE_FUTURE_AI_EXPERIENCE_DEMO=on npm run build
```

The new test entry point is `tests/browser/planning-intelligence-integration.mjs` and workflow `.github/workflows/planning-intelligence-integration.yml`. Its four combinations run automatically on PR changes and archive screenshots/PDF evidence. The existing `.github/workflows/future-ai-experience.yml` and AI Handoff Exact Head workflow provide broader independent coverage.

## 7. Uncertified limitations

No manual VoiceOver/NVDA test, non-Chromium browser/print validation, fully tagged/accessible PDF, independent clinical/scientific admission decision, or real provider security/privacy certification has been completed here. Screenshots are saved in GitHub Actions artifacts, but this connector-only review did not independently inspect every generated image pixel. No real AI inference, clinical advice automation, literature retrieval, causal effectiveness or demonstrated savings has been added.

**Handoff status:** source integration and automated CI GO at `c83ace4`; human visual/provenance review, artifact refresh, final independent exact-HEAD acceptance and owner/release authorization remain outstanding.
