#!/usr/bin/env Rscript

source(file.path("analysis", "r", "meps", "bootstrap.R"))

if (!requireNamespace("haven", quietly = TRUE) || !requireNamespace("jsonlite", quietly = TRUE)) {
  stop("Run Rscript analysis/r/install_dependencies.R first.", call. = FALSE)
}

cfg <- read_linked_condition_source_config()
assert_linked_condition_source_pins(cfg)

raw_dir <- repo_path("data", "raw", "meps", "2024", "linked-condition")
dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)

download_one <- function(source) {
  archive_path <- file.path(raw_dir, source$expected_archive_filename)
  dta_path <- file.path(raw_dir, source$expected_data_filename)

  tmp <- paste0(archive_path, ".part")
  if (file.exists(tmp)) unlink(tmp)
  on.exit(if (file.exists(tmp)) unlink(tmp), add = TRUE)

  if (!file.exists(archive_path)) {
    curl <- Sys.which("curl")
    if (!nzchar(curl)) stop("curl is required for governed linked-condition acquisition.", call. = FALSE)
    status <- system2(
      curl,
      c(
        "--fail", "--location", "--silent", "--show-error",
        "--connect-timeout", "30", "--max-time", "300", "--retry", "2",
        "--output", tmp, source$download_url
      )
    )
    if (!identical(as.integer(status), 0L)) {
      stop("Official AHRQ download failed for ", source$puf_id, ".", call. = FALSE)
    }
    if (!file.rename(tmp, archive_path)) stop("Unable to move downloaded archive.", call. = FALSE)
  }

  observed_zip <- assert_sha256_matches(
    archive_path, source$expected_zip_sha256,
    paste(source$puf_id, "official Stata ZIP")
  )

  listing <- utils::unzip(archive_path, list = TRUE)
  selected_member <- select_expected_dta_member(
    listing,
    source$expected_data_filename,
    source$puf_id
  )

  temp_dir <- tempfile(paste0(tolower(gsub("-", "", source$puf_id)), "-"))
  dir.create(temp_dir, recursive = TRUE)
  on.exit(unlink(temp_dir, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(archive_path, files = selected_member, exdir = temp_dir)
  extracted <- file.path(temp_dir, selected_member)
  dir.create(dirname(dta_path), recursive = TRUE, showWarnings = FALSE)
  if (file.exists(dta_path)) unlink(dta_path)
  if (!file.copy(extracted, dta_path, overwrite = TRUE)) {
    stop("Unable to preserve extracted ", source$puf_id, " analytical file.", call. = FALSE)
  }

  observed_dta <- assert_sha256_matches(
    dta_path, source$expected_extracted_dta_sha256,
    paste(source$puf_id, "extracted Stata file")
  )

  probe <- normalize_meps_names(haven::read_dta(dta_path, n_max = 5))
  validate_required_variables(probe, source)

  list(
    source_id = source$source_id,
    puf_id = source$puf_id,
    label = source$label,
    release = source$release,
    official_page = source$official_page,
    documentation = source$documentation,
    download_url = source$download_url,
    archive_filename = source$expected_archive_filename,
    data_filename = source$expected_data_filename,
    archive_sha256 = observed_zip,
    extracted_sha256 = observed_dta,
    archive_sha256_match = TRUE,
    extracted_sha256_match = TRUE,
    required_variable_validation = "passed"
  )
}

new_sources <- Filter(function(x) !identical(x$puf_id, "HC-256"), cfg$sources)
metadata <- lapply(new_sources, download_one)

metadata_path <- file.path(raw_dir, "linked-condition-source-metadata.json")
jsonlite::write_json(
  list(
    status = "source-integrity-verified",
    generated_at = format(Sys.time(), tz = "UTC", format = "%Y-%m-%dT%H:%M:%SZ"),
    sources = metadata
  ),
  metadata_path,
  pretty = TRUE,
  auto_unbox = TRUE,
  null = "null"
)

message("Linked-condition source acquisition and integrity verification complete.")
message("Metadata: ", metadata_path)
