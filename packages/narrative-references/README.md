# Narrative intervention references v1 — PR A contract (Issue #26 Phase A)

**Status:** contract only. No source has been reviewed, admitted, packaged, loaded, displayed, cited by AI or promoted by this PR.

## Architectural isolation

`@diagnostic-odyssey/narrative-references` is an independent workspace. It has **no dependencies** and does not import/re-export `ArtifactBundle.evidence`, `EvidenceRecord`, `@diagnostic-odyssey/evidence-core`, `canDriveScenarioParameter`, `BoundedEffect`, `@diagnostic-odyssey/scenario-engine`, `@diagnostic-odyssey/brief-core`, or the web app. The existing quantitative effect ledger remains empty and unchanged.

Only contracts, strict runtime validation, a closed Draft 2020-12 JSON Schema, negative tests and these rules are introduced. This package is **not** a runtime evidence loader and must not itself confer admission. Type assertions, a JSON document setting `reviewer_status: approved`, or passing schema validation cannot establish genuine independent human review.

## Structure

The catalog has a manifest and zero or more records. The manifest explicitly declares the distinct family `narrative_intervention_references`, schema version `1.0`, catalog release status, version identifier, generation timestamp, code provenance and review-manifest SHA-256, plus literal `automatic_release: false` and `quantitative_effect_eligible: false`. A catalog may be a *candidate* or *reviewed_released*. A release catalog must be nonempty and consist entirely of reviewed-released records.

Each claim record includes:

- Stable claim ID (for example the selected **candidate** IDs CDC26-PC-01, CDC26-SUPPORT-01, MAC24-COORD-01, MAC24-ACCESS-01, MAC24-REFERRAL-01, LOC24-ACCESS-01, LOC24-PATHWAY-01; **none is released by this PR**).
- Bibliographic source identity, authors, year, DOI/PMCID when available, HTTPS URL, at least one exact section/table/page/paragraph/figure/web-heading locator, retrieval timestamp and SHA-256 hash of the exact archived source bytes.
- Proposed claim wording distinct from human-reviewer-approved wording; explicit prohibited stronger claims and limitations.
- Applicability by population, condition definition, setting, payer, geography, pathway step and mechanism, including explicit mismatch/transferability limits.
- Non-effect causal/use classification: clinical guidance, qualitative experience, observational pathway description or noncausal service evaluation.
- Allowed use: `planning_option_to_investigate` or `background_context_only`. **Background-only is not a recommendation permission.**
- Reviewer status, reviewer identity/time/notes and independent release status.
- The **required** literal `quantitative_effect_eligible: false`.

The contract does not include an effect value, estimate, interval, parameter, cost saving, ROI, or a scenario binding. All JSON objects are closed; extra fields are rejected throughout, including nested provenance and applicability. `null` is permitted only where explicitly typed.

## Promotion is a distinct, future human-governed step

The validator enforces minimum structural gates for `reviewed_released`: approved reviewer state and approved wording, source digest and retrieval timestamp, reviewer identity and timestamp, explicit limitations and prohibited stronger claims, a valid 40-hex code commit and a SHA-256 review-manifest digest. It also disallows released records inside a candidate catalog and prevents `rejected` records from carrying approved wording.

These checks **do not verify** authenticity of a claimed reviewer, physical archive bytes, locator text, hash preimages or immutable Git retention. PR B must independently retrieve/inspect precise source passages, adjudicate each selected claim, verify applicability and stronger-claim exclusions, preserve source byte snapshots and hash them, obtain reviewer sign-off, and promote only a separately approved immutable artifact. These are external scientific/governance controls, not substitutions for schema validation.

`LOC24-WAIT-01` is background-only under the current decision and must not be quietly admitted as an intervention effect. Other background material does not become a planning-option recommendation merely by being cited. Zero quantitative intervention effects are authorized.

## Use and fail-closed expectations

- Validate untrusted JSON with `validateNarrativeReferenceCatalog(unknown)`, inspect **all** returned path-specific issues, and fail closed; or call `assertValidNarrativeReferenceCatalog(unknown)` to throw on an invalid catalog.
- The checked TypeScript type alone is not validation. Never use `as NarrativeReferenceCatalog` to bypass runtime checks.
- Validated shape is **not** scientific admission. The future reader must verify independently promoted artifact identity, reviewer authority and release allowlist before any display or AI citation.
- A future user-facing recommendation must require `reviewed_released`, reviewer-approved wording, `allowed_use: planning_option_to_investigate`, and target applicability; background-only must not be promoted to recommendation text.
- A narrative reference must never be transformed or coerced into `EvidenceRecord` or passed to `canDriveScenarioParameter`. A stronger policy should keep narrative sources out of the existing Brief until its independent export rules have been reviewed.

## Local test commands

```bash
npm run typecheck --workspace @diagnostic-odyssey/narrative-references
npm run test --workspace @diagnostic-odyssey/narrative-references
npm run typecheck
npm test
npm run lint
npm run build
```

Normal PR CI also verifies reviewed artifact digests and executes synthetic R analysis. No real-data workflow should be dispatched for this package.
