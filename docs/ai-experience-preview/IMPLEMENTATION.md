# Future AI experience: implemented concept

This branch implements all four experiences from the two unchanged specification files in draft PR #106 (`fef4f501998916c17a580120ced871e0afdfd1e9`). It is an interactive product concept for the optional October 22 demonstration. It remains separate from the October 15 submission and the pending deterministic Planning Insights in PR #105. No merge, deployment, static synchronization, source admission or live inference is authorized by this implementation.

## Run the demonstration

```sh
npm ci
VITE_FUTURE_AI_EXPERIENCE_DEMO=on npm run dev
```

Open `/brief` and choose **Explore future AI concept**, or open `/concept/future-ai` directly. The entry is available only in the opted-in build. For a production-build demonstration:

```sh
VITE_FUTURE_AI_EXPERIENCE_DEMO=on npm run build
npm exec --workspace @diagnostic-odyssey/web -- vite preview --host 127.0.0.1 --port 4175
```

The feature flag defaults **off**. Only the exact value `on` enables it; URL parameters, saved settings and browser interactions cannot activate it. With the flag absent or `off`, the concept route redirects to `/brief`, no entry is rendered, and no concept JavaScript, CSS or fixture text is shipped. Tested absent-flag and explicit-off builds have identical bytes across all six payload files.

## What is real, illustrative, or future

| Lane | Content and behavior |
| --- | --- |
| Current product | Released national Brief highlights with native units, denominator, uncertainty, exact locators, artifact identity and interpretation limits; explicitly selected current local indicators; applied Pilot inputs and deterministic quantities. Existing producers and contracts remain authoritative. |
| Interactive concept | Research-topic cards, empty publication/effect fields, review lenses and workflow questions; hypothetical decision/data dependencies; qualitative implementation and evidence comparisons. Every illustrative card is labeled. No studies, countries, effectiveness results, rankings or clinical recommendations are supplied. |
| Future / separately governed | Literature retrieval and admission, applicability judgments, generated synthesis, provider egress, validated output schemas, accountable human review and dispositions. None is implemented or implicitly authorized by concept interactions. |

The persistent banner says **“Future AI experience — interactive concept, not live AI or verified recommendations.”** It stays below the product's sticky header during scrolling. The concept and its Brief entry are excluded from print; canonical JSON has no concept fields.

## A short demonstration script

1. **Explain my Brief.** Select each evidence role to read its boundary. Inspect a national finding's source and denominator. Distinguish Typical Range from confidence interval, gross from attributable burden, and assumptions from quantities. Open all applied assumptions. If local context is unselected, the view says so; use the real Local Context workflow to make an explicit selection and return.
2. **Explore interventions.** Inspect care navigation, provider education and remote care coordination from the committed fixtures. Switch Study profile → Transferability → Sources & limits. Filter to one topic and expand its questions. Population, geography, design, outcomes and evidence strength remain unreviewed/unassessed; citations, effect sizes and savings remain absent. Click the future workflow stages to see what source review would require.
3. **Identify data gaps.** Choose recognition-to-referral timing, implementation feasibility, or outreach feasibility. The information node changes. Select definitions, coverage or stewardship to inspect why that dependency matters. Availability is unknown; this is not a verified local deficiency. **Open real Data Requests** navigates without creating, accepting or selecting anything.
4. **Compare strategies.** Compare all three potential approaches or choose two. Switch All criteria → Implementation → Evidence & fit. Inspect transferability questions. The columns and criteria change, with no scores, winner, comparative effects or invented costs. Returning to the Pilot leaves its inputs unchanged.

Use arrow keys, Home and End in the four-goal tab list; Tab enters the selected panel. Radio controls, disclosures, comparison checkboxes and the scrollable semantic table are keyboard accessible. Both themes use the existing product tokens. Mobile stacks the diagrams and cards; the comparison table retains a labeled, keyboard-scrollable region. Reduced motion removes animation and transitions.

## Presentation architecture and safety

- `App.tsx` owns an exact build-time gate and a conditional lazy import. No new production navigation is added. The only Brief edit is a gated, print-hidden link.
- `useConceptBrief.ts` reads current validated workspace producers and calls the existing `buildPlanningBrief`; neither that function nor the export/print implementations are changed. The hook exposes no analyst mutation functions.
- `conceptBrief.ts` supplies a detached presentation snapshot using existing `PlanningBrief`, `Estimate`, local-context and source contracts. It checks national identity, source equality and release eligibility; it validates explicit local selections against the current reviewed artifact and checks scenario/result identity and validity. Failed identity checks withhold values. Selection/guard rules follow the inspected PR #105 adapter at `c176e8843780039661cc1439ab56da6cb69a059f`, without taking a dependency on its unmerged UI or changing its branch. Consolidation with that adapter can be reviewed after #105 lands.
- `storyboard.ts` consumes the exact committed JSON fixture, asserts that research claims/citations remain null, and exposes presentation-only types. It is neither a source-admission contract nor a provider response schema.
- Shared role labels, cards, headings, question lists and transferability questions support the four separate view components. All additional CSS is scoped to the concept route.
- No provider adapter, model key, arbitrary prompt, patient data, network retrieval, storage write, request mutation, new export or scientific arithmetic is added. Navigation is the only connection back to the trusted product workflows.

## Review evidence

Latest: [final integration and PR #105 plan](integration-review.md) ·
[integrated executed outcomes](integration-validation.md) ·
[integrated machine-readable results](integration-results.json).

See [executed validation](validation.md), [machine-readable summary](validation-summary.json), [browser results](browser-results.json), [disabled-build results](disabled-results.json), [axe summary including incomplete findings](accessibility-summary.json), and [governed snapshot comparison](governed-browser-comparison.json).

| Experience | Desktop light | Mobile dark |
| --- | --- | --- |
| Explain my Brief | [Screenshot](screenshots/goal-1-1440-light.png) | [Screenshot](screenshots/goal-1-390-dark.png) |
| Explore interventions | [Screenshot](screenshots/goal-2-1440-light.png) | [Screenshot](screenshots/goal-2-390-dark.png) |
| Identify data gaps | [Screenshot](screenshots/goal-3-1440-light.png) | [Screenshot](screenshots/goal-3-390-dark.png) |
| Compare strategies | [Screenshot](screenshots/goal-4-1440-light.png) | [Screenshot](screenshots/goal-4-390-dark.png) |

Also captured: desktop dark, mobile light, [expanded research](screenshots/research-expanded.png), [two-strategy comparison](screenshots/comparison-two-options.png), [320px dark reflow](screenshots/comparison-320-dark.png), and [default-build Brief](screenshots/default-build-brief.png).

## Release and rollback

This is branch-only review work. PR #105 and PR #106 retain their own history and review status. Issues #68, #26, #23 and #100 remain independently governed; no issue is closed by this work. A public release requires separate authorization for the exact reviewed revision and build. Nothing has been merged, synchronized to the static branch, deployed to Cloudflare or submitted externally.

Rollback is to omit `VITE_FUTURE_AI_EXPERIENCE_DEMO` (or set `off`) and rebuild. There are no state migrations or stored concept preferences to undo. The existing product, canonical Brief, reviewed artifacts and analyst-controlled requests continue through their existing workflows.
