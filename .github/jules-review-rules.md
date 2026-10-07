# Code Review Guidelines

When reviewing pull requests for this repository:

1. **Format Requirements:** Strictly format review output with the following markdown headers:
   - `## Summary`
   - `## Strengths`
   - `## Findings` (grouped under `### [BLOCKING]`, `### [WARN]`, or `### [NIT]`)
   - Conclude with exactly one line: `VERDICT: approve`, `VERDICT: comment`, or `VERDICT: block`.

2. **Quality Standards:**
   - Verify that code changes are correct, deterministic, well-tested, and maintainable.
   - Check that error conditions and boundary cases are properly handled.
   - Ensure privacy, provenance, and data isolation constraints are preserved.
