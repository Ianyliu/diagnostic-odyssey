# Evidence processing

Evidence processing is separate from statistical estimation.

Planned flow:

1. Add an allowlisted source to an ingestion manifest.
2. Extract candidate structured fields.
3. Require exact source locator and preserve unsupported fields as empty.
4. Human reviewer accepts/corrects/rejects the record.
5. Deterministic admissibility logic controls allowed use.
6. Only reviewed records may be surfaced as evidence-backed parameters or brief language.

An LLM may assist with step 2 or mismatch flagging later. It may not set final release/admissibility state or introduce quantitative estimates.
