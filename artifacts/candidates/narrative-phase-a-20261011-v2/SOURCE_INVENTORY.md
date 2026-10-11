# #26 PR B — Frozen source and rights inventory (candidate-only)

**Baseline:** `e27403af8d878327d28ead2b6f7aeb00657c5239` (merged PR A #79). **Governance:** Gate 1 **NO CURRENT-CONTEXT ADMISSION**, all eight. No scientific sign-off, source release, planning recommendation, source access by AI, loader, React/Brief change or quantitative intervention effect.

## Upload identity versus frozen packet identity

- Directly attached archive: `diagnostic-odyssey-admission-review-complete-20261011(2).zip`, **9,123,144 bytes**, **88 entries**, SHA-256 **`742dd604703f2bd260ea0868c751715c8a19e6e9c664e08560bb1507e1c76c1b`**. ZIP CRC scan passed (`testzip() is None`). The archive remains a conversation attachment and is **not versioned in this repository**, nor proven accessible to an outside reviewer; obtain a secure copy for independent source/rights verification.
- Previous report **`f8f4af4fbb93228db5282619745c91da4c8ac02247c8e2520de94bf15eddb40a`** is **the digest of the v2 packet's `SHA256SUMS`**, verified directly, *not* the whole uploaded ZIP SHA-256. The v1 `SHA256SUMS` digest is `f4cf1a4819c3ca33f8a45271a8a433f4c4a6866c57b0c96c3f1e855234c2b30c`.
- The archive's `verify-archive.py` passed: 45 corrected packet files, 38 original entries, source preimages, v1/v2 subject bindings, and release-deny fields. The packet-local `verify-packet.py` uses an absolute author workstation path and is not relocatable on its own; use `verify-archive.py` on the complete archive instead. Neither proves medical validity, license approval, admissibility or a review signature.
- `frozen-v1/` retains **byte-identical** four original JSON artifacts; `corrected-v2/` retains the **byte-identical** six frozen October 11 narrative JSON artifacts; `verification/` retains exact context/retrieval evidence. Original source PDFs/XML/HTML remain **outside Git** as named ZIP entries (see below); no third-party publications or images enter the web build.
- The root `SHA256SUMS` lists **only repository-retained files** and can be verified with `sha256sum -c SHA256SUMS`; its own digest is `d91caacf64645f7e55ecd4467f492dd148013a526484879ce4b9cda239eda1df`. The original frozen manifests cover different inventories and are never substituted for this Git subset manifest.

## Source archival identity (preserved externally, not committed)

Archive prefix: `final-admission-review-20261011-v2/` + source path below. All SHA-256 values are computed from the actual retained entry bytes and were checked by the complete archive verifier. The retrieval time, URL, and last-modified metadata are from the frozen source index; they are source provenance reports, not fresh retrievals performed by this PR.

| Archive-relative source | Bytes | Source SHA-256 | Retrieval URL | Recorded retrieval (UTC) |
| --- | ---: | --- | --- | --- |
| `narrative/sources/locomotion.pdf` | 820169 | `f86787bf1a5da731b653bd12350d1836e6be847501634fa596d53a4e8075a592` | https://eprints.whiterose.ac.uk/id/eprint/220724/1/1-s2.0-S1470211824054228-main.pdf | 2026-10-11T00:56:26Z |
| `narrative/sources/macewan-publisher.pdf` | 982673 | `f11be189fa8e7a606b98b782be3acecdb55c00457fffa809c12603980a89d688` | https://link.springer.com/content/pdf/10.1007/s11606-024-08622-z.pdf | 2026-10-11T00:57:54Z |
| `narrative/sources/macewan-bioc.xml` | 62926 | `64759b0d0e87af81659a940d9aa95a4505e550e3cbb5a693e2334f0bc4662501` | https://www.ncbi.nlm.nih.gov/research/bionlp/RESTful/pmcoa.cgi/BioC_xml/PMC11169119/unicode | 2026-10-11T00:57:54Z |
| `narrative/sources/macewan-oai.xml` | 71591 | `088a6176d89d007b8a5eaeb765f710fe883ea35f9ae83efadc7842d49d140e21` | https://pmc.ncbi.nlm.nih.gov/api/oai/v1/mh/?verb=GetRecord&identifier=oai:pubmedcentral.nih.gov:11169119&metadataPrefix=pmc | 2026-10-11T00:57:54Z |
| `narrative/sources/locomotion-metadata.html` | 47029 | `c842522047fcd0606b3a9391dd733c9230747bc3af9d15a6d2774c99f5240860` | https://eprints.whiterose.ac.uk/id/eprint/220724/ | 2026-10-11T01:06:53Z |

CDC guidance at `https://www.cdc.gov/long-covid/hcp/clinical-guidance/index.html` (displayed update **March 9, 2026**, original first-published date unverified) has **no retained raw guidance bytes, no archival SHA-256, and no retained raw rights page**. The recorded attempts returned HTTP 403 (including 2026-10-11T03:27:12Z). Web-readable discovery text is **not** a source snapshot. `source_sha256` and `retrieved_at` remain null for both CDC claims. Do not hash denial/error responses, assume U.S.-government publication automatically clears all content for redistribution, or mark either claim releasable.

**Source-specific rights observations, not approvals:** MacEwan publisher PDF p6/journal p1299 reports CC BY 4.0 with third-party-material exceptions; its participant-level data are privacy restricted. LOCOMOTION PDF p1 footer reports CC BY 4.0. The exact retained rights observations, attributions and proposed retention permissions are in `corrected-v2/rights-records.json`, with `independent_rights_decision: null`. No independent legal, rights or scientific decision has been asserted.

## Original-to-corrected reconciliation

- All eight stable claim IDs and source IDs survive unchanged; v1 and v2 catalogs preserve original author/year/DOI/PMCID bindings and source-byte SHA-256 (where available).
- V2 corrects non-equivalent clinical pathway/mechanism labels, supplies more precise passage bindings and explicit observed application context. **Proposed** planning uses for `MAC24-COORD-01`, `LOC24-ACCESS-01`, `LOC24-PATHWAY-01` are downgraded to **`background_context_only`**; all MAC24/LOC24 records are background-only. `LOC24-WAIT-01` was and remains background-only.
- Both CDC entries retain `planning_option_to_investigate` **only as unreleased candidate text**; v2 preparation recommends **defer**. Neither can be used as an actual planning recommendation, because source archiving, rights and independent applicability approval are missing.
- All records retain `release_status: candidate`, `reviewer_status: needs_review`, `approved_claim_wording: null`, no reviewer identity or time and `quantitative_effect_eligible: false`. Both catalogs have `automatic_release: false` and release/applicability manifest digests null. A named PM no-admission disposition is a governance restriction, **not a forged reviewer event**.
- All v2 policy `approved_decisions` and `allow_rules` arrays are empty. Every `proposed_target_context`, `approved_allowed_use`, review identity/time in the eight bindings is null. Missing target setting/payer cannot be repaired by inferring a U.S. payer or importing NHS results.

## Candidate claim/source/locator matrix

| Stable claim ID | Source ID | Primary source locator | Contract use / review / release | Preparation recommendation only |
| --- | --- | --- | --- | --- |
| `CDC26-PC-01` | cdc-long-covid-clinical-guidance-20260309 | What to know, second bullet; Treatment and symptom management | `planning_option_to_investigate` / `needs_review` / `candidate` | defer |
| `CDC26-SUPPORT-01` | cdc-long-covid-clinical-guidance-20260309 | What to know, fifth bullet; Treatment and symptom management, final support bullets | `planning_option_to_investigate` / `needs_review` / `candidate` | defer |
| `MAC24-COORD-01` | macewan-2024-care-coordination | PDF p2 / journal p1295, Methods: Study Population and Setting | `background_context_only` / `needs_review` / `candidate` | revise |
| `MAC24-ACCESS-01` | macewan-2024-care-coordination | PDF pp2–3 / journal pp1295–1296, Results: Access to Care; Fig1 PDF p4 / p1297 | `background_context_only` / `needs_review` / `candidate` | approve_bounded_wording_only |
| `MAC24-REFERRAL-01` | macewan-2024-care-coordination | PDF p2 / journal p1295, Methods: Study Population and Setting | `background_context_only` / `needs_review` / `candidate` | approve_bounded_wording_only |
| `LOC24-ACCESS-01` | darbyshire-2024-locomotion | PDF p4, Table2 Topic1 Access; pp4–5, Access, referral criteria and inclusivity | `background_context_only` / `needs_review` / `candidate` | revise |
| `LOC24-PATHWAY-01` | darbyshire-2024-locomotion | PDF p4, Table2 Topic1; p5, Assessment and care planning, final paragraph | `background_context_only` / `needs_review` / `candidate` | approve_bounded_wording_only |
| `LOC24-WAIT-01` | darbyshire-2024-locomotion | PDF p4, Table2 Topic1 Outcome; p5 first paragraph continuation of Access | `background_context_only` / `needs_review` / `candidate` | approve_bounded_wording_only |

For specific transcribed passages, populations, pathway steps, exact outcomes/limitations, named mismatches and prohibited stronger conclusions, inspect **`corrected-v2/source-claim-matrix.json`** against the retained source documents in the attached archive. The matrix is a frozen prepared transcription; text and interpretation still require independent passage-by-passage adjudication.
