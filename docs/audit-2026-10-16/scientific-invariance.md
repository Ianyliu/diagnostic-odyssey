# Scientific invariance

**Result: unchanged against `0ad2c55db55d23c1f1b35b5e57db89f5fc0ba886`.** This comparison verifies preserved outputs; it is not an independent re-estimation or new review of the underlying science.

The existing governed capture/comparison scripts were run against the pinned baseline and the candidate. No reviewed artifact, scenario-engine implementation, evidence-admission contract or Brief serializer was edited.

| Boundary | Compared | Result |
| --- | --- | --- |
| Reviewed national burden | All 21 MEPS estimates and their metadata | Identical |
| Local implementation context | All 34 West Virginia indicators | Identical |
| Descriptive Typical Ranges | Both admitted distribution summaries, including methods, sample sizes, weights and limitations | Identical |
| Reviewed artifacts | SHA-256 for all 27 reviewed files; 23 manifest entries verified | Identical |
| Scenario arithmetic | 11 governed scenarios covering defaults, capacity limits, horizon caps, precision, rounding, near-zero/near-one reach and zero cases | Identical |
| One-way sensitivity | Reach, capacity and recognition-window tables for all 11 scenarios | Identical |
| Canonical export | Three fixed-time governed Brief snapshots | Identical |
| Browser state transitions | Default/selected/stale/refreshed Brief and all three sensitivity tables | Compared separately; only top-level execution `generated_at` is excluded |

The two descriptive ranges remain:

| Measure | 25th percentile | Median | 75th percentile |
| --- | ---: | ---: | ---: |
| Gross all-cause national spending · dollars | 1,116 | 3,624 | 14,840 |
| Annualized ESAQ paperwork/navigation time · hours | 0 | 3 | 12 |

These interquartile ranges are not confidence intervals, attributable costs, diagnostic-delay durations or intervention effects. Their full source limitations remain in the reviewed artifact and exports.

## Reproducible hashes

| Governed section | Baseline and candidate SHA-256 |
| --- | --- |
| Invariants | `d56b9de581ee40c247fbf713952e898b5586354c3bd3a95d069bee9259aaa45d` |
| Scenarios and sensitivities | `100dfff71843619f40063e6655ee945a4046cd2b20301d813703fc5541cb44b8` |
| Fixed-time Briefs | `9640cb8696bc397db2c6897680c0428f44bdf8b5af68c7fe81da325603945447` |
| Reviewed-file checksums | `d99fcf7c180ffb26b6f13da4e6ac7f7c540d8b917da6512aba5b712c6fb12f05` |

See [the governed comparison](evidence/scientific-invariance.json), [baseline capture](evidence/baseline-governed.json), [candidate capture](evidence/candidate-governed.json), and [browser comparison](evidence/browser-invariance.json).

## Export and AI boundaries

The existing handoff suite compares the full canonical payload—including its timestamp when taken from the same Brief instance—and complete downloaded Markdown bytes for all six goals. The integration matrix separately verifies regeneration and canonical content across all feature combinations. JSON download feedback no longer recomposes the Brief.

Browser print keeps the substantive Brief, source locators and interpretation boundaries. Printed Insights remain opt-in and separate from the canonical payload. The handoff dialog is excluded from print. Actual PDFs are checked for extracted content and footer collisions; this does not establish tagged-PDF accessibility.

The separate PR #113 compatibility checkout also preserves all governed hashes. Its literature demonstrations remain illustrative, outside reviewed evidence admission, scenario parameters and canonical reviewed findings.

The audit preserves national burden versus local context, observations versus assumptions, gross versus attributable cost, resources versus savings, deterministic sensitivity versus causal effects/forecasts, and missing/suppressed/unreleased values versus zero. No provider call or paid-token operation is introduced.
