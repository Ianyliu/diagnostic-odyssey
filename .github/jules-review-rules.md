# Code Review Rules

## Guidelines for Pull Requests

1. **Test Coverage:** All changes to code or components should be accompanied by relevant unit tests. Ensure error paths and edge cases are tested.
2. **Quality Checks:** Code must pass `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build`.
3. **Data Integrity:** Artifacts and data contracts must maintain privacy and governance invariants.
