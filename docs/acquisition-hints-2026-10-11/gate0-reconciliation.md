# Narrow Gate 0 reconciliation

Main verified: `e27403af8d878327d28ead2b6f7aeb00657c5239`.
PR #94 examined at `e4dccab68c95d7ab72b46678fae1d6836da20066`, draft against
`qa/gate0-b99d1c7-baseline` (`b99d1c703226009f2004a06a332174124fbfd8a3`).
Its historical branch was not edited, merged or treated as current-main acceptance.
Before PR creation, #94 advanced to `a77e2ff03971c32e3f268408e41061d6b9e9f9ad`.
The two new commits add print-flow rules and a selected-request/long-context PDF test.
That exact new test **passes on fresh current main**, including all twelve whole
DecisionTrace entries and all 21 printed interpretations; no new material blocker
was reproduced. Results are retained in `validation/latest-main-pagination.json`.
Draft #95 subsequently appeared at `f7608042ddafa3364655e12c2a1fc5197e0a9dda`;
it changes narrative verification tests/CI, with no #23 file overlap. No active #23
implementation PR was found before creating the dedicated branch.
The final ownership recheck also found #96 (offline #68 contracts) and #97 (narrative
candidate retention). Neither overlaps #23 implementation; #96 also edits the lockfile,
so future integration must reconcile that independently. #95 advanced to
`395c591ab22412db8f6535766d7186181e4b3aaf`. None was edited or incorporated here.

The owner accepted [PR #92 QA](https://github.com/Ianyliu/diagnostic-odyssey/pull/92#issuecomment-6102220045)
and [PR #93](https://github.com/Ianyliu/diagnostic-odyssey/pull/93) as the reusable
baseline, with their documented limits. This reconciliation supplements that evidence;
it is neither a broad audit nor a claim of manual accessibility certification.

| PR #94 finding group | Actual current-main disposition | Evidence / action |
| --- | --- | --- |
| Brand/route accent contrast | Already fixed | Main uses opaque branding and corrected journey accents; prior rendered contrast evidence retained |
| Named DecisionTrace, linked-condition, provenance and hero groups | Already fixed | Current source includes the corresponding group roles/names |
| Numeric drafts, exponent limits, underflow, percent precision and arithmetic overflow | Already fixed | Current guards are at least as strict; targeted ordinary-invalid/overflow/valid-extreme-scenario groups passed |
| Unsupported sensitivity neighbors | Already fixed | Valid applied scenario retained; targeted unsupported-range check passed |
| Media fallback, print subscriptions and theme color | Already fixed | Current shared browser-media handling and existing accepted QA; native before/afterprint targeted check passed |
| Native HPSA score units | Already fixed | Current reviewed metadata and accepted native-unit regression evidence; no artifact edits |
| Brief assumptions/output pagination | Key fixes already shipped | Current print rules retain complete assumptions and output rows |
| Additional print block/list-item preferences | Historical-baseline/proposed presentation preferences, no current material defect reproduced | Fresh native seven-page Brief and explicit PDF produced; all seven native pages visually inspected, findings, limits and provenance readable; DecisionTrace spans pages without lost text |
| Question-specific request selection names | Still present, nonblocking usability defect | One targeted accessible-name group failed on main; three-line heading/action label association included in #23, attributed to #94; must pass before independent PR assessment |
| New audit fixtures/scripts and historical snapshots | Baseline-specific evidence | Not product repairs and not copied as a replacement acceptance harness |

Targeted supplemental run: **4 pass, 1 known fail**, no page errors. Checks covered
ordinary invalid drafts/stale-selection announcements, overflow, unsupported sensitivity,
native print restoration and distinct request-control names. Original results and both
PDFs are retained locally at
`artifacts/generated/pr94-current-main-reconciliation-20261011/` in the primary workspace.
The failing name association is explicitly tracked rather than relabeled as a pass.

Engineering disposition: no material arithmetic, export, privacy or blocking current-main
defect was reproduced. The remaining checkbox-name improvement is scoped into #23 and
requires independent exact-HEAD review. Gate 0 baseline reuse supports bounded PR
preparation; substantive release assessment still considers this correction and the
new feature-specific rendered/export checks. No automatic Gate 0 certification,
PR #94 merge or release authorization is inferred.
