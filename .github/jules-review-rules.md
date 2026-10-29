# Jules PR Review Rules

This repository follows strict safety, provenance, and contract validation principles:

1. **No Untrusted Evidence Ingestion or Model Authoring**:
   - Machine learning models (local Ollama, Gemini API, etc.) are restricted to draft option/request proposals via strictly ID-only schemas (`ModelCandidateV1`).
   - Models must NEVER author or edit numeric values, scientific warnings, dispositions, or applicability decisions.

2. **Strict Verification**:
   - All proposed candidates must be verified through `assertCandidate`, `bindCandidate`, and `assertOutput`.
   - Any invalid, malformed, or hallucinated candidate output must fail closed.

3. **No Production Side Effects in Test Evaluation**:
   - Evaluation harnesses must be non-production CLI tools and fixtures in test-only paths.
   - Sensitive prompt/response logs must be redacted/omitted from summary artifacts.
