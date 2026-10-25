"""Compare real, fixed-clock browser downloads from base and candidate servers."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys

before, after, report_path = map(Path, sys.argv[1:])
results = []
for stage in ["empty", "created", "stale", "refreshed-unselected", "refreshed-selected", "removed"]:
    old_json = (before / f"{stage}.json").read_bytes()
    new_json = (after / f"{stage}.json").read_bytes()
    old_text, new_text = [subprocess.check_output(["pdftotext", str(root / f"{stage}.pdf"), "-"]) for root in [before, after]]
    page_counts = []
    for root in [before, after]:
        info = subprocess.check_output(["pdfinfo", str(root / f"{stage}.pdf")], text=True)
        page_counts.append(int(next(line for line in info.splitlines() if line.startswith("Pages:")).split(":")[1]))
    result = {"stage": stage, "json_byte_equal": old_json == new_json, "pdf_text_equal": old_text == new_text,
              "pdf_pages": page_counts, "json_sha256": hashlib.sha256(new_json).hexdigest(),
              "pdf_text_sha256": hashlib.sha256(new_text).hexdigest()}
    results.append(result)

report = {"passed": all(result["json_byte_equal"] and result["pdf_text_equal"] and result["pdf_pages"][0] == result["pdf_pages"][1] for result in results),
          "ignored_fields": [], "clock": "2026-10-25T15:00:00Z", "results": results,
          "limits": "PDF text and page count comparison; binary PDF equality is not asserted. Screenshots and rendered pages are reviewed separately."}
report_path.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
assert report["passed"], "Canonical browser exports changed; inspect comparison before merging."
