#!/usr/bin/env Rscript

`%||%` <- function(x, y) if (is.null(x)) y else x\n\nargs <- commandArgs(trailingOnly = TRUE)
pipeline_arg <- grep("^--pipeline=", args, value = TRUE)
pipeline <- if (length(pipeline_arg)) sub("^--pipeline=", "", pipeline_arg[[1]]) else "meps-national-burden"

config_path <- "analysis/r/config/pipeline_inputs.json"
if (!file.exists(config_path)) {
  stop("Missing pipeline input configuration: ", config_path, call. = FALSE)
}
if (!requireNamespace("jsonlite", quietly = TRUE)) {
  stop("Package 'jsonlite' is required. Run Rscript analysis/r/install_dependencies.R", call. = FALSE)
}

config <- jsonlite::fromJSON(config_path, simplifyVector = FALSE)
available <- names(config$pipelines)
if (!pipeline %in% available) {
  stop(
    sprintf("Unknown pipeline '%s'. Available: %s", pipeline, paste(available, collapse = ", ")),
    call. = FALSE
  )
}

spec <- config$pipelines[[pipeline]]
required <- unlist(spec$required %||% list(), use.names = FALSE)
one_of <- unlist(spec$one_of %||% list(), use.names = FALSE)
optional <- unlist(spec$optional %||% list(), use.names = FALSE)

cat("Diagnostic Odyssey source check\n")
cat("===============================\n")
cat("Pipeline:", pipeline, "\n")
cat("Purpose:", spec$description, "\n\n")

missing_required <- character()
if (length(required)) {
  cat("Required inputs\n")
  for (path in required) {
    ok <- file.exists(path)
    cat(sprintf("[%s] %s\n", if (ok) "FOUND" else "MISSING", path))
    if (!ok) missing_required <- c(missing_required, path)
  }
}

one_of_ok <- TRUE
if (length(one_of)) {
  cat("One of these inputs is sufficient\n")
  states <- vapply(one_of, file.exists, logical(1))
  for (i in seq_along(one_of)) {
    cat(sprintf("[%s] %s\n", if (states[[i]]) "FOUND" else "MISSING", one_of[[i]]))
  }
  one_of_ok <- any(states)
}

if (length(optional)) {
  cat("\nOptional inputs\n")
  for (path in optional) {
    cat(sprintf("[%s] %s\n", if (file.exists(path)) "FOUND" else "NOT PRESENT", path))
  }
}

if (length(missing_required) || !one_of_ok) {
  cat("\nThis pipeline is not runnable with the currently available raw inputs.\n")
  if (pipeline == "meps-national-burden") {
    cat("Only HC-256 is required. NHIS, HRSA, ACS, PLACES, CMS, and event files do not block this pipeline.\n")
  }
  quit(status = 2)
}

cat("\nInput requirements for this pipeline are satisfied.\n")
cat("This check does NOT imply methods review or scientific release approval.\n")

`%||%` <- function(x, y) if (is.null(x)) y else x
