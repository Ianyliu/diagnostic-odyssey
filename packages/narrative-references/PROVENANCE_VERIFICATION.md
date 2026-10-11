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
