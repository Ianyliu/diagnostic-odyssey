#!/usr/bin/env Rscript

source(file.path("analysis", "r", "lib", "paths.R"))
source(file.path("analysis", "r", "meps", "load_hc256.R"))

if (!requireNamespace("haven", quietly = TRUE) || !requireNamespace("jsonlite", quietly = TRUE)) {
  stop("Run Rscript analysis/r/install_dependencies.R first.", call. = FALSE)
}

args <- commandArgs(trailingOnly = TRUE)
force <- "--force" %in% args

official_page <- "https://meps.ahrq.gov/data_stats/download_data_files_detail.jsp?cboPufNumber=HC-256"
download_url <- "https://meps.ahrq.gov/data_files/pufs/h256/h256dta.zip"
zip_path <- hc256_zip_path()
dta_path <- hc256_dta_path()
metadata_path <- repo_path("data", "raw", "meps", "2024", "hc256_source_metadata.json")
dir.create(dirname(zip_path), recursive = TRUE, showWarnings = FALSE)

if (!file.exists(zip_path) || force) {
  message("Downloading official AHRQ MEPS HC-256 Stata ZIP...")
  tmp <- paste0(zip_path, ".part")
  on.exit(if (file.exists(tmp)) unlink(tmp), add = TRUE)
  utils::download.file(download_url, tmp, mode = "wb", method = "libcurl", quiet = FALSE)
  if (!file.exists(tmp) || file.info(tmp)$size < 1000000) {
    stop("Downloaded HC-256 file is unexpectedly small or missing.", call. = FALSE)
  }
  if (!file.rename(tmp, zip_path)) {
    stop("Unable to move downloaded ZIP into raw-data directory.", call. = FALSE)
  }
} else {
  message("Using existing HC-256 ZIP: ", zip_path)
}

listing <- tryCatch(utils::unzip(zip_path, list = TRUE), error = function(e) NULL)
if (is.null(listing) || !any(grepl("\\.dta$", listing$Name, ignore.case = TRUE))) {
  stop("Downloaded file is not a readable ZIP containing a Stata .dta file.", call. = FALSE)
}

extract_hc256_zip(zip_path, dta_path)
probe <- haven::read_dta(dta_path, n_max = 5)
required_probe <- c("AGE24X", "LCEVER31", "LCEVER53", "COVSYMNOW31", "COVSYMNOW53",
                    "PERWT24F", "VARSTR", "VARPSU")
missing_probe <- setdiff(required_probe, toupper(names(probe)))
if (length(missing_probe)) {
  stop("Extracted Stata file failed HC-256 variable verification: ",
       paste(missing_probe, collapse = ", "), call. = FALSE)
}

metadata <- list(
  source_id = "meps-hc256-2024",
  dataset = "MEPS HC-256: 2024 Full Year Consolidated Data File",
  release = "August 2026",
  official_page = official_page,
  download_url = download_url,
  downloaded_at_utc = format(Sys.time(), tz = "UTC", usetz = TRUE),
  zip_path = "data/raw/meps/2024/meps_hc256_2024_stata.zip",
  zip_bytes = unname(file.info(zip_path)$size),
  zip_md5 = unname(tools::md5sum(zip_path)),
  extracted_path = "data/raw/meps/2024/h256.dta",
  extracted_bytes = unname(file.info(dta_path)$size),
  verification = "Readable ZIP; Stata file extracted; required HC-256 identifiers found."
)
jsonlite::write_json(metadata, metadata_path, pretty = TRUE, auto_unbox = TRUE, null = "null")

message("HC-256 acquisition verified.")
message("ZIP: ", zip_path)
message("DTA: ", dta_path)
message("Metadata: ", metadata_path)
