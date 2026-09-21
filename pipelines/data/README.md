# Data pipelines

Only acquisition paths with stable, reviewed source definitions should be automated.

Current policy:

- MEPS/NHIS/HRSA: manual public-use download first; verify checksums/version metadata later.
- ACS: API acquisition after an approved variable/geography map; `CENSUS_API_KEY` is required.
- PLACES: API/manual subset after a measure/geography map is frozen.
- CMS: source remains deferred until the exact context question is frozen.

Pipeline code must fail closed when source files or expected columns are missing.
