make_linked_condition_fixture <- function() {
  conditions <- data.frame(
    DUPERSID = c("P1", "P1"),
    CONDN = c("01", "02"),
    CONDIDX = c("P101", "P102"),
    ICD10CDX = c("U09", "J45"),
    CCSR1X = NA_character_,
    CCSR2X = NA_character_,
    CCSR3X = NA_character_,
    CCSR4X = NA_character_,
    PERWT24F = 1,
    VARSTR = 1,
    VARPSU = 1,
    stringsAsFactors = FALSE
  )
  links <- data.frame(
    DUPERSID = c("P1", "P1", "P1"),
    CONDIDX = c("P101", "P102", "P101"),
    EVNTIDX = c("E1", "E1", "E2"),
    CLNKIDX = c("P101E1", "P102E1", "P101E2"),
    EVENTYPE = c(1, 1, 2),
    stringsAsFactors = FALSE
  )
  event_files <- list(
    office = data.frame(DUPERSID = "P1", EVNTIDX = "E1", PERWT24F = 1, VARSTR = 1, VARPSU = 1),
    outpatient = data.frame(DUPERSID = "P1", EVNTIDX = "E2", PERWT24F = 1, VARSTR = 1, VARPSU = 1),
    emergency = data.frame(DUPERSID = character(), EVNTIDX = character(), PERWT24F = numeric(), VARSTR = numeric(), VARPSU = numeric()),
    inpatient = data.frame(DUPERSID = character(), EVNTIDX = character(), PERWT24F = numeric(), VARSTR = numeric(), VARPSU = numeric())
  )
  list(conditions = conditions, links = links, event_files = event_files)
}

testthat::test_that("canonical many-to-many fixture deduplicates events correctly", {
  x <- make_linked_condition_fixture()
  quality <- validate_linkage_invariants(x$conditions, x$links, x$event_files)
  footprint <- derive_u09_event_footprint(x$conditions, x$links, x$event_files)

  testthat::expect_equal(nrow(x$links), 3L)
  testthat::expect_equal(nrow(footprint$unique_u09_events), 2L)
  testthat::expect_equal(nrow(footprint$u09_links), 2L)
  testthat::expect_equal(nrow(footprint$per_person), 1L)
  testthat::expect_equal(footprint$per_person$u09_event_n, 2L)
  testthat::expect_equal(quality$unmatched_condidx_n, 0L)
  testthat::expect_equal(quality$unmatched_evntidx_n, 0L)
  testthat::expect_equal(quality$duplicate_condition_event_pair_n, 0L)
  testthat::expect_equal(quality$clnkidx_composition_mismatch_n, 0L)
})

testthat::test_that("same event linked to multiple conditions is counted once for U09", {
  x <- make_linked_condition_fixture()
  footprint <- derive_u09_event_footprint(x$conditions, x$links, x$event_files)
  testthat::expect_equal(sum(footprint$unique_u09_events$EVNTIDX == "E1"), 1L)
})

testthat::test_that("one condition linked to multiple events preserves both unique encounters", {
  x <- make_linked_condition_fixture()
  footprint <- derive_u09_event_footprint(x$conditions, x$links, x$event_files)
  testthat::expect_setequal(footprint$unique_u09_events$EVNTIDX, c("E1", "E2"))
})

testthat::test_that("duplicate CLNKIDX is diagnosed", {
  x <- make_linked_condition_fixture()
  x$links$CLNKIDX[3] <- x$links$CLNKIDX[1]
  quality <- validate_linkage_invariants(x$conditions, x$links, x$event_files)
  testthat::expect_gt(quality$duplicate_clnkidx_n, 0L)
})

testthat::test_that("condition person mismatch and missing referenced event are diagnosed", {
  x <- make_linked_condition_fixture()
  x$links$DUPERSID[1] <- "P9"
  x$links$EVNTIDX[3] <- "MISSING"
  quality <- validate_linkage_invariants(x$conditions, x$links, x$event_files)
  testthat::expect_equal(quality$condidx_person_mismatch_n, 1L)
  testthat::expect_equal(quality$unmatched_evntidx_n, 2L)
})

testthat::test_that("unsupported EVENTYPE is diagnosed and home health/Rx are excluded by design", {
  x <- make_linked_condition_fixture()
  x$links$EVENTYPE[1] <- 9
  quality <- validate_linkage_invariants(x$conditions, x$links, x$event_files)
  testthat::expect_equal(quality$unsupported_eventype_n, 1L)
  testthat::expect_equal(quality$unsupported_eventype_values, "9")
  testthat::expect_true(is.na(canonical_event_family(7)))
  testthat::expect_true(is.na(canonical_event_family(8)))
})

testthat::test_that("duplicated three-character U09 conditions pointing to one event do not multiply event count", {
  x <- make_linked_condition_fixture()
  extra_condition <- x$conditions[1, , drop = FALSE]
  extra_condition$CONDN <- "03"
  extra_condition$CONDIDX <- "P103"
  x$conditions <- rbind(x$conditions, extra_condition)
  extra_link <- x$links[1, , drop = FALSE]
  extra_link$CONDIDX <- "P103"
  extra_link$CLNKIDX <- "P103E1"
  x$links <- rbind(x$links, extra_link)

  footprint <- derive_u09_event_footprint(x$conditions, x$links, x$event_files)
  testthat::expect_equal(nrow(footprint$u09_links), 3L)
  testthat::expect_equal(nrow(footprint$unique_u09_events), 2L)
})

testthat::test_that("target cohort person with zero qualifying links is preserved after person-level collapse", {
  x <- make_linked_condition_fixture()
  footprint <- derive_u09_event_footprint(x$conditions, x$links, x$event_files)
  hc256 <- data.frame(
    DUPERSID = c("P1", "P2"),
    do_current_long_covid = c(TRUE, TRUE),
    PERWT24F = c(1, 2),
    VARSTR = c(1, 1),
    VARPSU = c(1, 2),
    stringsAsFactors = FALSE
  )
  collapsed <- collapse_u09_to_hc256(hc256, footprint)
  testthat::expect_equal(collapsed$do_u09_linked_event_n, c(2L, 0L))
  testthat::expect_equal(collapsed$do_has_u09_linked_event, c(TRUE, FALSE))
})

testthat::test_that("U09 is exact and U07 is never substituted", {
  conditions <- data.frame(
    DUPERSID = c("P1", "P2"),
    CONDN = c("01", "01"),
    CONDIDX = c("P101", "P201"),
    ICD10CDX = c("U09", "U07"),
    stringsAsFactors = FALSE
  )
  selected <- select_u09_conditions(conditions)
  testthat::expect_equal(nrow(selected), 1L)
  testthat::expect_equal(selected$ICD10CDX, "U09")
})

testthat::test_that("Phase A source registry fails closed while official hashes are unpinned", {
  cfg <- read_linked_condition_source_config()
  testthat::expect_error(
    assert_linked_condition_source_pins(cfg),
    "not fully pinned from verified official bytes"
  )
})

testthat::test_that("Phase A guardrails explicitly prohibit spending attribution and causal/pathway overclaims", {
  g <- linked_condition_guardrails()
  testthat::expect_true(any(grepl("no spending estimator", g, ignore.case = TRUE)))
  testthat::expect_true(any(grepl("diagnostic-delay", g, fixed = TRUE)))
  testthat::expect_true(any(grepl("referral", g, fixed = TRUE)))
  testthat::expect_true(any(grepl("provider-recognition-rate", g, fixed = TRUE)))
})
