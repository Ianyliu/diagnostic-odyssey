#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:?usage: verify_candidate_output.sh OUTPUT_DIR}"

expected_files=(
  "local-context.json"
  "diagnostics.json"
  "review-manifest.json"
  "hrsa-source-metadata.json"
  "acs-source-metadata.json"
  "github-actions-run-manifest.json"
  "SHA256SUMS"
)

expected_sorted="$(printf '%s\n' "${expected_files[@]}" | LC_ALL=C sort)"
actual_sorted="$(find "$OUTPUT_DIR" -maxdepth 1 -type f -printf '%f\n' | LC_ALL=C sort)"

if ! diff -u <(printf '%s\n' "$expected_sorted") <(printf '%s\n' "$actual_sorted"); then
  echo "::error::Unexpected candidate output file set"
  exit 1
fi

if [[ -n "${CENSUS_API_KEY:-}" ]] && grep -R -F -- "$CENSUS_API_KEY" "$OUTPUT_DIR" >/dev/null; then
  echo "::error::Census API key found in candidate output"
  exit 1
fi

if find "$OUTPUT_DIR" -type f \(   -name '*.csv' -o   -name '*.zip' -o   -name '*.dta' -o   -name '*.parquet' \) | grep -q .; then
  echo "::error::Raw/intermediate data-like file found in candidate output"
  exit 1
fi

(
  cd "$OUTPUT_DIR"
  sha256sum -c SHA256SUMS
)
