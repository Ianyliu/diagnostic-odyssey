make_empty_event_files <- function() {
  empty <- data.frame(
    DUPERSID = character(),
    EVNTIDX = character(),
    PERWT24F = numeric(),
    VARSTR = numeric(),
    VARPSU = numeric(),
    stringsAsFactors = FALSE
  )
  list(
    office = empty,
    outpatient = empty,
    emergency = empty,
    inpatient = empty
  )
}

make_u09_condition <- function(dupersid = "P1", condidx = "P101", condn = "01") {
  data.frame(
    DUPERSID = dupersid,
    CONDN = condn,
    CONDIDX = condidx,
    ICD10CDX = "U09",
    stringsAsFactors = FALSE
  )
}

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
  event_files <- make_empty_event_files()
  event_files$office <- data.frame(
    DUPERSID = "P1", EVNTIDX = "E1",
    PERWT24F = 1, VARSTR = 1, VARPSU = 1,
    stringsAsFactors = FALSE
  )
  event_files$outpatient <- data.frame(
    DUPERSID = "P1", EVNTIDX = "E2",
    PERWT24F = 1, VARSTR = 1, VARPSU = 1,
    stringsAsFactors = FALSE
  )
  list(conditions = conditions, links = links, event_files = event_files)
}

testthat::test_that("canonical many-to-many fixture preserves only reconciled U09 encounters", {
  x <- make_linked_condition_fixture()
  quality <- validate_linkage_invariants(x$conditions, x$links, x$event_files)
  footprint <- derive_u09_event_footprint(x$conditions, x$links, x$event_files)

  testthat::expect_equal(nrow(x$links), 3L)
  testthat::expect_equal(nrow(footprint$u09_raw_links), 2L)
  testthat::expect_equal(nrow(footprint$u09_supported_links), 2L)
  testthat::expect_equal(nrow(footprint$u09_reconciled_links), 2L)
  testthat::expect_equal(nrow(footprint$unique_u09_events), 2L)
  testthat::expect_equal(nrow(footprint$per_person), 1L)
  testthat::expect_equal(footprint$per_person$u09_condition_n, 1L)
  testthat::expect_equal(footprint$per_person$u09_event_n, 2L)
  testthat::expect_equal(quality$unmatched_condidx_n, 0L)
  testthat::expect_equal(quality$condidx_person_mismatch_n, 0L)
  testthat::expect_equal(quality$unmatched_evntidx_n, 0L)
  testthat::expect_equal(quality$event_family_mismatch_n, 0L)
  testthat::expect_equal(quality$duplicate_condition_event_pair_n, 0L)
  testthat::expect_equal(quality$clnkidx_composition_mismatch_n, 0L)
})

testthat::test_that("U09 condition presence survives when only excluded links exist", {
  conditions <- make_u09_condition()
  links <- data.frame(
    DUPERSID = "P1",
    CONDIDX = "P101",
    EVNTIDX = "RX1",
    CLNKIDX = "P101RX1",
    EVENTYPE = 8,
    stringsAsFactors = FALSE
  )
  footprint <- derive_u09_event_footprint(
    conditions, links, make_empty_event_files()
  )

  testthat::expect_equal(nrow(footprint$u09_raw_links), 1L)
  testthat::expect_equal(nrow(footprint$u09_supported_links), 0L)
  testthat::expect_equal(nrow(footprint$u09_reconciled_links), 0L)
  testthat::expect_equal(nrow(footprint$unique_u09_events), 0L)
  testthat::expect_equal(footprint$per_person$u09_condition_n, 1L)
  testthat::expect_equal(footprint$per_person$u09_event_n, 0L)

  hc256 <- data.frame(DUPERSID = "P1", stringsAsFactors = FALSE)
  collapsed <- collapse_u09_to_hc256(hc256, footprint)
  testthat::expect_true(collapsed$do_has_u09_condition)
  testthat::expect_false(collapsed$do_has_u09_linked_event)
})

testthat::test_that("missing EVNTIDX remains visible but cannot enter qualifying footprint", {
  conditions <- make_u09_condition()
  links <- data.frame(
    DUPERSID = "P1",
    CONDIDX = "P101",
    EVNTIDX = "MISSING",
    CLNKIDX = "P101MISSING",
    EVENTYPE = 1,
    stringsAsFactors = FALSE
  )
  event_files <- make_empty_event_files()

  quality <- validate_linkage_invariants(conditions, links, event_files)
  footprint <- derive_u09_event_footprint(conditions, links, event_files)

  testthat::expect_equal(quality$unmatched_evntidx_n, 1L)
  testthat::expect_equal(nrow(footprint$u09_supported_links), 1L)
  testthat::expect_equal(nrow(footprint$u09_reconciled_links), 0L)
  testthat::expect_equal(nrow(footprint$unique_u09_events), 0L)
  testthat::expect_equal(footprint$per_person$u09_condition_n, 1L)
  testthat::expect_equal(footprint$per_person$u09_event_n, 0L)
})

