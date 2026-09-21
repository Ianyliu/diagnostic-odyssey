#!/usr/bin/env Rscript

key <- Sys.getenv("CENSUS_API_KEY")
if (!nzchar(key)) {
  stop("CENSUS_API_KEY is required. No request was made.", call. = FALSE)
}

stop(
  paste(
    "ACS acquisition is configured but intentionally not yet executed by this script.",
    "Add an approved table/variable/geography manifest before enabling downloads.",
    "This prevents convenient API access from becoming an unreviewed local-context model."
  ),
  call. = FALSE
)
