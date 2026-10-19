"""Inspect the compact and all-reviewed native A4 Planning Brief PDFs."""
import json
import logging
import re
import sys
from pathlib import Path

import pdfplumber

logging.getLogger("pdfminer").setLevel(logging.ERROR)
directory = Path(sys.argv[1])
sections = [
    "Reviewed national burden findings", "Pilot planning assumptions",
    "Scenario outputs", "Local implementation context",
    "Intervention-effect evidence", "What to collect next", "Interpretation boundaries",
]


def verify(filename: str):
    with pdfplumber.open(directory / filename) as pdf:
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        for section in sections:
            assert section in text, (filename, "Missing report section", section)
        assert "Planning insights summary" not in text, (filename, "Insights must remain opt-in")
        assert "Analyze with AI" not in text and "Explore future AI concept" not in text, filename
        clearances = []
        for index, page in enumerate(pdf.pages):
            brand = [w for w in page.extract_words() if w["text"] == "Diagnostic" and w["top"] > page.height - 80]
            assert len(brand) == 1, (filename, index + 1, "Missing/repeated footer")
            body = [c for c in page.chars if abs(c["size"] - 6.8) > .05 and c["text"].strip()]
            assert body, (filename, index + 1, "Empty report page")
            clearance = brand[0]["top"] - max(c["bottom"] for c in body)
            assert clearance >= 4, (filename, index + 1, "Footer collision", clearance)
            clearances.append(clearance)
        return {"pages": len(pdf.pages), "minimum_footer_clearance_pt": min(clearances)}, text


compact, compact_text = verify("collapsed-report.pdf")
all_context, all_context_text = verify("all-context-report.pdf")
assert 7 <= compact["pages"] <= 8, ("Compact report unexpectedly grew", compact["pages"])
assert all_context["pages"] > compact["pages"], ("Selected local context did not lengthen the report", compact, all_context)
assert re.search(r"34\\s+selected", all_context_text), "Full-context PDF must show all 34 selected indicators"
result = {
    "passed": True, "required_sections": sections, "optional_insights_absent": True,
    "compact": compact, "all_reviewed_context": all_context,
}
(directory / "pdf-verification.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
