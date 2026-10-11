# Offline planning guidance contracts — #68

**Candidate contract only. No inference, provider egress, source admission, model execution, frontend/backend integration, analyst state mutation, or deployment.** Gate 3 remains blocked. The current narrative release and acquisition-hint registry are both **empty/unavailable**.

Trust layers:
1. `PlanningGuidanceInputV1` contains trusted, reviewed aggregate finding values, distinct selected local context, descriptive analyst assumptions, deterministic Pilot results, warnings, gaps, request templates, and exact version identities. `assertInput` checks shape, bounded arrays and finite numbers. **It cannot independently authenticate artifact bytes.**
2. `VerifiedAuthority` is an application-provided, independently authenticated release/review/applicability or hint-registry/policy allowlist. A caller must verify immutable artifact bytes and human approvals first. Passing syntactically valid SHA-256 strings is **not admission**. Default null authorities fail closed; no release registry is implemented here.
3. `projectEgress` projects only version, snapshot fingerprint, controlled context IDs, selected allowlisted IDs, **planning-option-eligible** claim codes and hint IDs. No personal notes, free-text narratives, numeric values, raw files, source quotations, credentials or PHI. The final provider egress allowlist requires a separate Gate 3 approval.
4. `ModelCandidateV1` is ID-only and strictly bounded, with no source approval, reviewer status, numerical results, explanations, effect sizes, ROI, disposition or write authority. `bindCandidate` resolves independently verified, exact-context **planning-option** IDs against the trusted input and reconstructs authoritative values and **all trusted scientific warnings**. No model field can select, drop, edit or rank warnings; `assertOutput` rejects any omission or alteration. Every proposal starts `pending`, never auto-added to analyst state or Brief export.
5. `PlanningGuidanceOutputV1` is an application-created validated draft with trustworthy copied numbers, version-bound proposal hashes and separate section sufficiency. `unavailable` distinguishes absent/invalid/stale generation from an actual available response.

## Fingerprint and binding

`fingerprint` = `pg1:` + SHA-256(UTF-8 `DiagnosticOdyssey/PlanningGuidanceSnapshot/v1\\n` followed by canonical JSON). Every input field other than the volatile audit `captured_at` is retained, including source/Brief/scenario/local/policy versions **and immutable SHA-256 artifact/content digests**, plus narrative release/review/applicability-policy digests and hint registry/policy digests. The input must pass `assertInput` with independently verified authority before hashing. A provider cannot choose the expected fingerprint.

Canonical JSON sorts object keys by ECMAScript UTF-16 code units (native `Array.prototype.sort`), and every set-like ID sort uses explicitly defined code-unit comparison (`a < b`, `a > b`), never `localeCompare`, represents finite numbers by ECMAScript JSON decimal serialization (negative zero as zero), rejects nonfinite values, and retains ordered array semantics by default. Explicit set-like top-level ID arrays and admission reference/hint arrays are sorted by ID; template field codes are sorted lexicographically. Duplicate IDs fail before normalization. UTF-8 encoding is used; strings are not Unicode-normalized. The schema version is domain separated. Golden snapshot test vectors: baseline `pg1:61fcad8177dc4eebbe2fba04ed7dc092f8d4e464352f6cb5256efdab67103eea`; same fixture with `Z`, `a-a`, `a.a`, `a_a`, `z` warning IDs: `pg1:6ccf8b0e4b719ad8f658ba926748c6c30c0057cf7dc7b13ec708fec3db98a805`. Volatile timestamps are excluded **only** for the content fingerprint, not audit provenance.

Proposal IDs are `pgp1:` + SHA-256 of a domain-separated ordered string including snapshot fingerprint, trusted generation ID, action type and exact admitted reference/review/applicability or request/template/hint registry bindings. Collision and staleness checks are performed before acceptance. These SHA-256 bindings are tamper-evident content identifiers, **not digital signatures or proof of authorization**; upstream authority and current-state checks must be separately authenticated by the application.

A valid 21-estimate reviewed artifact may yield a selected subset of 0–21 ordinary findings; Candidate A secondary medical data never enters this contract. IQR must not be promoted to confidence intervals. Local context cannot adjust national burden; deterministic person-month calculations are not observed or causal benefits.

## Reviewer corrections — explicit admission and mandatory warnings

The currently admitted narrative set remains **empty** and no #23 hint registry exists. Nonempty review references require a separately **authenticated** immutable narrative release SHA-256, review SHA-256, applicability manifest SHA-256, policy version and policy SHA-256, with an exact decision ID and exact eight-dimensional context: condition, cohort, population, setting, payer, geography, pathway step, mechanism. No dimension can be silently wildcarded. Each reference is explicitly `planning_option_to_investigate` or `background_context_only`; the latter may be retained as background but is **never eligible for an AI intervention proposal** or provider-egress reference. A matching hash-shaped string alone grants no authority; `VerifiedAuthority` is an input to be independently authenticated by a future trusted service.

