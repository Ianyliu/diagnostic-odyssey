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

## Manual downloads required now

### AHRQ MEPS 2024 Full-Year Consolidated — HC-256

- Official dataset: **MEPS HC-256: 2024 Full Year Consolidated Data File**
- Official page: https://meps.ahrq.gov/data_stats/download_data_files_detail.jsp?cboPufNumber=HC-256
- Recommended format for this project: Stata ZIP (official page reports approximately **5.5 MB**)
- Canonical local filename after download: `data/raw/meps/2024/meps_hc256_2024_stata.zip`
- Registration/application: none for the public-use file; comply with the AHRQ public-use data agreement.
- After download: run `Rscript analysis/r/01_check_inputs.R`, then the future `analysis/r/10_meps_burden.R` once variable mapping is methods-approved.

HC-256 is the required person-level starting point. Do not interpret it as state Medicaid claims.

### MEPS 2024 event files

The 2024 event family is HC-254A through HC-254H, plus HC-254I (appendix). The current first-pass implementation does **not** require every event file. Add only files justified by the approved estimand/variable map.

Likely early files:

- **HC-254G — Office-Based Medical Provider Visits**, official page:
  https://meps.ahrq.gov/mepsweb/data_stats/download_data_files_detail.jsp?cboPufNumber=HC-254G
  - Stata ZIP is approximately **2.6 MB**
  - canonical local filename: `data/raw/meps/2024/meps_hc254g_2024_office_visits_stata.zip`
- **HC-254F — Outpatient Visits**
- **HC-254E — Emergency Room Visits**
- **HC-254D — Hospital Inpatient Stays**
- **HC-254A — Prescribed Medicines**

Official 2024 PUF index:
https://meps.ahrq.gov/mepsweb/data_stats/download_data_files_results.jsp?buttonYearandDataType=Search&cboDataYear=All&sortBy=year_for_display_D

Do not download event files merely to populate the repository. Final selection should follow the estimands.

### CDC/NCHS NHIS 2024 sample adult

- Official dataset page:
  https://www.cdc.gov/nchs/nhis/documentation/2024-nhis.html
- Public-use sample-adult CSV link resolves to:
  https://ftp.cdc.gov/pub/Health_Statistics/NCHS/Datasets/NHIS/2024/adult24csv.zip
- Publisher filename: `adult24csv.zip`
- Local path: `data/raw/nhis/2024/adult24csv.zip`
- Registration/application: none for public-use sample-adult data.
- After download: `Rscript analysis/r/01_check_inputs.R`; NHIS analysis remains disabled until the condition/function variable map is reviewed.

Restricted geography is **not** required for this sprint architecture.

### HRSA HPSA

Use the HRSA Data Downloads page:
https://data.hrsa.gov/data/download?data=AHRF

For the first local-context implementation, manually download both:

1. **HPSA – Primary Care → All HPSAs → CSV** (approximately **35 MB** on the 2026-08-26 listing)
   - save as `data/raw/hrsa/hpsa_primary_care_all.csv`
2. **HPSA – Mental Health → All HPSAs → CSV** (approximately **14 MB** on the 2026-08-26 listing)
   - save as `data/raw/hrsa/hpsa_mental_health_all.csv`

Registration/application: none indicated for these HRSA public data downloads; the listing reports no usage limitation for HPSA data.

Because HRSA refreshes these data frequently, the eventual ingestion manifest must record download date/source refresh date. Missing HPSA rows must not be interpreted as “no shortage.”

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