testthat::test_that("condition-person mismatch is diagnosed and disqualified", {
  conditions <- make_u09_condition()
  links <- data.frame(
    DUPERSID = "P2",
    CONDIDX = "P101",
    EVNTIDX = "E1",
    CLNKIDX = "P101E1",
    EVENTYPE = 1,
    stringsAsFactors = FALSE
  )
  event_files <- make_empty_event_files()
  event_files$office <- data.frame(
    DUPERSID = "P2", EVNTIDX = "E1",
    PERWT24F = 1, VARSTR = 1, VARPSU = 1,
    stringsAsFactors = FALSE
  )

  quality <- validate_linkage_invariants(conditions, links, event_files)
  footprint <- derive_u09_event_footprint(conditions, links, event_files)

  testthat::expect_equal(quality$condidx_person_mismatch_n, 1L)
  testthat::expect_equal(quality$unmatched_evntidx_n, 0L)
  testthat::expect_equal(nrow(footprint$u09_supported_links), 1L)
  testthat::expect_equal(nrow(footprint$u09_reconciled_links), 0L)
  testthat::expect_equal(nrow(footprint$unique_u09_events), 0L)
  testthat::expect_equal(footprint$per_person$u09_condition_n, 1L)
})

testthat::test_that("EVENTYPE-event-family mismatch is diagnosed and disqualified", {
  conditions <- make_u09_condition()
  links <- data.frame(
    DUPERSID = "P1",
    CONDIDX = "P101",
    EVNTIDX = "E1",
    CLNKIDX = "P101E1",
    EVENTYPE = 2,
    stringsAsFactors = FALSE
  )
  event_files <- make_empty_event_files()
  event_files$office <- data.frame(
    DUPERSID = "P1", EVNTIDX = "E1",
    PERWT24F = 1, VARSTR = 1, VARPSU = 1,
    stringsAsFactors = FALSE
  )

  quality <- validate_linkage_invariants(conditions, links, event_files)
  footprint <- derive_u09_event_footprint(conditions, links, event_files)

  testthat::expect_equal(quality$event_family_mismatch_n, 1L)
  testthat::expect_equal(quality$unmatched_evntidx_n, 0L)
  testthat::expect_equal(nrow(footprint$u09_supported_links), 1L)
  testthat::expect_equal(nrow(footprint$u09_reconciled_links), 0L)
  testthat::expect_equal(nrow(footprint$unique_u09_events), 0L)
})

testthat::test_that("multiple U09 condition records pointing to one valid event count one encounter", {
  conditions <- rbind(
    make_u09_condition("P1", "P101", "01"),
    make_u09_condition("P1", "P102", "02")
  )
  links <- data.frame(
    DUPERSID = c("P1", "P1"),
    CONDIDX = c("P101", "P102"),
    EVNTIDX = c("E1", "E1"),
    CLNKIDX = c("P101E1", "P102E1"),
    EVENTYPE = c(1, 1),
    stringsAsFactors = FALSE
  )
  event_files <- make_empty_event_files()
  event_files$office <- data.frame(
    DUPERSID = "P1", EVNTIDX = "E1",
    PERWT24F = 1, VARSTR = 1, VARPSU = 1,
    stringsAsFactors = FALSE
  )

  footprint <- derive_u09_event_footprint(conditions, links, event_files)
  testthat::expect_equal(nrow(footprint$u09_supported_links), 2L)
  testthat::expect_equal(nrow(footprint$u09_reconciled_links), 2L)
  testthat::expect_equal(nrow(footprint$unique_u09_events), 1L)
  testthat::expect_equal(footprint$per_person$u09_condition_n, 2L)
  testthat::expect_equal(footprint$per_person$u09_event_n, 1L)
})

