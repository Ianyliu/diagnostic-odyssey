#!/usr/bin/env python3
"""Offline Draft 2020-12 execution: stdin [ {schema, instance}, ... ]; stdout results.
Test-only standards validator, pinned in workspace test setup. Never a source admission gate.
"""
import json
import pathlib
import sys
from jsonschema import Draft202012Validator

SCHEMAS = pathlib.Path(__file__).resolve().parent.parent / "schema"
ALLOWED = {"input", "egress", "candidate", "output"}

def main():
    validators = {}
    for name in sorted(ALLOWED):
        doc = json.loads((SCHEMAS / f"{name}.v1.schema.json").read_text(encoding="utf-8"))
        Draft202012Validator.check_schema(doc)
        validators[name] = Draft202012Validator(doc)
    cases = json.load(sys.stdin)
    if not isinstance(cases, list) or len(cases) > 100:
        raise SystemExit("expected bounded JSON array of cases")
    results = []
    for case in cases:
        name = case["schema"]
        if name not in ALLOWED:
            raise SystemExit("unknown contract")
        errors = sorted(validators[name].iter_errors(case["instance"]),
                        key=lambda e: (list(map(str, e.absolute_path)), str(e.validator)))
        results.append({"valid": len(errors) == 0,
                        "keywords": [str(e.validator) for e in errors[:5]]})
    json.dump(results, sys.stdout)

if __name__ == "__main__":
    main()
