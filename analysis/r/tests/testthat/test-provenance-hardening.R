testthat::test_that("SHA-256 helper verifies exact bytes and fails on mismatch", {
  path <- tempfile("sha256-")
  on.exit(unlink(path), add = TRUE)
  writeLines("diagnostic-odyssey-integrity-test", path, useBytes = TRUE)

  observed <- sha256_file(path)
  testthat::expect_match(observed, "^[0-9a-f]{64}$")
  testthat::expect_equal(assert_sha256_matches(path, observed, "synthetic file"), observed)
  testthat::expect_error(
    assert_sha256_matches(path, paste(rep("0", 64), collapse = ""), "synthetic file"),
    "SHA-256 mismatch"
  )
})

testthat::test_that("Actions code provenance must equal GITHUB_SHA when supplied", {
  sha <- "0123456789abcdef0123456789abcdef01234567"
  testthat::expect_true(assert_code_commit_matches_github_sha(sha, sha))
  testthat::expect_error(
    assert_code_commit_matches_github_sha(
      sha,
      "fedcba9876543210fedcba9876543210fedcba98"
    ),
    "Code provenance mismatch"
  )
})

testthat::test_that("reviewed HC-256 integrity policy preserves third-candidate hashes", {
  policy <- read_hc256_source_integrity()

  testthat::expect_equal(
    policy$expected_zip_sha256,
    "653891861ec18574b07f576915e6f9e423263fc947610dc34e1bd176feff7b40"
  )
  testthat::expect_equal(
    policy$expected_extracted_dta_sha256,
    "b4bde859b39f626345561c05570292bb7264dd92eb76ce0c1a14d6b89076aed5"
  )
  testthat::expect_equal(
    policy$reviewed_reference$candidate_run_id,
    "35745589631"
  )
})


testthat::test_that("ZIP and extracted-DTA integrity gates reject mismatches and accept matching bytes", {
  zip_path <- tempfile("hc256-zip-")
  dta_path <- tempfile("hc256-dta-")
  on.exit(unlink(c(zip_path, dta_path)), add = TRUE)
  writeLines("synthetic zip bytes", zip_path, useBytes = TRUE)
  writeLines("synthetic dta bytes", dta_path, useBytes = TRUE)

  zip_hash <- sha256_file(zip_path)
  dta_hash <- sha256_file(dta_path)

  testthat::expect_equal(
    assert_sha256_matches(zip_path, zip_hash, "MEPS HC-256 official Stata ZIP"),
    zip_hash
  )
  testthat::expect_equal(
    assert_sha256_matches(dta_path, dta_hash, "MEPS HC-256 analytical input"),
    dta_hash
  )

  wrong <- paste(rep("0", 64), collapse = "")
  testthat::expect_error(
    assert_sha256_matches(zip_path, wrong, "MEPS HC-256 official Stata ZIP"),
    "SHA-256 mismatch for MEPS HC-256 official Stata ZIP"
  )
  testthat::expect_error(
    assert_sha256_matches(dta_path, wrong, "MEPS HC-256 analytical input"),
    "SHA-256 mismatch for MEPS HC-256 analytical input"
  )
})

testthat::test_that("HC-256 integrity policy requires both expected source hashes", {
  if (!requireNamespace("jsonlite", quietly = TRUE)) testthat::skip("jsonlite unavailable")

  policy <- read_hc256_source_integrity()
  required <- c(
    "source_id",
    "official_download_url",
    "expected_zip_sha256",
    "expected_extracted_dta_sha256",
    "change_policy"
  )
  testthat::expect_true(all(required %in% names(policy)))

  missing_dta <- policy
  missing_dta$expected_extracted_dta_sha256 <- NULL
  dta_path <- tempfile("hc256-policy-dta-", fileext = ".json")
  on.exit(unlink(dta_path), add = TRUE)
  jsonlite::write_json(missing_dta, dta_path, auto_unbox = TRUE)
  testthat::expect_error(
    read_hc256_source_integrity(dta_path),
    "lacks: expected_extracted_dta_sha256"
  )

  missing_zip <- policy
  missing_zip$expected_zip_sha256 <- NULL
  zip_path <- tempfile("hc256-policy-zip-", fileext = ".json")
  on.exit(unlink(zip_path), add = TRUE)
  jsonlite::write_json(missing_zip, zip_path, auto_unbox = TRUE)
  testthat::expect_error(
    read_hc256_source_integrity(zip_path),
    "lacks: expected_zip_sha256"
  )
})
