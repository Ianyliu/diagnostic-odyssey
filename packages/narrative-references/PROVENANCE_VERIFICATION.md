# Offline provenance-verification specification (non-admission)

This is a **synthetic-test and independent-review specification**, not a narrative loader or scientific/release approval. It complements the frozen narrative schema without modifying that schema, the runtime validator, real source artifacts, or admission policy. Execute:

```bash
python3 -m unittest discover -s packages/narrative-references/test -p test_provenance.py
python3 packages/narrative-references/test/verify_provenance.py /retained/offline/root /retained/offline/root/provenance-companion.json
```

## Retention layout and companion fields

Put the **original retrieved source response bytes** (PDF bytes, HTML bytes, or plain-text original response) under a private immutable retention root, never in public web assets. A single exact `archive.path` is a relative path inside that root; `archive.sha256` is a lowercase SHA-256 of **the retained raw bytes**, not the URL or normalized extracted text. Record `retrieval_id`, `retention_id`, `retrieved_at`, `source_id`, original URL, `retained_format: original_response_bytes`, `media_type`, and `source_sha256`. An independent verifier must supply the root and retrieve every byte without a network request. A mutable URL cannot substitute for the retained bytes.

A separate rights/license record, also pinned by `record.path` + `record.sha256`, carries source ID, retrieval ID, retention ID, explicit record ID and status (`documented_permission`, `documented_license`, `unresolved`). **This verifier checks retention and integrity, not legal sufficiency or authenticity of permissions.** Source claim records must bind exact `source_id`, `source_sha256`, `retrieved_at`, and URL to the companion's source archive. Claim IDs must be unique.

Each companion has exactly these keys:

```json
{
  "state": "candidate",
  "candidate": {"path": "catalog/candidate.json", "sha256": "lowercase-sha256-of-actual-bytes"},
  "sources": [{
    "source_id": "synthetic-source", "retrieval_id": "synthetic-retrieval",
    "retention_id": "synthetic-retention", "retrieved_at": "2026-10-11T09:00:00Z",
    "url": "https://example.invalid/source",
    "retained_format": "original_response_bytes", "media_type": "text/plain",
    "source_sha256": "lowercase-sha256-of-archived-source-bytes",
    "archive": {"path": "archive/source.txt", "sha256": "same-source-digest"}
  }],
  "rights": [{
    "source_id": "synthetic-source", "retrieval_id": "synthetic-retrieval",
    "retention_id": "synthetic-retention", "record_id": "synthetic-rights",
    "status": "unresolved",
    "record": {"path": "rights/record.json", "sha256": "digest-of-actual-rights-record-bytes"}
  }],
  "review": null,
  "applicability": null,
  "release": null
}
```

The example intentionally gives digest descriptions, **not fake real SHA-256 values**, and is explanatory, not executable input. Test cases dynamically hash synthetic bytes on disk.

### Candidate vs reviewed release

- **Candidate**: require a separately retained candidate catalog with manifest status `candidate` and both review/applicability digest fields `null`; no release, applicability or review companion may be claimed. Candidate records cannot assert `reviewed_released`. Verification returns `admitted: false`.
- **Reviewed release, as an offline structural fixture only**: require nonempty candidate snapshot, non-unresolved rights statuses, a retained review decision file, a retained separately versioned applicability decision file, and retained release catalog. Review manifest binds the exact *pre-promotion* candidate SHA-256, catalog ID, unique exact claim IDs, reviewer identifier/timestamp and approved disposition. Applicability manifest binds the candidate and review file digests, its own version and exact claim IDs. Released catalog pins the actual review and applicability digests and matches catalog ID, claim IDs and source identities; every record must be approved and marked released. This avoids circular self-digests by hashing the pre-promotion candidate rather than the release containing review digests.
- **Fail closed**: missing archives, path traversal/symlink escape, digest mismatches, missing rights, changed retrieval identities, duplicate source/claim IDs, missing or altered manifest bytes, mismatched candidate/review/applicability identities and missing approval fields stop verification. No network or state mutation occurs.

