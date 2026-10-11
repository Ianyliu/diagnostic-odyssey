# Offline planning guidance contracts — #68

**Candidate contract only. No inference, provider egress, source admission, model execution, frontend/backend integration, analyst state mutation, or deployment.** Gate 3 remains blocked. The current narrative release and acquisition-hint registry are both **empty/unavailable**.

Trust layers:
1. `PlanningGuidanceInputV1` contains trusted, reviewed aggregate finding values, distinct selected local context, descriptive analyst assumptions, deterministic Pilot results, warnings, gaps, request templates, and exact version identities. `assertInput` checks shape, bounded arrays and finite numbers. **It cannot independently authenticate artifact bytes.**
2. `VerifiedAuthority` is an application-provided, independently authenticated release/review/applicability or hint-registry/policy allowlist. A caller must verify immutable artifact bytes and human approvals first. Passing syntactically valid SHA-256 strings is **not admission**. Default null authorities fail closed; no release registry is implemented here.
3. `projectEgress` projects only version, snapshot fingerprint, controlled context IDs, selected allowlisted IDs, claim codes and hint IDs. No personal notes, free-text narratives, numeric values, raw files, source quotations, credentials or PHI. The final provider egress allowlist requires a separate Gate 3 approval.
4. `ModelCandidateV1` is ID-only and strictly bounded, with no source approval, reviewer status, numerical results, explanations, effect sizes, ROI, disposition or write authority. `bindCandidate` resolves exact approved IDs against the trusted input and reconstructs authoritative values and warnings. Every proposal starts `pending`, never auto-added to analyst state or Brief export.
5. `PlanningGuidanceOutputV1` is an application-created validated draft with trustworthy copied numbers, version-bound proposal hashes and separate section sufficiency. `unavailable` distinguishes absent/invalid/stale generation from an actual available response.

## Fingerprint and binding

`fingerprint` = `pg1:` + SHA-256(UTF-8 `DiagnosticOdyssey/PlanningGuidanceSnapshot/v1\\n` followed by canonical JSON). Every input field other than the volatile audit `captured_at` is retained, including source/Brief/scenario/local/policy versions and narrative release/review/applicability digests and hint release/policy digests. The input must pass `assertInput` with independently verified authority before hashing. A provider cannot choose the expected fingerprint.

Canonical JSON sorts object keys lexicographically, represents finite numbers by ECMAScript JSON decimal serialization (negative zero as zero), rejects nonfinite values, and retains ordered array semantics by default. Explicit set-like top-level ID arrays and admission reference/hint arrays are sorted by ID; template field codes are sorted lexicographically. Duplicate IDs fail before normalization. UTF-8 encoding is used; strings are not Unicode-normalized. The schema version is domain separated. Volatile timestamps are excluded **only** for the content fingerprint, not audit provenance.

Proposal IDs are `pgp1:` + SHA-256 of a domain-separated ordered string including snapshot fingerprint, trusted generation ID, action type and exact admitted reference/review/applicability or request/template/hint registry bindings. Collision and staleness checks are performed before acceptance. These SHA-256 bindings are tamper-evident content identifiers, **not digital signatures or proof of authorization**; upstream authority and current-state checks must be separately authenticated by the application.

A valid 21-estimate reviewed artifact may yield a selected subset of 0–21 ordinary findings; Candidate A secondary medical data never enters this contract. IQR must not be promoted to confidence intervals. Local context cannot adjust national burden; deterministic person-month calculations are not observed or causal benefits.

## Known unimplemented integration requirements

- Independently verified release catalog, exact context-applicability evaluator, and source-byte/provenance admission interfaces (#26).
- Released #23 hint registry and policy interface. Candidate hints must never be treated as admitted.
- Authentication of input/authority, current-state reconciliation, generation ID and timestamp ownership, human accept/reject workflows, second Brief-selection action and export staleness enforcement.
- Provider/model entitlement, hosting, secure server boundary, regional retention, privacy/security and paid API budget decisions under Gate 3.
- Model output textual synthesis and UI layout. This offline contract intentionally accepts bounded IDs only, not untrusted model prose.

All fixtures are synthetic. No new dependencies or workflow files are introduced. Run `npm run test --workspace @diagnostic-odyssey/planning-guidance` and `npm run typecheck --workspace @diagnostic-odyssey/planning-guidance`.
