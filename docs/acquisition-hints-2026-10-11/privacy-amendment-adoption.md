# #23 Gate 2 — verified raw reviewer amendment and PM adoption

**Status:** PM-authorized correction of existing PR #98 only. Unmerged,
candidate-only, no clinical/administrative/privacy officer signature, no release.

On October 11, 2026 the directly uploaded raw archive
`issue23-independent-review-20261011(1).zip` (11,321 bytes;
SHA-256 `c5fec9120f0e14c330c42b3591e8b8099cef5f18e7a0e7b7579fc65597b48b69`)
was inspected as a ZIP, safely extracted, and each of the amendment files
independently hashed before GitHub modifications. The exact JSON content stored
in the new three separately versioned review-input files was regenerated from
the existing original JSON and the byte-verified changes, with all three new
SHA-256 values matched **before commit**. The reviewer decision is an unsigned
AI-assisted review; project-owner adoption is not institutional release consent.

| Preimage | Original (remains immutable) | Separate amended candidate |
| --- | --- | --- |
| Mapping | `9a117d4a2a5ac1c51d1b8d559fb617be4635306767d21ae06d3ee54668989866` | `5a6ff02ec024f200a785e960a5fea20ef74dae356c4c59a5b5f962411dd05604` |
| Context policy | `2c4370d84f6024157a3f645c6b2c8da3d0691a254dc9407226d81d1abb94e64f` | `5531c472aa795f4c1a4058d35ccf5541ab21832c687f43062b971f0331fb6742` |
| Review subject | `db919797d7e2dd42cd6c44e8154ccd434181bc3de27009931504124721efb436` | `2f747438ed3435927eb7b0a4b4ce2062138b73ca7ae4eda5fd2bc850d891fab2` |
| Unmodified source index | `0c607a5ef437b40bbdc599a8a74dbcb887f1f369fef4ca0506f782dd20af53ce` | The identical digest |

The adopted amended timing wording is the exact local-steward aggregate-only
interval-distributions/episode-count wording from the independently supplied
`REVIEWER-DECISION.md`. Raw patient/episode dates, linkage, identifiers and
record-level outputs remain under local steward control. Rare cells, overlapping
strata and differencing risk require case-specific local review; no invented
threshold or implied disclosure approval.

The frozen capacity `proposed_guidance_wording` has not changed. Its original
candidate privacy footnote used an ambiguous aggregate/de-identified shorthand.
The production renderer/Brief-facing *effective* guidance projects that exact
footnote to an explicit aggregate-only prohibition on record-level releases,
without mutating the original reviewed bytes. The actual amended mapping bytes
retain unchanged capacity content, respecting the independent review decision.

## Strictly withheld production release

Only `ACQ26-TIMING-01` v2 and `ACQ26-CAPACITY-01` v2 are considered,
respectively for alternative-window and capacity sensitivity families. Reach,
nine superseded IDs, unreviewed sources and automatic acquisition are excluded.

The amended mapping has `released=false` and `approved_hint_ids=[]`. The
amended policy has `approved_decisions=[]`. Its review subject remains unsigned
(`actual_independent_review=null`). No registry bytes or digest allowlist are
supplied to `acquisitionResolver`. Fake release flags and caller-provided
snapshots cannot grant production display/export privileges.

The user/PM directed correction of this existing PR only. No EHR integration,
record transfers, local vendor guarantee, quantitative evidence, arithmetic,
base request template or scenario fingerprint change, #26 admission,
#68 dependency gate, merge, deployment, static synchronization or closure.

## Verification and release-gate accounting

- The pre-amendment browser/JSON/PDF report in `validation.md` is historical
  and is **not** proof of checks on an amended HEAD.
- Amended source hashes, original retention, synthetic positive and adversarial
  negative tests are checked by `packages/acquisition-hints/test/` and
  `packages/brief-core/test/` in GitHub CI.
- Exact HEAD must pass Node 22 install, workspace tests, typecheck, lint,
  production build, Python contract suite, immutable artifact checksums and
  synthetic R tests.
- Rendered desktop/mobile, light/dark and print/JSON/PDF must be re-executed
  after modifications; retain limitations rather than infer a pass.
- A substantive exact-head Jules review is needed; an earlier draft-skipped
  green workflow is not review authority.

Independent scientific/privacy applicability, genuine institutional review,
review/release identity binding, separately authorized nonempty registry
and allowlist, full session integration acceptance, and PM merge authorization
remain outstanding.
