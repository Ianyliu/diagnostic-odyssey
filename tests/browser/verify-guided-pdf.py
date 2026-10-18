"""Inspect the actual A4 PDF printed from the default collapsed Brief."""
import json
import logging
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
with pdfplumber.open(directory / "collapsed-report.pdf") as pdf:
    text = "\n".join(page.extract_text() for page in pdf.pages)
    for section in sections:
        assert section in text, f"Collapsed report omitted {section}"
    assert "Planning insights summary" not in text, "Insights must remain opt-in"
    assert "Analyze with AI" not in text and "Explore future AI concept" not in text
    clearances = []
    for index, page in enumerate(pdf.pages):
        brand = [w for w in page.extract_words() if w["text"] == "Diagnostic" and w["top"] > page.height - 80]
        assert len(brand) == 1, (index + 1, "Missing footer")
        body = [c for c in page.chars if abs(c["size"] - 6.8) > .05 and c["text"].strip()]
        clearance = brand[0]["top"] - max(c["bottom"] for c in body)
        assert clearance >= 4, (index + 1, "Footer collision", clearance)
        clearances.append(clearance)
    result = {"passed": True, "pages": len(pdf.pages), "required_sections": sections,
              "optional_insights_absent": True, "minimum_footer_clearance_pt": min(clearances)}
(directory / "pdf-verification.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