testthat::test_that("collapse preserves governed HC-256 cohort fields and zero-link target persons", {
  conditions <- make_u09_condition()
  links <- data.frame(
    DUPERSID = "P1",
    CONDIDX = "P101",
    EVNTIDX = "MISSING",
    CLNKIDX = "P101MISSING",
    EVENTYPE = 1,
    stringsAsFactors = FALSE
  )
  footprint <- derive_u09_event_footprint(
    conditions, links, make_empty_event_files()
  )
  hc256 <- data.frame(
    DUPERSID = c("P1", "P2"),
    PERWT24F = c(1, 2),
    VARSTR = c(1, 1),
    VARPSU = c(1, 2),
    do_current_long_covid = c(TRUE, TRUE),
    do_age_18_64 = c(TRUE, TRUE),
    do_current_long_covid_known = c(TRUE, TRUE),
    stringsAsFactors = FALSE
  )
  original <- hc256
  collapsed <- collapse_u09_to_hc256(hc256, footprint)

  testthat::expect_equal(nrow(collapsed), nrow(original))
  testthat::expect_identical(as.character(collapsed$DUPERSID), as.character(original$DUPERSID))
  testthat::expect_identical(
    names(collapsed)[seq_along(names(original))],
    names(original)
  )
  for (field in names(original)) {
    testthat::expect_identical(collapsed[[field]], original[[field]])
  }

  testthat::expect_true("do_current_long_covid" %in% names(collapsed))
  testthat::expect_true("do_age_18_64" %in% names(collapsed))
  testthat::expect_true("do_current_long_covid_known" %in% names(collapsed))
  testthat::expect_false("DO_CURRENT_LONG_COVID" %in% names(collapsed))
  testthat::expect_false("DO_AGE_18_64" %in% names(collapsed))
  testthat::expect_false("DO_CURRENT_LONG_COVID_KNOWN" %in% names(collapsed))

  testthat::expect_equal(collapsed$do_u09_condition_n, c(1L, 0L))
  testthat::expect_equal(collapsed$do_u09_linked_event_n, c(0L, 0L))
  testthat::expect_equal(collapsed$do_has_u09_condition, c(TRUE, FALSE))
  testthat::expect_equal(collapsed$do_has_u09_linked_event, c(FALSE, FALSE))
})


testthat::test_that("post-collapse target contract reproduces governed target membership", {
  conditions <- make_u09_condition()
  links <- data.frame(
    DUPERSID = "P1",
    CONDIDX = "P101",
    EVNTIDX = "MISSING",
    CLNKIDX = "P101MISSING",
    EVENTYPE = 1,
    stringsAsFactors = FALSE
  )
  footprint <- derive_u09_event_footprint(
    conditions, links, make_empty_event_files()
  )
  hc256 <- data.frame(
    DUPERSID = c("P1", "P2", "P3"),
    PERWT24F = c(1, 2, 3),
    VARSTR = c(1, 1, 2),
    VARPSU = c(1, 2, 1),
    do_current_long_covid = c(TRUE, TRUE, FALSE),
    do_age_18_64 = c(TRUE, TRUE, TRUE),
    do_current_long_covid_known = c(TRUE, TRUE, TRUE),
    stringsAsFactors = FALSE
  )

  combined <- collapse_u09_to_hc256(hc256, footprint)
  target <- build_linked_condition_target(combined)

  testthat::expect_length(target, nrow(combined))
  testthat::expect_identical(target, c(TRUE, TRUE, FALSE))
  testthat::expect_true(target[1])
  testthat::expect_true(combined$do_has_u09_condition[1])
  testthat::expect_false(combined$do_has_u09_linked_event[1])
  testthat::expect_true(target[2])
  testthat::expect_false(combined$do_has_u09_condition[2])
  testthat::expect_false(combined$do_has_u09_linked_event[2])
})

testthat::test_that("post-collapse target contract fails fast on missing governed fields", {
  combined <- data.frame(
    DUPERSID = "P1",
    PERWT24F = 1,
    VARSTR = 1,
    VARPSU = 1,
    do_current_long_covid = TRUE,
    do_has_u09_condition = FALSE,
    do_has_u09_linked_event = FALSE,
    stringsAsFactors = FALSE
  )
  testthat::expect_error(
    build_linked_condition_target(combined),
    "missing post-collapse HC-256 fields: do_age_18_64"
  )
})

testthat::test_that("same valid event linked to U09 and another condition counts once for U09", {
  x <- make_linked_condition_fixture()
  footprint <- derive_u09_event_footprint(x$conditions, x$links, x$event_files)
  testthat::expect_equal(sum(footprint$unique_u09_events$EVNTIDX == "E1"), 1L)
})

