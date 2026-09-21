#!/usr/bin/env Rscript

# Backward-compatible entry point. The maintained pipeline lives under analysis/r/meps/.
args <- commandArgs(trailingOnly = TRUE)
runner <- file.path("analysis", "r", "meps", "run_meps_2024.R")

if (!file.exists(runner)) {
  stop("MEPS runner not found: ", runner, call. = FALSE)
}

status <- system2(
  file.path(R.home("bin"), "Rscript"),
  c(runner, args)
)
quit(status = status)
