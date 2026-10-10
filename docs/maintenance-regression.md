# Governed maintenance regression — October 10, 2026

Before: source `b99d1c703226009f2004a06a332174124fbfd8a3`. After: numerical PR80 `b2134c4b136d598868dcfb0e8b8b62d92e495aa7` (all 12 reviewed file blobs match the local after checkout). Node22.23.3, npm10.9.9. These are deterministic engineering checks; they do not admit new scientific evidence or complete rendered-browser Gate0.

**Result: exactly unchanged.** Eleven representative valid scenarios, 150 one-way sensitivity points, all three actual serialized Brief JSON companions, and every one of 27 reviewed files match byte for byte. The 23 checksums in all four reviewed manifests also pass. Both full snapshots have SHA256 `2cc126c18bbc2e191bae3e2d6bb49c8c84c801d1bc84325d88d2b4df48589513`.

The three Brief cases preserve all 21 national findings. Unselected context exports 0 local records/0 requests; explicit analyst selection exports 2 WV records/1 current request; changing capacity excludes that stale selected request (2 local records/0 requests) and preserves the stale-request warning. Each serialized JSON is parsed and its scenario quantities and full evidence records are checked against the original inputs; scientific nullable uncertainty fields are preserved. No local record modifies national findings or arithmetic.

| Scenario | Intended | Reached | Gap | Baseline person-months | Alternative person-months | Difference person-months | Resources USD |
|---|---:|---:|---:|---:|---:|---:|---:|
| defaults | 3000 | 3000 | 0 | 36000 | 18000 | 18000 | 1200000 |
| capacity-constrained | 3000 | 2000 | 1000 | 24000 | 12000 | 12000 | 900000 |
| horizon-capped | 3000 | 3000 | 0 | 12000 | 9000 | 3000 | 1200000 |
| precise-reach | 3015 | 3000 | 15 | 36000 | 18000 | 18000 | 1200000 |
| zero-reach | 0 | 0 | 0 | 0 | 0 | 0 | 300000 |
| zero-capacity | 3000 | 0 | 3000 | 0 | 0 | 0 | 300000 |
| zero-resources | 3000 | 3000 | 0 | 36000 | 18000 | 18000 | 0 |
| near-zero-reach | 400 | 400 | 0 | 4800 | 2400 | 2400 | 420000 |
| near-one-reach | 12000 | 3000 | 9000 | 36000 | 18000 | 18000 | 1200000 |
| rounding-boundary | 2 | 2 | 0 | 24 | 12 | 12 | 300600 |
| all-zero | 0 | 0 | 0 | 0 | 0 | 0 | 0 |

All three sensitivity dimensions are compared at every generated point, including exact current assumptions, zero boundaries, high-precision reach, near-zero/near-one reach, capacity rounding, horizon capping, and valid zero inputs. The comparison command exits nonzero on any difference; a deliberately changed reached-participants result was rejected during verification.

## Reproduce against integrated source

Use the same installed Node22 version and validated final dependency lock in each checkout. The baseline checkout must be the exact before SHA. That SHA has no tracked root lockfile: in a fresh isolated baseline checkout, copy the validated final lockfile as an untracked build input before running `npm ci` (the declared manifests are unchanged by the dependency repair). Preserve existing user files and do not regenerate dependencies independently for this comparison. Scripts may run from the repaired checkout while importing both target checkouts; they contain no absolute workspace paths and never write reviewed artifacts. Pass generated snapshot/report output paths outside `artifacts/reviewed`.

```sh
node --experimental-strip-types scripts/maintenance/capture-governed-regression.mjs /path/to/baseline /tmp/before.json
node --experimental-strip-types scripts/maintenance/capture-governed-regression.mjs /path/to/integrated /tmp/after.json
node scripts/maintenance/compare-governed-regression.mjs /tmp/before.json /tmp/after.json /tmp/comparison.json
```

Full machine-readable captures for this run: `/tmp/diagnostic-governed-before.json`, `/tmp/diagnostic-governed-after.json`, and `/tmp/diagnostic-governed-comparison.json`. Preserve these in the final QA artifact package. Regenerate against final main before static deployment; do not treat this intermediate PR comparison as final-release verification.

## Exact serialized Brief hashes (same before and after)

- `unselected-context-and-requests`: `c3031878661a52d0818cba95e1bd0a85ebc558ed7d54e6d1c9e22fa8be0aed0d`.
- `explicit-context-and-current-request`: `ed3cfbf077a780ca4c27ea66cfc467820399693adbc9220636c15001cc1d4a4a`.
- `explicit-context-and-stale-request`: `198ad8bff6cc1dfcb48199ad6d221d83918b47e95ccdecebbe51ec0be9e053bb`.
