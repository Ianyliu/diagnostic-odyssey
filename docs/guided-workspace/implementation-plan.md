# Guided workspace: revised implementation plan

Baseline: `4a86284a8791235423c92fc9608e74dbcf24e2e0` (current main, including PR #116). Main CI passed: https://github.com/Ianyliu/diagnostic-odyssey/actions/runs/39086314047. Branch: `ui/guided-workspace`.

## Accepted design

The four stages are orientation, not a locked wizard: **Reviewed evidence** (`/burden`), **Local context**, **Pilot**, **Brief**. `/evidence` remains **Intervention evidence & limits**, reachable from supporting navigation, Pilot and Brief. Preserve routes, fragments, browser history and direct access.

Retain the navy/teal editorial identity and a compact branded hero, evidence-availability counts, labeled evidence roles and the existing opening-motion controller. Remove repeated orientation panels rather than analytical content. Mobile uses four labeled bottom destinations; choose the breakpoint through measured layout checks, with safe-area spacing, zoom, keyboard, dialog and focus coverage.

Pilot keeps eight editable assumptions, live valid-draft updates, last-valid results, all decision visuals and four headline quantities: participants served within capacity, capacity gap, person-month exposure difference and program-resource requirement. Collapsible input groups show applied-value summaries and open for invalid inputs. Keep a visible sensitivity preview and prominent Explore sensitivity / capture-data-needs paths alongside Review planning brief. Preserve full tables, precision, extreme numeric tokens and restrictions.

Local categories may collapse, with selected counts and Pilot attachment visible in their summaries. Each displayed indicator keeps both independent selection actions directly accessible. Only provenance/methodology and extended limitations move into disclosures.

The Brief's first summary is the existing deterministic PlanningInsights projection. Preserve highlights, readiness, scenario interpretation, provenance and visible next actions; progressively disclose extended investigation prompts. Keep both AI entry points prominent and distinguish manual Markdown handoff from illustrative demo, with concise visible no-live-AI disclaimers. Preserve all handoff goals, payload/staleness/regeneration rules, visitor toggle and build flags.

Keep the complete Brief mounted under Read full brief. Fragment navigation opens enclosing disclosures before focus/scroll. Printing opens the complete report and restores exact disclosure states; optional printed Insights stay opt-in. Data Requests retains visible freshness, selection and refresh controls, removal and stale-export exclusion, with contextual paths from Pilot and Brief.

## Atomic sequence

1. Document the revised plan and pin the baseline.
2. Reproduce baseline checks; if justified, disambiguate the literature component import in a behavior-preserving portability commit. Record local failures separately from passing main CI.
3. Introduce shared navigation, scope summary and accessible disclosure/history behavior.
4. Simplify Overview while preserving identity and opening-motion semantics.
5. Simplify burden/context browsing with directly accessible selection controls.
6. Simplify Pilot without losing visuals, sensitivity or the operational request loop.
7. Make Brief summary-first using PlanningInsights; retain prominent, distinct AI entry points and complete print/export behavior.
8. Simplify operational requests; keep freshness and inclusion visible.
9. Complete verification and record the audit, screenshots, exact commits and acceptance recommendation.

Regression updates accompany their feature commits. Each code commit must build and pass affected tests. No evidence artifacts, scientific contracts, formulas, release gates, serialization, production configuration or deployment changes.

## Acceptance evidence

Run typecheck, lint, all unit tests and production build with Node 22. Run acceptance, accessibility, continuity, visual quality, motion, AI handoff, Future AI, Planning Insights, acquisition guidance and all four feature-flag integration combinations. Exercise 320/390/768/1024/1440px, both themes, extreme numbers, invalid drafts, stale requests, direct links, keyboard, reduced motion and back/forward.

Capture before/after Overview, burden, context, Pilot, requests and Brief on desktop/mobile. Inspect layout hierarchy and discoverability as well as overflow. Verify actual PDFs from collapsed Briefs, exact disclosure restoration and Insights print opt-in. Record limitations of simulated keyboards/zoom and unavailable real-device or assistive-technology checks honestly.

Compare governed baseline/final snapshots: 21 MEPS estimates, 34 WV indicators, two Typical Ranges, reviewed-file hashes, canonical Brief snapshots and scenario/sensitivity fixtures. Compare browser exports where applicable. Publish a draft PR for independent review; do not merge or deploy.
