# Integrated verification results

The tested code revision is `3f4b0c662d1345c53086094fbcc1b6f198227e5e`, including
ordinary main merge `34e200f11f2876e9323312c6223aa0fe8a94995a` and reviewer correction
`e3a83850d2ec72b5b3ce782355758f291819da21`. This final evidence commit changes only
documentation and review artifacts. Exact final-head CI status is linked in PR #108.

**Engineering recommendation: APPROVE integration.** This is not an authorization
to merge, publish, activate live AI, synchronize hosting or deploy. Formal release,
scientific/privacy/security and accessibility-owner decisions remain independent.

## Executed outcomes

| Check | Outcome |
| --- | --- |
| Clean `npm ci`, workspace typecheck, lint and builds | PASS |
| Workspace unit suite | 390/390; includes all 14 current AI-handoff regressions |
| Enabled, unset-flag/default and explicit-off builds | PASS; default and explicit-off bytes identical across six payload files |
| Focused concept browser suite | 9/9, including actual selected → stale → explicitly deselected analyst request |
| Disabled route, entry, fixture-chunk and network proof | 2/2 |
| Full existing acceptance | 26/26 on current main, 26/26 default-off, 26/26 enabled |
| Gate 0 accessibility | 14/14 default-off and 14/14 enabled, plus both exact-head CI variants |
| Acquisition/state/JSON/PDF browser regression | 12/12; synthetic admitted-guidance fixture stays isolated from production |
| Source-bound concept axe scans | 24 evaluations, zero violations: all four goals × desktop/tablet/mobile × light/dark |
| Existing product axe | Zero violations across 11 routes in both themes, in each full suite |
| Real browser exports through AI handoff | 84 downloaded Briefs × six goals = 504 exact payload/warning comparisons |
| Governed snapshot parity with current main | All seven snapshots match in both default and enabled builds; only top-level generation timestamp ignored |
| Fresh default PDF | Seven pages in main/default/enabled; normalized extracted text identical |
| Selected/refreshed analyst-workflow PDF | Eight pages in main/default/enabled; normalized extracted text identical |
| Original goal screenshots | All 16 byte-identical; eight new tablet captures and a stale-warning capture added |
| Provider/external/runtime requests, concept page errors | Zero observed in the focused production concept suite |
| Python provenance / local context / output verifier | 32/32, 51/51 and PASS |
| Immutable reviewed artifacts | All four SHA256 manifests pass; scientific package/data/source paths unchanged |
| Synthetic R and existing CI | PASS in GitHub, including the added exact-head R job |

Local verification used Node 24.19.0, Chromium 154.0.8037.57, Playwright 1.62.1 and
axe 4.11.1. GitHub verification uses Node 22 and explicitly checks out the PR head
for both browser variants and synthetic R. Local R is unavailable; no local R run
is claimed. Existing CI also completed successfully.

Initial parallel local Gate 0 runs encountered six-second screenshot timeouts.
The execution worker temporarily disconnected. Both complete suites passed when
rerun serially with the original assertions/timeouts; no test was weakened.
Exact-head GitHub Gate 0 passed in its isolated default/demo jobs as well.

## Stale-request and handoff findings

The selected capacity request becomes stale after changing the applied capacity
from 3,000 to 2,000. The complete real Brief/concept warning arrays match, including
the singular selected-stale warning. Canonical JSON excludes the request before
and after exploration. Request content, stale state and checked selection remain
unchanged. Only an explicit analyst deselection removes that warning; subsequent
exploration does not select the request again.

The six concept-state exports and 39 exports from each full default/enabled run
are passed through every handoff goal. Complete canonical values, provenance,
warnings and timestamps match. Main's handoff source is unchanged and still has
no UI route or network/clipboard/provider capability.

## Incomplete accessibility findings were assessed

Zero axe violations are not treated as complete accessibility certification.
The incomplete contrast cases were investigated using the existing Gate 0 PNG
foreground/background method: capture the element, make its text transparent
without changing its contents/layout, capture the background and restore the
original style. Actual background pixels under text were compared against the
computed foreground. Horizontally clipped comparison cells were scrolled into
view before measurement.

