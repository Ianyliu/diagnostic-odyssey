# Data acquisition and local layout

Large raw, intermediate, and derived analytical files are intentionally excluded from Git. This repository currently contains **no real analytical microdata and no released burden estimates**.

Use this layout locally:

```text
data/
  raw/
    meps/2024/
    nhis/2024/
    hrsa/
    acs/2024/
    places/current/
    cms/
  intermediate/
  derived/
  manifests/
```

The checked-in `data/manifests/sources.json` is the source-of-truth inventory. Never replace a missing source with a fabricated fixture in the analytical pipeline.

## Current P4 requirement: MEPS HC-256 only

The 2024 MEPS national Long COVID burden pipeline is intentionally independent of NHIS and local-context sources.

Preferred acquisition:

```bash
Rscript analysis/r/install_dependencies.R
Rscript pipelines/data/download_meps_hc256.R
```

The helper downloads the official AHRQ HC-256 Stata ZIP, verifies that it is a readable archive containing a Stata file, extracts it, checks core HC-256 variables, and writes local source metadata. Raw files remain gitignored.

If automated acquisition fails, manually download **Data File, Stata format** from:

https://meps.ahrq.gov/data_stats/download_data_files_detail.jsp?cboPufNumber=HC-256

Place the ZIP exactly at:

`data/raw/meps/2024/meps_hc256_2024_stata.zip`

No other dataset is required for the primary 2024 national burden pipeline.

### Deferred / separate pipelines

- MEPS HC-254 event files: optional only when a future event-level estimand requires them.
- NHIS 2024: supplementary / compatibility analyses; not needed to identify the primary MEPS Long COVID cohort.
- HRSA / ACS / PLACES / CMS: local implementation context; downstream of this phase.

## Script/API acquisition rather than manual large downloads

### Census ACS 2024 5-year

Official API documentation:
https://www.census.gov/data/developers/data-sets/acs-5year/2024.html

The Census Data API now requires an API key. Put it in `CENSUS_API_KEY` (never commit it). The planned local-context pipeline will query only approved tables/variables rather than commit the entire Summary File.

No ACS data are currently present.

### CDC PLACES

Current PLACES data portal:
https://www.cdc.gov/places/tools/data-portal.html

The current release should be accessed via the portal/API after the exact geography/measure subset is frozen. PLACES is contextual only and must not be used as a Long COVID burden estimator.

No PLACES data are currently present.

### CMS public provider/geographic data

CMS Provider Summary by Type of Service:
https://data.cms.gov/provider-summary-by-type-of-service

A likely future context source is **Medicare Physician & Other Practitioners — by Geography and Service**, but CMS source selection remains a methods/product decision. Do not ingest a CMS dataset until the target local-context question and fields are specified.

No CMS data are currently present.

## Analytical promotion rule

Raw-source presence is not the same as analytical release.

The promotion path is:

```text
raw source
→ variable/universe review
→ survey-aware analysis
→ diagnostics / suppression / plausibility review
→ candidate artifact
→ methods release decision
→ versioned analytical_artifact folder
→ runtime validation
```

Only the final reviewed stage may use `release_status: reviewed_released` and `display_status: analytical_artifact`.
