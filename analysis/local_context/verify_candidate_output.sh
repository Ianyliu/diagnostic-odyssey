#!/usr/bin/env bash
set -euo pipefail

OUTPUT_DIR="${1:?usage: verify_candidate_output.sh OUTPUT_DIR}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

# Python 3 is already required by the candidate pipeline. Its standard library
# avoids GNU-only find/checksum flags and Bash 4-only mapfile on macOS.
python3 - "$OUTPUT_DIR" "$ROOT/analysis/local_context/expected_candidate_output_files.txt" <<'PYTHON'
import hashlib
import os
from pathlib import Path
import re
import sys


def fail(message):
    raise ValueError(message)


def verify(output, expected_path):
    expected = [name for name in expected_path.read_text(encoding="utf-8").splitlines() if name.strip()]
    if not expected:
        fail("Expected candidate output file set is empty")
    if len(set(expected)) != len(expected) or any(Path(name).name != name for name in expected):
        fail("Expected candidate output file set is invalid")
    if output.is_symlink() or not output.is_dir():
        fail("Candidate output must be a regular directory")
    entries = {entry.name: entry for entry in output.iterdir()}
    if set(entries) != set(expected):
        fail("Unexpected candidate output file set: missing="
             + repr(sorted(set(expected) - set(entries)))
             + ", unexpected=" + repr(sorted(set(entries) - set(expected))))
    for name, entry in entries.items():
        if entry.is_symlink() or not entry.is_file():
            fail("Candidate output entry is not a regular file: " + name)

    secret = os.environ.get("CENSUS_API_KEY", "").encode("utf-8")
    for entry in entries.values():
        content = entry.read_bytes()
        if secret and secret in content:
            fail("Census API key found in candidate output")
        if re.search(rb"[?&]key=", content, re.IGNORECASE):
            fail("Census-style keyed URL found in candidate output")
        if entry.suffix.lower() in {".csv", ".zip", ".dta", ".parquet"}:
            fail("Raw/intermediate data-like file found in candidate output")

    # Require exactly one checksum per expected payload. A truncated manifest,
    # duplicate entry, or path outside the directory must never pass verification.
    checksums = {}
    for line in entries["SHA256SUMS"].read_text(encoding="utf-8").splitlines():
        match = re.fullmatch(r"([0-9a-fA-F]{64})  ([^/\\]+)", line)
        if not match or match[2] in checksums or match[2] == "SHA256SUMS":
            fail("Invalid or duplicate SHA256SUMS entry")
        checksums[match[2]] = match[1].lower()
    if set(checksums) != set(expected) - {"SHA256SUMS"}:
        fail("SHA256SUMS does not cover the exact candidate payload file set")
    for name, digest in checksums.items():
        if hashlib.sha256(entries[name].read_bytes()).hexdigest() != digest:
            fail("Checksum mismatch: " + name)
        print(name + ": OK")


try:
    verify(Path(sys.argv[1]), Path(sys.argv[2]))
except (OSError, UnicodeError, ValueError) as error:
    # Do not echo arbitrary file contents or secrets when reporting a failure.
    if isinstance(error, (OSError, UnicodeError)):
        message = "Unable to read candidate output or expected file set"
    else:
        message = str(error)
    print("::error::" + message, file=sys.stderr)
    sys.exit(1)
PYTHON
