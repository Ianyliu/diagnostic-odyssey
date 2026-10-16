# Final integration and review preparation

This is final integration/QA for PR #108, not a redesign or release authorization.
The accepted four views and the reviewer's stale-warning correction are retained.

## Verified inputs and non-force integration

- Current main: `a3a94acfcfc4c0ef004d719e355f433f331b191c`.
- Reviewed PR #108 head: `e3a83850d2ec72b5b3ce782355758f291819da21`.
- Separate PR #105: `c176e8843780039661cc1439ab56da6cb69a059f`, open and unmerged.
- Independent review: [5533347157](https://github.com/Ianyliu/diagnostic-odyssey/pull/108#pullrequestreview-5533347157).

The local branch was fast-forwarded to the reviewer correction, then current main
was incorporated by ordinary two-parent merge
`34e200f11f2876e9323312c6223aa0fe8a94995a`. Its first parent is `e3a8385`, second
parent is `a3a94ac`; no conflict resolution was needed. The merge adds main's seven
AI-handoff source/test/workflow/documentation files. The original four feature
commits and the reviewer correction remain ancestors, with their original SHAs.
The resulting merge base with main is exactly `a3a94ac`. No rebase, force push,
merge of #105, or edit to its branch was performed.

## Coexistence and the actual authority boundaries

| Feature | Current integration | Authoritative input / output |
| --- | --- | --- |
| Planning Brief | Existing `/brief`, routes/navigation, analyst selection, JSON and PDF behavior | Existing `buildPlanningBrief`, current selection rules and `withStaleSelectedDataRequestWarning`; canonical export remains authoritative. |
| AI handoff from main | Read-only source module and six analytical prompt templates; main currently has no handoff UI or route | Receives the composed PlanningBrief; its payload is the exact parsed canonical serializer output. It does not fetch, transmit, copy or download anything itself. |
| Future AI concept | Demo-only `/concept/future-ai` and gated Brief link | Reads current trusted producers and projects a detached presentation snapshot. It has no export or analyst mutation capability. Only exact build flag `on` enables it. |

All main AI-handoff files are unchanged by this branch. The handoff verifier tests
all six goals against actual browser-downloaded current, selected, stale and
explicitly deselected Briefs, retaining warnings, timestamps and canonical values.
It does not manufacture an AI-handoff UI to claim route coverage that does not
exist in main.

## Focused stale-request regression

The browser test creates an analyst capacity request, explicitly selects it, and
confirms its presence in the real Brief JSON. It changes capacity in the real
Pilot, observes the selected request becoming stale, and compares the full
warning arrays in the real Brief, canonical JSON and concept. The stale request
is excluded from canonical JSON while the selected-ID state is retained.

The test then explores research, comparisons and a different data-map decision,
returns through the concept's real Data Requests link, and checks that the entire
request sheet, stale state and checked selection are unchanged. Canonical JSON
before/after exploration is identical except its generation timestamp. Finally,
an explicit analyst deselection removes the selected-stale warning; subsequent
concept exploration cannot select the request again. No refresh, acceptance or
selection is synthesized by viewing a concept.

## Concrete PR #105 integration plan

No pending #105 code is imported into this branch. Inspection found that #108's
only `BriefPage.tsx` integration is its print-hidden, exact-on concept link before
`print-provenance`. #105 adds its own optional `BriefInsights` error boundary after
that provenance block and its separately reviewed print-summary behavior. Keep
both insertion points; do not replace the Brief header, export callbacks, warning
composition or print lifecycle while resolving that future integration.

The guarded projections overlap in national source identity/equality, release and
source-manifest checks, domain-ordered highlights, reviewed local-context
membership and valid scenario/result pairing. There are real differences:
#105 exposes availability/explanations and investigation prompts, while the concept
exposes a smaller detached snapshot and requires all selected local records to
verify before displaying that local selection. Blindly substituting the full
#105 adapter could weaken that guard or pull operational prompt construction into
the concept.

After #105 is accepted, use a narrow follow-up with these concrete changes:

1. Extract a single application-local composed-Brief producer used by BriefPage
   and the concept hook. Its typed inputs include selected current requests **and**
   all selected request IDs, both local-selection sources, scenario/result, current
   source status and generation time. It owns local merging, context identity and
   stale-warning composition. A future authorized handoff UI receives that same
   composed Brief object rather than reconstructing it or accepting a presentation
   snapshot as scientific authority.
2. Extract the reviewed national/local/scenario guard core from the accepted
   #105 adapter into `data/reviewedBriefProjection.ts`, returning eligible detached
   records, availability reasons and withheld-record information. Both
   `buildPlanningInsights` and `projectConceptBrief` consume it. Keep #105's
   investigation/template logic outside this core. Preserve the strict local
   membership behavior required by each caller; any change in partial-selection
   behavior requires explicit review rather than silent relaxation.
3. Delete the duplicated equality, eligibility and identity implementations from
   the two callers. Keep source-unit formatters and canonical contracts unchanged.
   Do not move illustrative fixtures into a scientific package or canonical Brief.
4. Run the source-tampering, candidate/suppressed exclusion, stale-warning parity,
   explicit-selection, and six-goal handoff tests against the shared producer/core.
   Exercise both independent feature flags in all four combinations, including
   navigation, default JSON/PDF, #105's unchecked print opt-in and concept print
   exclusion. Require exact-source and exact-export parity before accepting the
   consolidation.

This bounds the temporary duplication without changing #105's review history or
starting that refactor before its acceptance.

## Evidence and release disposition

The machine-readable integration result and exact executed outcomes are recorded
in `integration-results.json` and `integration-validation.md`. Fresh screenshots,
including tablet and the stale-warning state, accompany the final verification.
Axe incomplete findings are assessed separately from violations; automated checks
are not screen-reader or non-Chromium certification.

This branch remains default-off. Scientific source admission, real AI/provider
activation, privacy/security approval and exact-revision public release decisions
remain separate. No hosting synchronization, Cloudflare deployment, public
activation, external submission or merge is performed by this work.
