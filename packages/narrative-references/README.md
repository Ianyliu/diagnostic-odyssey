# @diagnostic-odyssey/narrative-references

Isolated contracts and validation for reviewed narrative intervention references. The production narrative release is unpopulated.

Private workspace package; consumed through `src/index.ts`.

## Notes

Includes Python provenance verification (`test/verify_provenance.py`, `test/test_provenance.py`); run with `python3 -m unittest discover -s packages/narrative-references/test -p test_provenance.py`.

## Public API

Exact names and type signatures are recorded in [`tests/characterization/golden/package-api.json`](../../tests/characterization/golden/package-api.json).

- Values (4): `assertValidNarrativeReference`, `assertValidNarrativeReferenceCatalog`, `validateNarrativeReference`, `validateNarrativeReferenceCatalog`
- Types (14): `NarrativeAllowedUse`, `NarrativeApplicability`, `NarrativeCausalUseClass`, `NarrativeLocatorKind`, `NarrativeReference`, `NarrativeReferenceCatalog`, `NarrativeReferenceManifest`, `NarrativeReleaseStatus`, `NarrativeReview`, `NarrativeReviewerStatus`, `NarrativeSource`, `NarrativeSourceKind`, `NarrativeSourceLocator`, `NarrativeValidationIssue`

## Test

```bash
npm test --workspace @diagnostic-odyssey/narrative-references
```
