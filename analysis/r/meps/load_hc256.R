hc256_zip_path <- function() repo_path("data", "raw", "meps", "2024", "meps_hc256_2024_stata.zip")
hc256_dta_path <- function() repo_path("data", "raw", "meps", "2024", "h256.dta")

extract_hc256_zip <- function(zip_path = hc256_zip_path(), dta_path = hc256_dta_path()) {
  if (!file.exists(zip_path)) {
    stop("HC-256 ZIP not found: ", zip_path, call. = FALSE)
  }
  listing <- utils::unzip(zip_path, list = TRUE)
  dta_entries <- listing$Name[grepl("\\.dta$", listing$Name, ignore.case = TRUE)]
  if (length(dta_entries) != 1L) {
    stop("Expected exactly one .dta file in HC-256 ZIP; found ", length(dta_entries), ".", call. = FALSE)
  }

  raw_dir <- dirname(dta_path)
  dir.create(raw_dir, recursive = TRUE, showWarnings = FALSE)
  tmp <- tempfile("hc256-extract-")
  dir.create(tmp)
  on.exit(unlink(tmp, recursive = TRUE, force = TRUE), add = TRUE)
  utils::unzip(zip_path, files = dta_entries[[1]], exdir = tmp)
  extracted <- file.path(tmp, dta_entries[[1]])
  if (!file.exists(extracted)) stop("HC-256 .dta extraction failed.", call. = FALSE)
  if (!file.copy(extracted, dta_path, overwrite = TRUE)) {
    stop("Could not copy extracted HC-256 .dta to ", dta_path, call. = FALSE)
  }
  dta_path
}

required_hc256_variables <- function(variable_map = load_variable_map()) {
  measure_variables <- unique(vapply(variable_map$measures, function(x) x$variable, character(1)))
  cohort_variables <- unlist(variable_map$cohort$required_variables, use.names = FALSE)
  unique(c(
    "DUPERSID",
    cohort_variables,
    measure_variables,
    variable_map$design$variance_stratum,
    variable_map$design$variance_psu,
    variable_map$design$person_weight,
    variable_map$design$esaq_weight,
    variable_map$design$psaq_weight,
    variable_map$design$joint_psaq_esaq_weight
  ))
}

load_hc256 <- function(path = hc256_dta_path(), extract_if_needed = TRUE) {
  if (!requireNamespace("haven", quietly = TRUE)) {
    stop("Package 'haven' is required. Run Rscript analysis/r/install_dependencies.R", call. = FALSE)
  }
  if (!file.exists(path) && extract_if_needed && file.exists(hc256_zip_path())) {
    path <- extract_hc256_zip()
  }
  if (!file.exists(path)) {
    stop(
      paste0(
        "HC-256 is unavailable. Run `Rscript pipelines/data/download_meps_hc256.R` ",
        "or manually place the official Stata ZIP at data/raw/meps/2024/meps_hc256_2024_stata.zip."
      ),
      call. = FALSE
    )
  }

  data <- haven::read_dta(path)
  names(data) <- toupper(names(data))
  required <- required_hc256_variables()
  missing <- setdiff(required, names(data))
  if (length(missing)) {
    stop("HC-256 file is missing required reviewed variables: ", paste(missing, collapse = ", "), call. = FALSE)
  }
  attr(data, "hc256_path") <- normalizePath(path, winslash = "/", mustWork = TRUE)
  data
}
