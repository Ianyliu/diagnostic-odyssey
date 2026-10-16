"""Inspect actual Chromium PDFs; requires test-only pdfplumber (never bundled).

Usage: python3 tests/browser/verify-insights-pdfs.py SCREEN_OUTPUT
"""
import json
import logging
import sys
from pathlib import Path

import pdfplumber

logging.getLogger("pdfminer").setLevel(logging.ERROR)
directory = Path(sys.argv[1])
results = []
for filename in ["summary-off.pdf", "summary-on.pdf", "summary-all-context.pdf", "summary-extreme.pdf"]:
    with pdfplumber.open(directory / filename) as pdf:
        page_text = []
        clearances = []
        for index, page in enumerate(pdf.pages):
            words = page.extract_words()
            brand = [word for word in words if word["text"] == "Diagnostic" and word["top"] > page.height - 80]
            assert len(brand) == 1, (filename, index + 1, "Missing or ambiguous footer")
            footer_top = brand[0]["top"]
            # Footer typography is 6.8pt. Source locators in the summary are 7pt;
            # they remain body content and must not be mistaken for a footer.
            body = [char for char in page.chars if abs(char["size"] - 6.8) > .05 and char["text"].strip()]
            clearance = footer_top - max(char["bottom"] for char in body)
            assert clearance >= 4, (filename, index + 1, "Body collides with fixed footer", clearance)
            clearances.append(clearance)
            page_text.append(page.extract_text())
        text = "\n".join(page_text)
        if filename == "summary-off.pdf":
            assert "Planning insights summary" not in text
        else:
            assert "Planning insights summary" in text
            summary = text.split("Decision state", 1)[0]
            assert "Reviewed record:" in summary, (filename, "Missing reviewed estimate identifiers")
            assert "exact source locator" in summary, (filename, "Missing full-provenance handoff")
            if filename == "summary-on.pdf":
                assert len(pdf.pages) <= 8, (filename, "Basic opt-in summary exceeds one additional page", len(pdf.pages))
            assert "Universe:" in summary and "Denominator:" in summary
            for unaccepted_prompt in ["Verify available capacity", "Verify pathway timing", "Possible source owner"]:
                assert unaccepted_prompt not in summary
        results.append({"file": filename, "pages": len(pdf.pages), "minimum_footer_clearance_pt": min(clearances)})
report = {"passed": True, "results": results}
(directory / "pdf-verification.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