testthat::test_that("one U09 condition linked to multiple valid events preserves both encounters", {
  x <- make_linked_condition_fixture()
  footprint <- derive_u09_event_footprint(x$conditions, x$links, x$event_files)
  testthat::expect_setequal(footprint$unique_u09_events$EVNTIDX, c("E1", "E2"))
})

testthat::test_that("duplicate CLNKIDX remains a link-quality diagnostic", {
  x <- make_linked_condition_fixture()
  x$links$CLNKIDX[3] <- x$links$CLNKIDX[1]
  quality <- validate_linkage_invariants(x$conditions, x$links, x$event_files)
  testthat::expect_gt(quality$duplicate_clnkidx_n, 0L)
})

testthat::test_that("unsupported EVENTYPE is diagnosed and home health/Rx remain excluded", {
  x <- make_linked_condition_fixture()
  x$links$EVENTYPE[1] <- 9
  quality <- validate_linkage_invariants(x$conditions, x$links, x$event_files)
  testthat::expect_equal(quality$unsupported_eventype_n, 1L)
  testthat::expect_equal(quality$unsupported_eventype_values, "9")
  testthat::expect_true(is.na(canonical_event_family(7)))
  testthat::expect_true(is.na(canonical_event_family(8)))
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

testthat::test_that("committed linked-condition source registry passes pin validation", {
  cfg <- read_linked_condition_source_config()
  testthat::expect_invisible(assert_linked_condition_source_pins(cfg))
})

testthat::test_that("linked-condition source pins fail closed for null and malformed hashes", {
  cfg <- read_linked_condition_source_config()

  null_zip <- cfg
  null_zip$sources[[1]]$expected_zip_sha256 <- NULL
  testthat::expect_error(
    assert_linked_condition_source_pins(null_zip),
    "not fully pinned from verified official bytes"
  )

  null_dta <- cfg
  null_dta$sources[[1]]$expected_extracted_dta_sha256 <- NULL
  testthat::expect_error(
    assert_linked_condition_source_pins(null_dta),
    "not fully pinned from verified official bytes"
  )

  malformed_zip <- cfg
  malformed_zip$sources[[1]]$expected_zip_sha256 <- "not-a-hash"
  testthat::expect_error(
    assert_linked_condition_source_pins(malformed_zip),
    "not fully pinned from verified official bytes"
  )

  malformed_dta <- cfg
  malformed_dta$sources[[1]]$expected_extracted_dta_sha256 <- "xyz"
  testthat::expect_error(
    assert_linked_condition_source_pins(malformed_dta),
    "not fully pinned from verified official bytes"
  )

  short_zip <- cfg
  short_zip$sources[[1]]$expected_zip_sha256 <- paste(rep("a", 63), collapse = "")
  testthat::expect_error(
    assert_linked_condition_source_pins(short_zip),
    "not fully pinned from verified official bytes"
  )

  long_dta <- cfg
  long_dta$sources[[1]]$expected_extracted_dta_sha256 <- paste(rep("b", 65), collapse = "")
  testthat::expect_error(
    assert_linked_condition_source_pins(long_dta),
    "not fully pinned from verified official bytes"
  )
})

testthat::test_that("configured analytical member selection is exact and case-insensitive", {
  listing <- data.frame(Name = c("README.txt", "nested/H254IF1.DTA"), stringsAsFactors = FALSE)
  testthat::expect_equal(
    select_expected_dta_member(listing, "h254if1.dta", "HC-254I"),
    "nested/H254IF1.DTA"
  )
  testthat::expect_error(
    select_expected_dta_member(listing, "h254i.dta", "HC-254I"),
    "expected exactly one configured analytical Stata member"
  )
})

testthat::test_that("zero qualifying U09 events produce an explicit zero multiplicity diagnostic", {
  empty_links <- data.frame(
    DUPERSID = character(),
    CONDIDX = character(),
    EVNTIDX = character(),
    stringsAsFactors = FALSE
  )
  codes <- setNames(character(), character())
  testthat::expect_identical(
    count_qualifying_u09_events_with_additional_non_u09_links(empty_links, codes),
    0L
  )
})

testthat::test_that("Phase A guardrails still prohibit spending and pathway overclaims", {
  g <- linked_condition_guardrails()
  testthat::expect_true(any(grepl("no spending estimator", g, ignore.case = TRUE)))
  testthat::expect_true(any(grepl("diagnostic-delay", g, fixed = TRUE)))
  testthat::expect_true(any(grepl("referral", g, fixed = TRUE)))
  testthat::expect_true(any(grepl("provider-recognition-rate", g, fixed = TRUE)))
})
