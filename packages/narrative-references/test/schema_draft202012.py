#!/usr/bin/env python3
"""Execute the unmodified committed JSON Schema with Draft 2020-12 semantics.

stdin: JSON array of catalog instances. stdout: JSON array of results.
A validator installation is required; this tool never falls back to a weaker check.
"""
import json
import sys
from pathlib import Path

try:
    from jsonschema import Draft202012Validator
except ImportError as exc:
    raise SystemExit("Install pinned test dependency: python3 -m pip install jsonschema==4.26.0") from exc


def main():
    if len(sys.argv) != 2:
        raise SystemExit("usage: schema_draft202012.py <schema-file>")
    schema = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    Draft202012Validator.check_schema(schema)
    validator = Draft202012Validator(schema)
    inputs = json.load(sys.stdin)
    if not isinstance(inputs, list):
        raise SystemExit("stdin must contain a JSON array")
    output = []
    for value in inputs:
        errors = sorted(validator.iter_errors(value), key=lambda e: str(list(e.absolute_path)))
        output.append({
            "valid": not errors,
            "errors": [
                {"path": list(e.absolute_path), "keyword": e.validator, "message": e.message}
                for e in errors[:5]
            ],
        })
    json.dump(output, sys.stdout)


if __name__ == "__main__":
    main()
