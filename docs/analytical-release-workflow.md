# Analytical candidate review and release workflow

A Diagnostic Odyssey analytical result passes through four distinct states:

```text
raw public-use input
→ intermediate survey calculations
→ candidate analytical artifact
→ reviewed/released analytical artifact
```

The MEPS runner stops at **candidate analytical artifact**.

## Candidate generation

The runner writes:

```text
artifacts/generated/meps-2024-long-covid-candidate/
  bundle.json
  diagnostics.json
  review-manifest.json
```

`bundle.json` uses `display_status="analytical_artifact"` but every generated numeric estimate uses `release_status="preliminary"`.

The runtime/export gate therefore cannot include these estimates in a released Planning Brief.

## Mandatory review

Before any estimate can be changed to `reviewed_released`, all checklist items must be explicitly reviewed:

1. **Methods review** — estimator matches the frozen variable/estimand map and survey design.
2. **Cohort review** — Long COVID round-resolution diagnostics are plausible; conflicts/missing histories are inspected.
3. **Weighted/unweighted N review** — every measure's analytical N and weighted denominator are plausible for its questionnaire universe.
4. **Interval review** — standard errors/CIs are finite, appropriately wide, and use the intended design.
5. **Denominator/universe review** — person, ESAQ, PSAQ, and EQDENY-specific denominators are accurately labeled.
6. **Plausibility review** — totals/means/proportions are compared with relevant AHRQ published distributions or other justified benchmarks.
7. **Provenance review** — source locator, dataset release, code commit, input checksum, weight, VARSTR/VARPSU, and method metadata are present.
8. **Interpretation review** — labels preserve gross-vs-attributable, national-vs-local, component-vs-total, screening-vs-diagnosis, and assumption-vs-effect boundaries.

A reviewer also confirms that no suppressed/unreliable value should be released.

## Promotion

Promotion is intentionally **not automated**. There is no script that silently changes `preliminary` to `reviewed_released`.

After review, a reviewer should:

1. copy the candidate into a versioned reviewed-release directory;
2. update only explicitly approved estimates to `reviewed_released`;
3. mark unavailable/suppressed estimates appropriately;
4. attach the completed review manifest;
5. rerun the TypeScript artifact validator;
6. rerun repository CI;
7. only then change runtime artifact selection to the reviewed version.

The completed review manifest is evidence of review, not a substitute for code review or statistical judgment.
