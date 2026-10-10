#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
VERIFY="$ROOT/analysis/local_context/verify_candidate_output.sh"
EXPECTED="$ROOT/analysis/local_context/expected_candidate_output_files.txt"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

payload_files=()
while IFS= read -r name; do
  [[ -n "$name" ]] || continue
  [[ "$name" == "SHA256SUMS" ]] && continue
  payload_files+=("$name")
done < "$EXPECTED"

reset_candidate() {
  rm -rf "$TMP"
  mkdir -p "$TMP"
  for name in "${payload_files[@]}"; do
    printf '{"file":"%s"}\n' "$name" > "$TMP/$name"
  done
  recompute_checksums
}

recompute_checksums() {
  (
    cd "$TMP"
    python3 - "${payload_files[@]}" > SHA256SUMS <<'PYTHON'
import hashlib
from pathlib import Path
import sys

for name in sys.argv[1:]:
    print(f"{hashlib.sha256(Path(name).read_bytes()).hexdigest()}  {name}")
PYTHON
  )
}

expect_failure() {
  local label="$1"
  shift
  if "$@" >/dev/null 2>&1; then
    echo "verifier accepted $label" >&2
    exit 1
  fi
}

reset_candidate
CENSUS_API_KEY="unit-test-secret" bash "$VERIFY" "$TMP"

printf 'extra\n' > "$TMP/unexpected.txt"
expect_failure "an unexpected regular file" env CENSUS_API_KEY="unit-test-secret" bash "$VERIFY" "$TMP"

reset_candidate
mkdir "$TMP/unexpected-dir"
expect_failure "an unexpected directory" env CENSUS_API_KEY="unit-test-secret" bash "$VERIFY" "$TMP"

reset_candidate
rm "$TMP/diagnostics.json"
ln -s local-context.json "$TMP/diagnostics.json"
expect_failure "a symlink replacing an expected output" env CENSUS_API_KEY="unit-test-secret" bash "$VERIFY" "$TMP"

reset_candidate
printf 'unit-test-secret\n' >> "$TMP/diagnostics.json"
expect_failure "leaked credential text" env CENSUS_API_KEY="unit-test-secret" bash "$VERIFY" "$TMP"

reset_candidate
printf '{"url":"https://api.census.gov/data?key=[REDACTED]"}\n' > "$TMP/diagnostics.json"
recompute_checksums
error_output="$(
  CENSUS_API_KEY="" bash "$VERIFY" "$TMP" 2>&1 || true
)"
if [[ "$error_output" != *"Census-style keyed URL found"* ]]; then
  echo "verifier did not reject ?key= specifically after checksum recomputation" >&2
  echo "$error_output" >&2
  exit 1
fi

reset_candidate
printf '{"url":"https://api.census.gov/data?get=NAME&KEY=redacted"}\n' > "$TMP/diagnostics.json"
recompute_checksums
error_output="$(
  CENSUS_API_KEY="" bash "$VERIFY" "$TMP" 2>&1 || true
)"
if [[ "$error_output" != *"Census-style keyed URL found"* ]]; then
  echo "verifier did not reject &key= case-insensitively after checksum recomputation" >&2
  echo "$error_output" >&2
  exit 1
fi

reset_candidate
printf 'tamper\n' >> "$TMP/diagnostics.json"
expect_failure "a checksum mismatch" env CENSUS_API_KEY="" bash "$VERIFY" "$TMP"

reset_candidate
mkdir "$TMP/.unexpected-hidden-dir"
expect_failure "a hidden directory" bash "$VERIFY" "$TMP"

reset_candidate
rm "$TMP/diagnostics.json"
mkdir "$TMP/diagnostics.json"
printf 'nested\n' > "$TMP/diagnostics.json/nested.json"
expect_failure "a directory replacing expected output" bash "$VERIFY" "$TMP"

reset_candidate
rm "$TMP/diagnostics.json"
mkfifo "$TMP/diagnostics.json"
expect_failure "a FIFO replacing expected output" bash "$VERIFY" "$TMP"

reset_candidate
rm "$TMP/diagnostics.json"
expect_failure "missing output" bash "$VERIFY" "$TMP"

reset_candidate
: > "$TMP/SHA256SUMS"
expect_failure "an empty checksum manifest" bash "$VERIFY" "$TMP"

reset_candidate
sed '$d' "$TMP/SHA256SUMS" > "$TMP/checksums.tmp"
mv "$TMP/checksums.tmp" "$TMP/SHA256SUMS"
expect_failure "an incomplete checksum manifest" bash "$VERIFY" "$TMP"

reset_candidate
head -n 1 "$TMP/SHA256SUMS" >> "$TMP/SHA256SUMS"
expect_failure "a duplicate checksum entry" bash "$VERIFY" "$TMP"

reset_candidate
printf '%064d  ../outside.json\n' 0 >> "$TMP/SHA256SUMS"
expect_failure "a checksum path outside the output directory" bash "$VERIFY" "$TMP"

reset_candidate
printf 'not-a-checksum\n' > "$TMP/SHA256SUMS"
expect_failure "a malformed checksum entry" bash "$VERIFY" "$TMP"

reset_candidate
ln -s "$TMP" "$TMP-link"
expect_failure "a symlink output directory" bash "$VERIFY" "$TMP-link"
rm "$TMP-link"

expect_failure "a nonexistent output directory" bash "$VERIFY" "$TMP/missing"

echo "candidate output verifier regression tests passed"