The application must authenticate the `national_release_sha256`, `local_release_sha256` (when present), `brief_content_sha256`, `request_policy_sha256` and `scenario_content_sha256`. The scenario-content digest is the SHA-256 of the **entire canonical authoritative current scenario** (all reach, capacity, timing, alternative window, targets, pathway/mechanism, units and any other actual scenario parameters), independent of the partial values exported to planning guidance. It must be computed and verified against the live deterministic scenario **before** constructing this offline contract, along with the source artifact/policy bytes and selected request state. No claim is made that this package recomputes the scenario or authenticates these digests. The complete input fingerprint includes these digests, excluding only `captured_at`.

All `input.warnings` are mandatory. The untrusted candidate schema has **no warning selection field**. The available trusted output copies the complete input warning set; output validation compares all IDs and exact trusted warning codes, rejecting suppressed/altered warnings. With an unavailable/invalid/stale generation state, no AI-produced output is claimed, and the deterministic Brief retains its own warnings outside this AI output contract.

## Section-state semantics — trusted sufficiency, not model selection

Section availability is **application-derived after trusted input validation**, independently of the model's optional ID selections. An `available` section may contain zero selected findings, intervention options, or request proposals. Such emptiness means *the candidate made no selection/proposal*, **not** that the reviewed evidence or request-template opportunity is absent.

| Available model response | Trusted, validated source of availability | `available` when | `insufficient_evidence` when |
| --- | --- | --- | --- |
| Findings | Reviewed `national_findings` subset | At least one reviewed finding exists, even if candidate selects none | No reviewed finding is in the selected validated input |
| Interventions | Independently authenticated, context-exact `planning_option_to_investigate` admission | At least one eligible reference exists, even if no model option is proposed | No eligible admitted reference; background-only never qualifies |
| Requests | Trusted `request_templates` and validated gap bindings | At least one valid request template exists, even if no request is drafted | No valid request template for this input |

The ordinary reviewed national source bundle still has 21 estimates; a zero-length `national_findings` array means **zero selected findings in this input**, not that the reviewed national bundle has no evidence. The `requests` `insufficient_evidence` value means **no trusted available operational template**, not a claim that there is no scientific intervention effect.

For global `unavailable`, `invalid`, or `stale` generation, **all output sections are `unavailable` and contain no AI-generated content** even if independent deterministic evidence is present. The deterministic Brief remains separate. `assertOutput` recomputes all available-response section states from independently validated application input and rejects false `insufficient_evidence` or false `available`; it does not infer sufficiency from `supported_findings`, `intervention_options` or `draft_requests` lengths.

This scientific relationship is **cross-document**: the standalone output JSON Schema cannot know the independently authenticated input. The Draft 2020-12 schema executes structural checks on both empty-selection/available responses and unavailable responses, while the runtime semantic validator enforces the additional input-to-output invariant. **No state enum, schema property or canonical snapshot representation changed** for this correction, preserving the existing digest vectors.

## Draft 2020-12 validation and scientific semantics

The four closed schemas are `schema/{input,egress,candidate,output}.v1.schema.json` with `additionalProperties:false` on every object, nested bounds, types, version constants and numeric JSON types. `test/schema_draft202012.py` uses the standards-compliant Python `jsonschema==4.26.0` `Draft202012Validator`, including meta-schema checking. This is a **pinned, test-only dependency installed by the workspace test script**, not an application dependency, provider call or evidence loader. Executable schema cases cover structurally valid and malformed instances of all four contracts; TypeScript validators enforce semantics that the schema cannot express, including cross-record duplicate IDs, exact currently authenticated source eligibility, mandatory warning preservation, finite-number rules beyond standard JSON representability, source-value drift, stale snapshots, and application-generated proposal hashes. A JSON Schema pass **never** constitutes scientific admission, a successful model response, or permission to mutate analyst state.

Run `npm ci --no-audit --no-fund`, `npm run typecheck`, `npm test`, `npm run lint` and `npm run build` with Node 22. Schema tests may install the pinned **test** validator; all planning-guidance **production modules** remain network-free.

## Known unimplemented integration requirements

- Independently verified release catalog, exact context-applicability evaluator, and source-byte/provenance admission interfaces (#26).
- Released #23 hint registry and policy interface. Candidate hints must never be treated as admitted.
- Authentication of input/authority, current-state reconciliation, generation ID and timestamp ownership, human accept/reject workflows, second Brief-selection action and export staleness enforcement.
- Provider/model entitlement, hosting, secure server boundary, regional retention, privacy/security and paid API budget decisions under Gate 3.
- Model output textual synthesis and UI layout. This offline contract intentionally accepts bounded IDs only, not untrusted model prose.

All fixtures are synthetic. No new Node production dependencies or workflow files are introduced. The executable Draft 2020-12 test harness installs one pinned Python test-only dependency during the test phase. Run `npm run test --workspace @diagnostic-odyssey/planning-guidance` and `npm run typecheck --workspace @diagnostic-odyssey/planning-guidance`.
