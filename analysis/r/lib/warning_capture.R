new_warning_registry <- function() {
  new.env(parent = emptyenv())
}

warning_key <- function(stage, condition_class, message) {
  paste(stage, condition_class, message, sep = "\u241F")
}

record_analytical_warning <- function(registry, stage, warning_condition) {
  condition_class <- paste(class(warning_condition), collapse = "|")
  message_text <- conditionMessage(warning_condition)
  key <- warning_key(stage, condition_class, message_text)

  if (exists(key, envir = registry, inherits = FALSE)) {
    record <- get(key, envir = registry, inherits = FALSE)
    record$count <- record$count + 1L
  } else {
    record <- list(
      stage = stage,
      condition_class = condition_class,
      message = message_text,
      count = 1L
    )
  }
  assign(key, record, envir = registry)
  invisible(record)
}

run_stage_with_warning_capture <- function(stage, expression, registry) {
  if (!is.environment(registry)) {
    stop("warning registry must be an environment", call. = FALSE)
  }

  old_warn <- getOption("warn")
  options(warn = 1)
  on.exit(options(warn = old_warn), add = TRUE)

  withCallingHandlers(
    force(expression),
    warning = function(w) {
      record_analytical_warning(registry, stage, w)
      # Do not muffle the warning: with warn=1 the original warning remains
      # immediately visible in GitHub Actions while also being recorded.
    }
  )
}

warning_registry_records <- function(registry) {
  keys <- sort(ls(registry, all.names = TRUE))
  if (!length(keys)) return(list())
  unname(lapply(keys, function(key) get(key, envir = registry, inherits = FALSE)))
}
