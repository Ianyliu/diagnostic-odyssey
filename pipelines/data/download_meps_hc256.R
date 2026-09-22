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

classify_curl_failure <- function(status, output) {
  http_line <- grep("HTTP_STATUS:", output, value = TRUE)
  http_status <- if (length(http_line)) sub(".*HTTP_STATUS:", "", tail(http_line, 1)) else NA_character_

  category <- switch(
    as.character(status),
    "6" = "DNS/network resolution failure",
    "7" = "network connection failure",
    "22" = if (!is.na(http_status)) paste0("HTTP failure (status ", http_status, ")") else "HTTP failure",
    "28" = "network timeout",
    "35" = "TLS handshake failure",
    "56" = "network receive failure",
    paste0("download failure (curl exit ", status, ")")
  )
  paste0(category, ". Official URL: ", download_url)
}

download_official_hc256 <- function(destination) {
  tmp <- paste0(destination, ".part")
  if (file.exists(tmp)) unlink(tmp)
  on.exit(if (file.exists(tmp)) unlink(tmp), add = TRUE)

  curl <- Sys.which("curl")
  if (nzchar(curl)) {
    message("Downloading with curl from the official AHRQ HC-256 Stata URL...")
    output <- suppressWarnings(system2(
      curl,
      c(
        "--fail",
        "--location",
        "--silent",
        "--show-error",
        "--connect-timeout", "30",
        "--max-time", "300",
        "--retry", "2",
        "--write-out", "HTTP_STATUS:%{http_code}",
        "--output", tmp,
        download_url
      ),
      stdout = TRUE,
      stderr = TRUE
    ))
    status <- attr(output, "status")
    if (is.null(status)) status <- 0L
    if (!identical(as.integer(status), 0L)) {
      stop(classify_curl_failure(as.integer(status), output), call. = FALSE)
    }
  } else {
    message("curl is unavailable; falling back to R download.file().")
    status <- tryCatch(
      utils::download.file(download_url, tmp, mode = "wb", method = "libcurl", quiet = FALSE),
      error = function(e) {
        stop(
          "Network/download failure while retrieving official HC-256: ",
          conditionMessage(e),
          call. = FALSE
        )
      }
    )
    if (!identical(as.integer(status), 0L)) {
      stop("Network/download failure while retrieving official HC-256.", call. = FALSE)
    }
  }

  if (!file.exists(tmp)) {
    stop("Download reported success but no HC-256 file exists.", call. = FALSE)
  }
  if (file.info(tmp)$size < 4000000) {
    stop(
      "Downloaded HC-256 ZIP is implausibly small (",
      file.info(tmp)$size,
      " bytes); refusing to analyze a potentially incomplete response.",
      call. = FALSE
    )
  }
  if (!file.rename(tmp, destination)) {
    stop("Unable to move downloaded ZIP into raw-data directory.", call. = FALSE)
  }
}

sha256_file <- function(path) {
  sha256sum <- Sys.which("sha256sum")
  if (nzchar(sha256sum)) {
    line <- system2(sha256sum, path, stdout = TRUE)
    return(strsplit(line[[1]], "[[:space:]]+")[[1]][[1]])
  }
  shasum <- Sys.which("shasum")
  if (nzchar(shasum)) {
    line <- system2(shasum, c("-a", "256", path), stdout = TRUE)
    return(strsplit(line[[1]], "[[:space:]]+")[[1]][[1]])
  }
  NA_character_
}

if (!file.exists(zip_path) || force) {
  download_official_hc256(zip_path)
} else {
  message("Using existing HC-256 ZIP: ", zip_path)
}

listing <- tryCatch(
  utils::unzip(zip_path, list = TRUE),
  error = function(e) {
    stop(
      "Corrupt/incomplete HC-256 ZIP: ",
      conditionMessage(e),
      call. = FALSE
    )
  }
)
dta_entries <- listing$Name[grepl("\\.dta$", listing$Name, ignore.case = TRUE)]
if (length(dta_entries) != 1L) {
  stop(
    "Unexpected Stata contents: expected exactly one .dta file in HC-256 ZIP; found ",
    length(dta_entries),
    ".",
    call. = FALSE
  )
}

extract_hc256_zip(zip_path, dta_path)
probe <- tryCatch(
  haven::read_dta(dta_path, n_max = 5),
  error = function(e) {
    stop("Extracted HC-256 Stata file cannot be opened: ", conditionMessage(e), call. = FALSE)
  }
)
probe_names <- toupper(names(probe))
required_probe <- required_hc256_variables()
missing_probe <- setdiff(required_probe, probe_names)
if (length(missing_probe)) {
  stop(
    "Unexpected Stata contents: extracted file is missing reviewed HC-256 variables: ",
    paste(missing_probe, collapse = ", "),
    call. = FALSE
  )
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
  zip_sha256 = sha256_file(zip_path),
  extracted_path = "data/raw/meps/2024/h256.dta",
  extracted_bytes = unname(file.info(dta_path)$size),
  extracted_sha256 = sha256_file(dta_path),
  verified_variable_count = length(required_probe),
  verification = paste(
    "Readable ZIP; exactly one Stata file extracted and opened;",
    "all variables required by the reviewed MEPS 2024 map were present."
  )
)
jsonlite::write_json(metadata, metadata_path, pretty = TRUE, auto_unbox = TRUE, null = "null")

message("HC-256 acquisition verified.")
message("ZIP: ", zip_path)
message("DTA: ", dta_path)
message("Metadata: ", metadata_path)
