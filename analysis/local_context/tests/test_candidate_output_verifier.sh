#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
VERIFY="$ROOT/analysis/local_context/verify_candidate_output.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Create files in an order deliberately unrelated to lexical sorting.
for name in   review-manifest.json   local-context.json   hrsa-source-metadata.json   github-actions-run-manifest.json   diagnostics.json   acs-source-metadata.json
do
  printf '{"file":"%s"}\n' "$name" > "$TMP/$name"
done

(
  cd "$TMP"
  sha256sum     acs-source-metadata.json     diagnostics.json     github-actions-run-manifest.json     hrsa-source-metadata.json     local-context.json     review-manifest.json     > SHA256SUMS
)

CENSUS_API_KEY="unit-test-secret" bash "$VERIFY" "$TMP"

printf 'extra\n' > "$TMP/unexpected.txt"
if CENSUS_API_KEY="unit-test-secret" bash "$VERIFY" "$TMP" >/dev/null 2>&1; then
  echo "verifier accepted an unexpected file" >&2
  exit 1
fi
rm "$TMP/unexpected.txt"

printf 'unit-test-secret\n' >> "$TMP/diagnostics.json"
if CENSUS_API_KEY="unit-test-secret" bash "$VERIFY" "$TMP" >/dev/null 2>&1; then
  echo "verifier accepted leaked credential text" >&2
  exit 1
fi
