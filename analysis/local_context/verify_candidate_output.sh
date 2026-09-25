#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:?usage: verify_candidate_output.sh OUTPUT_DIR}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EXPECTED_FILE_SET="$ROOT/analysis/local_context/expected_candidate_output_files.txt"

mapfile -t expected_files < <(sed '/^[[:space:]]*$/d' "$EXPECTED_FILE_SET")
if [[ "${#expected_files[@]}" -eq 0 ]]; then
  echo "::error::Expected candidate output file set is empty"
  exit 1
fi

expected_sorted="$(printf '%s\n' "${expected_files[@]}" | LC_ALL=C sort)"
actual_sorted="$(find "$OUTPUT_DIR" -mindepth 1 -maxdepth 1 -printf '%f\n' | LC_ALL=C sort)"

if ! diff -u <(printf '%s\n' "$expected_sorted") <(printf '%s\n' "$actual_sorted"); then
  echo "::error::Unexpected candidate output file set"
  exit 1
fi

while IFS= read -r name; do
  entry="$OUTPUT_DIR/$name"
  if [[ -L "$entry" || ! -f "$entry" ]]; then
    echo "::error::Candidate output entry is not a regular file: $name"
    exit 1
  fi
done < "$EXPECTED_FILE_SET"

if [[ -n "${CENSUS_API_KEY:-}" ]] && grep -R -F -- "$CENSUS_API_KEY" "$OUTPUT_DIR" >/dev/null; then
  echo "::error::Census API key found in candidate output"
  exit 1
fi

if grep -R -E -i -- '[?&]key=' "$OUTPUT_DIR" >/dev/null; then
  echo "::error::Census-style keyed URL found in candidate output"
  exit 1
fi

if find "$OUTPUT_DIR" -type f \( \
  -name '*.csv' -o \
  -name '*.zip' -o \
  -name '*.dta' -o \
  -name '*.parquet' \
\) | grep -q .; then
  echo "::error::Raw/intermediate data-like file found in candidate output"
  exit 1
fi

(
  cd "$OUTPUT_DIR"
  sha256sum -c SHA256SUMS
)