- Concept: 126 distinct viewport/theme/selector cases. All 48 meaningful-text
  measurements passed 4.5:1; minimum **5.464:1**. The other 78 are decorative
  `aria-hidden` orbit/glyph elements that convey no unique information.
- Existing Overview: 61 cases. All 37 meaningful-text measurements passed;
  minimum **4.776:1**. The other 24 are decorative `aria-hidden` content.
- Gradient-map labels and clipped strategy unknown-state cells are included in
  the measured cases. This is an assessment of the captured states, not a claim
  that all future states or every assistive technology are certified.

Raw selectors, reasons, computed styles, dispositions and measured ratios are in
[concept review](integration-evidence/concept-contrast-review.json) and
[Overview review](integration-evidence/overview-contrast-review.json). The
[raster helper](integration-evidence/contrast-raster-helpers.txt) and
[local review procedure](integration-evidence/contrast-review-method.txt) are
retained for inspection; their absolute workspace/output paths describe this
execution and should be adjusted when rerunning elsewhere. Per-node original and
background image filenames in those reports refer to local raw QA output.

## Visual and export evidence

The four accepted layouts remain unchanged: [all 16 original screenshot matches](integration-evidence/visual-comparison.json).
Fresh representative desktop/mobile/tablet, light/dark screenshots were inspected,
along with the stale-warning state and first/last pages of the default PDF.

| Experience | Desktop | New tablet dark |
| --- | --- | --- |
| Explain my Brief | [Screenshot](screenshots/goal-1-1440-light.png) | [Screenshot](integration-evidence/goal-1-768-dark.png) |
| Explore interventions | [Screenshot](screenshots/goal-2-1440-light.png) | [Screenshot](integration-evidence/goal-2-768-dark.png) |
| Identify data gaps | [Screenshot](screenshots/goal-3-1440-light.png) | [Screenshot](integration-evidence/goal-3-768-dark.png) |
| Compare strategies | [Screenshot](screenshots/goal-4-1440-light.png) | [Screenshot](integration-evidence/goal-4-768-dark.png) |

[Stale-warning screenshot](integration-evidence/stale-warning-concept.png) ·
[Fresh default PDF](integration-evidence/fresh-default-brief.pdf) ·
[Fresh PDF comparison](integration-evidence/fresh-default-pdf-comparison.json) ·
[Analyst-workflow PDF comparison](integration-evidence/workflow-pdf-comparison.json) ·
[Main/default snapshots](integration-evidence/main-vs-default.json) ·
[Main/enabled snapshots](integration-evidence/main-vs-on.json)

## Commits and limitations

| Commit | Change |
| --- | --- |
| `79ec211` | Original default-off foundation; preserved |
| `386ef1f` | Original four interactive views; preserved |
| `2d23b33` | Original tests/CI; preserved |
| `fb74752` | Original documentation/evidence; preserved |
| `e3a8385` | Independent reviewer: preserve selected-stale warnings; preserved |
| `34e200f` | Ordinary merge of current main; no conflicts or history rewrite |
| `3f4b0c6` | Focused stale-state test, actual-export handoff verifier, tablet coverage, exact-head web/R CI |
| Final evidence commit | These reports, screenshot additions and PR #105 consolidation strategy; no runtime changes |

The [integration review](integration-review.md) identifies the precise BriefPage
insertion points and the post-acceptance #105 shared-producer/guard-core extraction
plan. #105 remains unmerged and unchanged. Duplication is deliberately temporary;
its removal is gated on that separately reviewed feature's acceptance.

Manual screen-reader speech, non-Chromium/OS printing and tagged-PDF accessibility
remain unverified. No formal penetration test, privacy certification, scientific
source admission or live-AI authorization is inferred. The inherited Vite chunk
warning remains. Public activation and release remain held for the owner and
independent governance decisions; no merge, deployment, hosting synchronization
or external submission occurred.
