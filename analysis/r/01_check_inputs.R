#!/usr/bin/env Rscript

required <- c(
  "data/raw/meps/2024/meps_hc256_2024_stata.zip",
  "data/raw/nhis/2024/adult24csv.zip",
  "data/raw/hrsa/hpsa_primary_care_all.csv",
  "data/raw/hrsa/hpsa_mental_health_all.csv"
)

optional <- c(
  "data/raw/meps/2024/meps_hc254g_2024_office_visits_stata.zip",
  "data/raw/acs/2024/acs_2024_5year_context.csv",
  "data/raw/places/2025/places_context_subset.csv"
)

cat("Diagnostic Odyssey source check\n")
cat("===============================\n")

missing_required <- character()
for (path in required) {
  ok <- file.exists(path)
  cat(sprintf("[%s] %s\n", if (ok) "FOUND" else "MISSING", path))
  if (!ok) missing_required <- c(missing_required, path)
}

cat("\nOptional/deferred inputs\n")
for (path in optional) {
  cat(sprintf("[%s] %s\n", if (file.exists(path)) "FOUND" else "NOT PRESENT", path))
}

if (length(missing_required) > 0) {
  cat("\nRequired raw inputs are missing. No analytical artifact will be generated.\n")
  quit(status = 2)
}

cat("\nRequired raw inputs found. This check does NOT imply methods/release approval.\n")
