find_repo_root <- function(start = getwd()) {
  current <- normalizePath(start, winslash = "/", mustWork = TRUE)
  repeat {
    if (file.exists(file.path(current, "package.json")) &&
        file.exists(file.path(current, "analysis", "r"))) {
      return(current)
    }
    parent <- dirname(current)
    if (identical(parent, current)) {
      stop("Could not locate Diagnostic Odyssey repository root.", call. = FALSE)
    }
    current <- parent
  }
}

repo_path <- function(...) {
  file.path(find_repo_root(), ...)
}
