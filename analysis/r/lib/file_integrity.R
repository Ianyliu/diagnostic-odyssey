sha256_file <- function(path) {
  if (!file.exists(path)) {
    stop("Cannot hash missing file: ", path, call. = FALSE)
  }

  sha256sum <- Sys.which("sha256sum")
  if (nzchar(sha256sum)) {
    line <- system2(sha256sum, path, stdout = TRUE, stderr = TRUE)
    status <- attr(line, "status")
    if (is.null(status)) status <- 0L
    if (!identical(as.integer(status), 0L) || !length(line)) {
      stop("sha256sum failed for ", path, call. = FALSE)
    }
    return(tolower(strsplit(line[[1]], "[[:space:]]+")[[1]][[1]]))
  }

  shasum <- Sys.which("shasum")
  if (nzchar(shasum)) {
    line <- system2(shasum, c("-a", "256", path), stdout = TRUE, stderr = TRUE)
    status <- attr(line, "status")
    if (is.null(status)) status <- 0L
    if (!identical(as.integer(status), 0L) || !length(line)) {
      stop("shasum -a 256 failed for ", path, call. = FALSE)
    }
    return(tolower(strsplit(line[[1]], "[[:space:]]+")[[1]][[1]]))
  }

  stop(
    "No SHA-256 command is available (expected sha256sum or shasum).",
    call. = FALSE
  )
}

assert_sha256_matches <- function(path, expected_sha256, label = basename(path)) {
  if (!is.character(expected_sha256) || length(expected_sha256) != 1L ||
      !grepl("^[0-9a-fA-F]{64}$", expected_sha256)) {
    stop("Invalid expected SHA-256 for ", label, call. = FALSE)
  }

  observed <- sha256_file(path)
  if (!identical(observed, tolower(expected_sha256))) {
    stop(
      "SHA-256 mismatch for ", label,
      ". Expected ", tolower(expected_sha256),
      " but observed ", observed,
      ". Refusing to continue until the source change is reviewed.",
      call. = FALSE
    )
  }
  observed
}

read_hc256_source_integrity <- function(
  path = repo_path("analysis", "r", "config", "meps_hc256_source_integrity.json")
) {
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    stop("Package 'jsonlite' is required to read source-integrity policy.", call. = FALSE)
  }
  if (!file.exists(path)) {
    stop("HC-256 source-integrity policy is missing: ", path, call. = FALSE)
  }

  policy <- jsonlite::fromJSON(path, simplifyVector = FALSE)
  required <- c(
    "source_id",
    "official_download_url",
    "expected_zip_sha256",
    "expected_extracted_dta_sha256",
    "change_policy"
  )
  missing <- setdiff(required, names(policy))
  if (length(missing)) {
    stop(
      "HC-256 source-integrity policy lacks: ",
      paste(missing, collapse = ", "),
      call. = FALSE
    )
  }
  policy
}

assert_code_commit_matches_github_sha <- function(
  code_commit,
  github_sha = Sys.getenv("GITHUB_SHA", unset = "")
) {
  if (!nzchar(github_sha)) {
    return(invisible(TRUE))
  }
  if (!grepl("^[0-9a-fA-F]{40}$", code_commit) ||
      !grepl("^[0-9a-fA-F]{40}$", github_sha)) {
    stop(
      "Cannot verify GitHub Actions provenance because a commit SHA is malformed.",
      call. = FALSE
    )
  }
  if (!identical(tolower(code_commit), tolower(github_sha))) {
    stop(
      "Code provenance mismatch: git HEAD ", code_commit,
      " does not equal GITHUB_SHA ", github_sha, ".",
      call. = FALSE
    )
  }
  invisible(TRUE)
}