**Limitations requiring independent review before any real admission**: this minimal companion verifier does **not** authenticate human reviewer identity/authority or signed decisions, does not determine copyright/license adequacy, does not independently confirm source locator text and clinical applicability, does not prove archive storage immutability or trust in a supplied companion/retention root, does not validate a released catalog against the separate v1 JSON Schema, does not check the full real-world source-to-claim adjudication evidence, and does not verify an external release allowlist. The fixture may assert `approved` *only as synthetic test structure*. Therefore even successful `reviewed_released` byte-chain verification always returns `admitted: false`. A future separately authorized promotion verifier must add those scientific, governance, and authoritative release checks.

## Review surface

The independent **scientific reviewer** should review the fidelity of source identity, independent applicability manifest semantics, rights sufficiency, and cross-document obligations before this can be considered adequate for a real promotion workflow. The overall PM alone controls integration/merge authorization. Do not consume any fixture as approved evidence or enable automatic promotion, UI, AI, exports, ROI/effects or scenario inputs.

## October 11 independent-review corrections — companion v1 test semantics

**Rights-content binding.** The retained rights-record JSON itself MUST contain exactly `source_id`, `retrieval_id`, `retention_id`, `record_id`, `status`, and a nonempty `evidence_note`. The verifier cross-checks those five identity/status fields against the companion and the linked source retention identity. Changing companion status without changing the retained record is rejected. A legitimate `unresolved` value in both locations is still rejected for a purported release. These are only structural/integrity checks: neither status nor evidence note establishes valid legal permission, document authenticity, or license adequacy.

**Claim-level review binding.** `review.claim_decisions[]` must contain exactly one entry for each candidate claim ID. Each decision retains `claim_id`, `source_id`, archived `source_sha256`, exact `approved_claim_wording`, `causal_use_class`, `allowed_use`, complete `limitations`, complete `prohibited_stronger_claims`, complete `applicability`, and `review_note`. All exact values must match the released record, and reviewer ID/time must match the retained decision file. Review-specific use/class/applicability fields must also match the preserved candidate. Neither proposed candidate wording nor a matching claim ID constitutes approval.

**Exact-context policy binding.** The retained versioned applicability file now requires `context_decisions[]`. Each entry records exactly `claim_id`, `catalog_id`, `source_id`, `context`, `allowed_use`, and `decision` (`applicable` or `not_applicable`). The context object has exactly the seven explicit string fields `population`, `condition_definition`, `setting`, `payer`, `geography`, `pathway_step`, and `mechanism`. Every field must exactly equal the corresponding field in the retained claim-level review decision. `allowed_use` must also equal the reviewed claim use. Every released claim must have at least one explicit context decision; duplicate tuples are rejected. Empty values, `*`, `any`, `all`, `unknown`, `not reported`, `unspecified`, and equivalent explicit placeholder values are forbidden. This does not infer payer, treat empty context as a wildcard, approximate a match, or authorize cross-system transfer. It also does **not** establish scientific validity of an applicability decision.

**Synthetic end-to-end evidence.** `test/test_provenance.py` imports the previously committed 34-case fixture suite to construct real on-disk SHA-256 preimages, candidate snapshots and releases. Positive candidate, approved-not-released, rejected and released catalogs are executed against the actual Draft 2020-12 JSON Schema **and** the existing TypeScript runtime validator using Node 22, then checked against their offline retained bytes. Additional tests mutate rights fields, reviewed wording, intended use, limitations, disallowed contexts, manifests and files without weakening those validators. The 34 original differential fixtures and their three intentionally documented divergences remain unchanged.

**Trust and output boundary.** Even a structurally matching retained rights status is not a grant of rights. Even a byte-consistent review decision is not an authenticated independent human reviewer. Even an exact-context policy record is not an actual applicability determination. This verifier does **not** itself run the catalog validators (the tests do), validate source-locator contents, verify real-world copyright permissions, validate reviewer authority, verify immutable retention storage, or consult an external release allowlist. Its success result is confined to byte/identity and internal synthetic decision consistency; `admitted` is always `false`. No substantive scientific admission, runtime use, recommendation, or promotion is authorized.
