# Executable schema / runtime comparison — test evidence, not admission

The committed `test/fixtures/schema-cases.v1.json` contains **34 synthetic catalog instances** and exact expected outcomes. This is executed by `test/schema-agreement.test.ts` using the installed **Python jsonschema Draft202012Validator** against the unmodified committed `schema/narrative-intervention-references.v1.schema.json`. `Draft202012Validator.check_schema` checks the meta-schema before execution. Tests compare each result with `validateNarrativeReferenceCatalog` and fail for **any newly unapproved divergence**.

The Python dependency is test-only, pinned to `jsonschema==4.26.0`; it is installed in the normal pull-request CI before `npm test`. For local standalone package testing: `python3 -m pip install jsonschema==4.26.0 && npm test --workspace @diagnostic-odyssey/narrative-references`. It is deliberately not a production dependency or a replacement for runtime validation.

| Comparison class | Test coverage | Expected schema | Expected TS runtime |
| --- | --- | --- | --- |
| Candidate draft / awaiting review | synthetic positives | accept | accept |
| Approved but not released | synthetic positive | accept | accept |
| Released structure | synthetic positive | accept | accept |
| Rejected with recorded source/reviewer provenance | synthetic positive | accept | accept |
| Nested/root unknown properties and effect/ROI injections | negative cases | reject | reject |
| Invalid approval/rejection transitions, provenance, digests, mixed catalogs | negative cases | reject | reject |
| Malformed timestamp *lexical form* | negative | reject | reject |
| Impossible calendar date with well-formed ISO pattern | intentional difference | **accept** | **reject** |
| Duplicate claim ID, conflicting source bibliographic identity | intentional differences | **accept** | **reject** |
| Same source ID for multiple claims with different locators | positive | accept | accept |

**Why the three differences are intentional:** JSON Schema v1 uses a timestamp `pattern`, not a `format` assertion; regex does not validate calendar arithmetic. The schema also has no global cross-record uniqueness/source-identity constraints; TypeScript performs those catalog-wide checks. Both validators must be applied to untrusted catalogs (with the TS semantic validator authoritative for these). This suite does not test HTTP retrieval, cryptographic digest preimages, an authentic reviewer, publication permissions, admitted rights, or scientific applicability. A digest that is syntactically valid is **not** evidence that its preimage has been retained.

**Change control:** a new disagreement is a scientific contract finding, not a reason to weaken either implementation. Record and independently review any proposed contract alteration before editing schema or runtime behavior. No approved/released fixture here denotes a real review or an authorized promotion.
