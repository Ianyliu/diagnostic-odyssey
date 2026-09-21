#!/usr/bin/env Rscript

required <- c("haven", "jsonlite", "survey", "testthat")
missing <- required[!vapply(required, requireNamespace, logical(1), quietly = TRUE)]

if (length(missing)) {
  message("Installing missing R packages: ", paste(missing, collapse = ", "))
  repos <- getOption("repos")
  if (is.null(repos) || !length(repos) || identical(unname(repos[["CRAN"]]), "@CRAN@")) {
    repos <- c(CRAN = "https://cloud.r-project.org")
  }
  install.packages(missing, repos = repos)
}

still_missing <- required[!vapply(required, requireNamespace, logical(1), quietly = TRUE)]
if (length(still_missing)) {
  stop("Unable to install required packages: ", paste(still_missing, collapse = ", "), call. = FALSE)
}

message("R analysis dependencies are available.")
for (pkg in required) {
  message(sprintf("  %s %s", pkg, as.character(utils::packageVersion(pkg))))
}
