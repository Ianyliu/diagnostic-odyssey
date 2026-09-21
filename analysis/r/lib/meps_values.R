meps_reserved_to_na <- function(x) {
  out <- as.numeric(x)
  out[!is.na(out) & out < 0] <- NA_real_
  out
}

meps_binary_12 <- function(x) {
  raw <- as.numeric(x)
  out <- rep(NA, length(raw))
  out[!is.na(raw) & raw == 1] <- TRUE
  out[!is.na(raw) & raw == 2] <- FALSE
  as.logical(out)
}

meps_nonnegative <- function(x) {
  raw <- as.numeric(x)
  raw[!is.na(raw) & raw < 0] <- NA_real_
  raw
}

meps_bounded_score <- function(x, minimum, maximum) {
  raw <- as.numeric(x)
  valid <- !is.na(raw) & raw >= minimum & raw <= maximum
  out <- rep(NA_real_, length(raw))
  out[valid] <- raw[valid]
  out
}

meps_yes_no_response <- function(x) {
  raw <- as.numeric(x)
  out <- rep(NA_real_, length(raw))
  out[!is.na(raw) & raw == 1] <- 1
  out[!is.na(raw) & raw == 2] <- 0
  out
}
