# Offline R analytics

The 2024 MEPS HC-256 national Long COVID pipeline is implemented as an **offline candidate-artifact pipeline**. Statistical estimation remains separate from the runtime React application.

## Current primary pipeline

```text
HC-256 Stata PUF
→ reviewed variable/estimand map
→ Long COVID cohort construction
→ weight-specific MEPS survey designs
→ Tier 1 population/spending/utilization
→ Tier 2 ESAQ healthcare-work/admin
→ Tier 3 PSAQ K6/PHQ-2
→ preliminary analytical candidate
→ TypeScript contract validation
→ methods review
→ explicit release
```

Run from the repository root:

```bash
Rscript analysis/r/install_dependencies.R
Rscript analysis/r/01_check_inputs.R --pipeline=meps-national-burden
Rscript analysis/r/meps/run_meps_2024.R
```

Or allow the runner to attempt official AHRQ acquisition when HC-256 is absent:

```bash
Rscript analysis/r/meps/run_meps_2024.R --download
```

## Structure

- `config/meps_2024_variable_map.json`: machine-readable frozen estimand/variable map.
- `lib/`: generic reserved-value, survey-estimation, result/provenance, and path helpers.
- `meps/load_hc256.R`: loader and ZIP extraction.
- `meps/cohort_long_covid.R`: explicit round-resolution/case rule.
- `meps/survey_designs.R`: PERWT24F / ESAQWT24F / SAQWT24F designs.
- `meps/estimate_*.R`: domain-specific estimators.
- `meps/build_candidate_artifact.R`: preliminary analytical artifact assembly.
- `meps/run_meps_2024.R`: orchestrator.
- `tests/`: synthetic survey and guardrail tests that require no HC-256 data.

## Required scientific rules

- Preserve the MEPS complex survey design with VARSTR/VARPSU.
- Use PERWT24F for core person-level outcomes, ESAQWT24F for ESAQ outcomes, and SAQWT24F for PSAQ outcomes.
- PESAQWT24F is not used unless a future estimand actually combines PSAQ and ESAQ variables.
- Construct the full weight-specific design before Long COVID domain estimation.
- Never coerce reserved negative values to zero/No.
- Never add TOTSLF24 to TOTEXP24.
- Never sum EQMVAM53 + EQMBAM53 + EQPPAM53 into an opaque burden score.
- Treat K6 as nonspecific psychological distress and PHQ-2 as a depressive-symptom screen, not diagnoses.
- Successful code execution does not confer scientific release.

The readable methods contract is `docs/methods/meps-2024-long-covid.md`.
