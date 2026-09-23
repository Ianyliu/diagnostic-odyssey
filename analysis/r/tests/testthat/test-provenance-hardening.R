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
