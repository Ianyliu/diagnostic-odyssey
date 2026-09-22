# Analytical candidate review and release workflow

A Diagnostic Odyssey analytical result passes through four distinct states:

```text
raw public-use input
→ intermediate survey calculations
→ candidate analytical artifact
→ reviewed/released analytical artifact
```

The MEPS runner stops at **candidate analytical artifact**.

## Execution layers

Diagnostic Odyssey deliberately separates four different mechanisms:

1. **Ordinary CI** (`.github/workflows/ci.yml`) — runs on pushes/PRs and checks TypeScript correctness, build/lint/tests, and synthetic R scientific invariants. It does not touch real HC-256 microdata.
2. **Manual real-data candidate workflow** (`.github/workflows/meps-candidate.yml`) — runs only through `workflow_dispatch`, downloads the official public AHRQ HC-256 Stata file on an ephemeral GitHub-hosted runner, reruns synthetic checks, generates a preliminary candidate, validates it, and uploads only aggregate review files.
3. **Methods review** — a human/scientific assessment of cohort behavior, precision, denominators, plausibility, provenance, and interpretation.
4. **Release** — an explicit later promotion of only reviewed estimates to `reviewed_released`.

A green CI run or successful real-data workflow is therefore **not** a scientific release decision.

## GitHub Actions candidate generation

Workflow: **MEPS 2024 Long COVID Candidate**

The workflow checks out the exact `github.sha` selected by the manual dispatch and records repository/ref, run ID, run attempt, SHA, and timestamp. It uses Node 22 and R 4.6.1, reruns TypeScript and synthetic R checks, then invokes the maintained HC-256 downloader and MEPS runner.

The workflow artifact contains only:

- `bundle.json`
- `diagnostics.json`
- `review-manifest.json`
- `hc256-source-metadata.json`
- `github-actions-run-manifest.json`

The raw ZIP, `h256.dta`, person-level rows, and intermediate microdata are never uploaded. Raw files exist only ephemerally on the GitHub-hosted runner.

Workflow artifacts are retained for 14 days and are named `meps-2024-long-covid-candidate-<run-id>`.

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
