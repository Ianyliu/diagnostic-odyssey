# Reviewed acquisition guidance (#23)

**Nothing is admitted.** The production resolver has no release bytes and an empty
allowlist. Both v2 proposals remain candidate material. The owner authorized an
unmerged implementation PR, not admission, merge, data collection or deployment.
Reach is omitted. Narrative references are a separate family and have no consumer here.

## Exact review inputs

`review-inputs/` retains unchanged UTF-8 preimages from the frozen corrected v2
packet, including the official FHIR R4 4.0.1 definitions and license. These files
are verification inputs, not browser imports. Tests check every retained hash,
each source-index binding and the B review-subject identity:

`db919797d7e2dd42cd6c44e8154ccd434181bc3de27009931504124721efb436`

The independent unsigned assessment and owner adoption are separately retained in
`docs/acquisition-hints-2026-10-11/`. The original packet state fields are unchanged.
Neither an AI assessment nor a structurally valid `approved` field authenticates
an independent reviewer or grants release authority.

## PM-adopted independent privacy amendment (candidate-only)

The original frozen v2 inputs above remain byte-identical and must not be renamed,
rewritten or promoted. The separately retained reviewer-proposed amendment files are:

- `review-inputs/mapping-candidates.privacy-amendment-1.json`
  SHA-256 `5a6ff02ec024f200a785e960a5fea20ef74dae356c4c59a5b5f962411dd05604`
- `review-inputs/context-policy.privacy-amendment-1.json`
  SHA-256 `5531c472aa795f4c1a4058d35ccf5541ab21832c687f43062b971f0331fb6742`
- `review-inputs/review-subject.privacy-amendment-1.json`
  SHA-256 `2f747438ed3435927eb7b0a4b4ce2062138b73ca7ae4eda5fd2bc850d891fab2`

The independent reviewer decision is unsigned AI-assisted technical review, not
institutional privacy approval or a release signature. PM adoption authorizes
candidate-only correction of existing PR #98 and aggregate-only wording, not
production admission. The mapping still has `released: false` and zero
`approved_hint_ids`; policy has zero `approved_decisions`. The real resolver
remains `createAcquisitionResolver(null, Object.freeze([]))` and no approved
registry/release bytes exist.

The revised timing output requires steward-approved aggregate distributions and
counts after overlapping-strata/rare-cell/differencing assessment; raw person-
or episode-level dates, identifiers and joins remain locally held. The exact
capacity `proposed_guidance_wording` is unchanged. Its older source privacy
footnote remains intact in the historical candidate record, while the **effective
rendered/exported** privacy note replaces the permissive "aggregate/de-identified
outputs only" description with aggregate-only restrictions. This projection is
explicit, tested and cannot change the hash of the historical source record.
No base DataRequest template, fingerprint, scenario arithmetic or Brief opt-in
semantics changed. Prior synthetic fixture assertions are now run against the
adopted amended candidates, never a claimed production review.

## Canonical release boundary

`createAcquisitionResolver` is a trusted composition-root API. Its allowlist is
code/release configuration that requires independent approval. Never obtain it,
release bytes or a resolver from request payloads, Brief JSON, URLs, browser storage
or external input. The default public application/core functions use only the
empty production resolver. The separate test fixture uses an explicitly synthetic
actor and cannot enable production guidance.

The acyclic chain is retained mapping/source index/application-context preimages
→ exact context policy → independent mapping/privacy/context/release review →
registry → separately authorized registry-digest allowlist. Registry bytes pin
mapping, policy, source-index and review digests. Policy bytes pin the application
context record, which pins the exact immutable ArtifactBundle bytes. The resolver
verifies those preimages and strict ArtifactBundle validation before any guidance.
Retained official source bytes are checked offline in the normal unit suite;
they are not shipped to the browser. Source rights, reviewer authority and the
actual approval evidence remain independent admission checks, not hash semantics.
No preimage contains its own digest. Every changed dependency requires a new
registry identity and independently authorized allowlist entry.

The future release-review format requires separately attributable identity, time,
evidence URL, code commit, exact subjects and per-hint mapping/privacy/context/
release decisions. It deliberately rejects the actual unsigned assessment as
release evidence. Future approved releases may admit a subset of the two hints.
This PR does not create a genuine release review, registry or allowlist entry.
Any eventual release packaging change remains separately reviewable; it must not
silently reclassify the frozen candidate state or alter reviewed wording.

## Request and export policy

The optional closed `DataRequest.acquisition_hint` contains identities only.
Its fingerprint is SHA-256 of canonical JSON containing every base request field,
the complete current scenario (including identity/assumption refs), and exact
analysis context. Arrays retain order; object keys sort; non-JSON values fail closed.
Legacy base-template equality/currentness is unchanged. Hint identity has separate
currentness, so invalid optional guidance does not invalidate a valid base request.

Strict request/artifact validation rejects malformed optional references. At the
runtime/export boundary, `sanitizeBaseDataRequest` projects recognized base fields
and validates them unchanged. Invalid base data still throws. The resolver retains
only an applicable canonical reference, never caller snapshots or unknown metadata.
States distinguish pending admission, available-to-attach, reviewed, invalid/stale
reference, mismatched context and unavailable release artifacts. No fuzzy matching,
wildcard, similar label or missing-context fallback grants applicability.

Brief construction and serialization repeat base validation, scenario currentness
and canonical resolution. Serialization projects known Brief fields and reconstructs
companion `acquisition_guidance` from the current registry; previously resolved or
forged companions are discarded. Guidance pins the exact reference/fingerprint and
retains approved wording, source locators/hashes, review and policy provenance.
Legacy requests/Briefs without hints retain their previous shape and behavior.
Invalid optional metadata is withheld with an explicit warning; valid base requests
remain. Scenario-stale requests and companions are excluded until explicit refresh.

`createBriefCodec` supports trusted composition-root test/release configuration;
it is never selected by payload content. Default exported constructors/serializers
always use the production resolver. The same codec logic is tested against synthetic
admitted entries, forged companions, absent/unknown references and changed policies.

Attaching/removing guidance updates a session copy and leaves Brief selection alone.
Refreshing a stale base request clears the previous hint; attaching current guidance
is a separate explicit action. Reviewed ArtifactBundle objects are never enriched
in place. Selecting local context changes Brief applicability and withholds guidance
under the frozen exact-context policy, while retaining the base request.

## Privacy and scientific limits

Use the PM-adopted aggregate-only candidate amendment for future separately
approved releases. The original frozen v2 bytes are historical preimages, not
current acquisition permissions. Exact capacity proposal wording remains frozen;
its older ambiguous privacy footnote is superseded at the guidance projection
boundary. The adopted timing proposal explicitly forbids record-level outputs.
The mandatory `privacy_boundary` disallows individual intervals, raw dates,
identifiers and patient/employee records entering the application. No upload, API call,
data acquisition or backend is implemented. Local stewards retain release authority
and must review small cells, overlapping strata, differencing, workflow definitions
and vendor support. No invented disclosure threshold or interoperability certification.

Order activation, appointment creation, planned occurrence and completed encounters
remain distinct. Slot/Schedule availability does not supply staffed capacity, FTE,
unique people, catchment or derived wait times. No guidance changes scenario arithmetic,
calibrates planning windows or becomes intervention-effect evidence.

## Remaining gates

Independent exact-HEAD contract/export/privacy/implementation review; any required
human/institutional privacy disposition; separately authorized exact-byte admission
and release allowlist; merge authorization. Production guidance remains withheld
until all applicable admission conditions are independently recorded. #26 Phase A
remains unshipped; #68, static synchronization and production deployment are excluded.
