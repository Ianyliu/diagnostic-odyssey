# Offline R analytics

This directory is intentionally separate from the runtime TypeScript application.

## Rules

- Preserve MEPS/NHIS complex-survey design.
- Run variable coding/universe checks before estimation.
- Record weighted and unweighted denominators.
- Review extreme/tail behavior.
- Reconcile nested spending components.
- Apply release/suppression/reliability rules before artifact promotion.
- Never use local context as an automatic multiplier on national burden.
- Never write directly into a runtime `reviewed_released` artifact from an unreviewed analysis script.

## Current state

Only source-presence checks and scaffolding are implemented. No burden estimator is represented as complete yet.
