# Deterministic planning insights

This optional, read-only experience summarizes the current validated Planning
Brief. It performs **no live AI inference**, admits no sources, and gives no
clinical recommendation. It is intended for the October 22 demonstration on a
separate feature branch; the October 15 submission artifact is unchanged.

## Architecture and trust boundary

`ArtifactContext` retains ownership of reviewed artifacts, explicit local
selections, applied Pilot state, and request selection. The existing
`buildPlanningBrief` composes the deterministic Brief. An application-local
`buildPlanningInsights` projection then produces `PlanningInsightsModelV1` for
rendering. UI components receive this model rather than reading or mutating
analyst state. The optional projection and rendering share an error boundary,
so an insights error leaves the existing Brief and export controls available.

The model carries section availability, exact record/source IDs, artifact
versions, native values/units/uncertainty, interpretation limits, selected
context, applied assumptions/results, and operational verification prompts.
It is a presentation contract, **not** a scientific model, authenticated source
registry, provider payload, or replacement for `PlanningBrief`.

National findings must pass existing estimate validation and release/display
gates, match the pinned national artifact and context, and exactly match a record
from the trusted loader, including provenance and limitations. Source references
must resolve in that artifact. Local records must match the separately reviewed
WV artifact, its explicit national compatibility allowlist, and the Brief's
selected source version. Unverified records are withheld without substituting
zero or changing valid portions of the Brief. Structural equality does not confer
review authority; the existing reviewed loaders and governance remain required.

The projection copies the applied deterministic result and validates its
scenario/pathway/mechanism binding. It neither calculates nor verifies formulas
independently: the synchronous application producer still owns those calculations.
Future asynchronous input needs separately authenticated current-state binding;
browser-supplied objects cannot become trusted authority.

### Transparent selection rules

- Select at most one highlight per available burden domain, in existing artifact
  order, up to three domains. Prefer a valid reviewed distribution summary, then
  a non-nested finding, then another eligible finding. No measure ID is required,
  and no magnitude ranking or cross-unit score is calculated.
- Reuse the existing capacity, reach and timing sensitivity request templates
  only for the current supported recognition-to-referral/navigation-support
  scope. If the applied result has a positive capacity gap and a capacity template
  is available, surface that prompt first. Otherwise retain stable template order
  without asserting priority. Absence of a modeled capacity gap does not establish
  sufficient local capacity or prioritize timing.
- These are **planning prompts**, not measured local deficiencies, intervention
  recommendations, or empirically established priorities. Possible source owners
  and privacy notes come from existing templates; system availability is unverified.
- Existing request currentness is shown, including stale requests. Viewing a
  prompt never creates, accepts, refreshes, or selects a request. Creation/refresh
  remains in Pilot/Data Requests; Brief inclusion remains a separate action.

## Evidence and future integration

Production narrative references and acquisition-hint release allowlists remain
empty. The intervention surface therefore explains insufficient reviewed evidence
and exact-source, study, applicability, and independent-release requirements. It
does not import candidate catalogs or show fictional studies/citations/effects.
The actual admitted literature reader remains a separately gated #26 follow-up
on the read-only Evidence surface, outside the Brief and narrative exports.

`packages/planning-guidance` stays offline and unmodified. Its ID-only `pg.v1`
contract, golden digests and authority prerequisites are not activated by this UI.
The presentation layer has no provider dependency, credentials, endpoint,
uploads, free-text prompts, or new persistent storage. Candidate A remains isolated
on its existing specialized medical-burden path.

Later, a separately approved server adapter could validate bounded proposals and
project their allowed, source-bound content into the same UI. This requires
authenticated immutable source/review/applicability authority, current scenario
and Brief reconstruction, approved minimal egress, privacy/retention/region and
API entitlement/budget decisions, adversarial tests, atomic proposal disposition,
and separate Brief opt-in. Gate 3a document approval is not Gate 3b implementation
or Gate 3c activation permission. Semantic synthesis would require the separately
governed post-Final EgressV2 design, not silent expansion of V1.

## Availability, print and rollback

`VITE_PLANNING_INSIGHTS_PREVIEW=off` removes the preview, its Overview/Evidence
entry points and optional print controls at build time. Default is on for the
feature branch. This is public configuration, not a secret. The screen hide
control is session-local and creates no analyst state.

The PDF summary is **off by default** and requires an explicit checkbox. It
renders a separate print-only projection of reviewed highlights, up to two
explicitly selected local records (with a complete-selection pointer), applied
assumptions/results and all Brief warnings. Universe, denominator, uncertainty,
source locator and record identity travel with national highlights. Planning
assumptions and their warnings stay together. Current tested examples add two
summary pages; page counts vary with content. Investigation prompts and
intervention options never enter this summary. Canonical JSON is unchanged.
Existing print disclosure preparation/restoration remains intact.

Opt-in summary mode uses native CSS page-margin footers with the national
artifact identifier and page counts, avoiding fixed-footer collisions in long
documents. The default print path retains its existing footer. Page-margin boxes
are supported in Chrome 131+ ([Chrome documentation](https://developer.chrome.com/blog/print-margins));
other print engines require independent verification.

To roll back this feature, use the disabled build or revert its feature commits
through normal review. This is not a claim that any historical Cloudflare
deployment is a certified production recovery target.

## Release boundaries

Verified starting main: `5cc772a198f86a92866bf14cb4ad545ff583200e`.
Existing PRs #94/#102/#103 and their ownership remain untouched. This feature
does not close #23, #26, #68 or #100 and does not resolve their admission gates.

Read-only Cloudflare discovery found production branch
`demo/deploy-ready-2026-10-06-b99d1c70`, GitHub static HEAD
`29aca3f095e7b1033b498c451841eaceb2b0c759`, no configured Git source, and
ad-hoc production deployment `8f807c90-63a3-435c-b197-3b95eeb0f405` with blank
commit hash. These are inventory facts, not source/build/served parity proof.

Independent exact-revision scientific/export/accessibility/security review and
explicit authorization remain prerequisites for merge or static synchronization.
After authorization, rebuild the approved source SHA with clean Node 22/npm ci,
verify reviewed-artifact identity and every payload file hash, and use an ordinary
non-force child commit preserving the configured static branch's history. Check
the resulting payload byte-for-byte and report source/static SHAs and manifests.
GitHub synchronization does not deploy this Direct Upload project. Cloudflare
deployment, configuration changes and external submission need separate authority.

See [validation](validation.md), [screen captures](screenshots/), and the
[actual opt-in PDF example](example-summary.pdf).
