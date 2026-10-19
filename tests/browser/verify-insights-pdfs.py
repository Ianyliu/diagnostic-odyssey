"""Inspect actual Chromium PDFs; requires test-only pdfplumber (never bundled).

Usage: python3 tests/browser/verify-insights-pdfs.py SCREEN_OUTPUT
"""
import json
import logging
import shutil
import subprocess
import sys
from pathlib import Path

import pdfplumber

logging.getLogger("pdfminer").setLevel(logging.ERROR)
directory = Path(sys.argv[1])
results = []
for filename in ["summary-off.pdf", "summary-on.pdf", "summary-all-context.pdf", "summary-extreme.pdf",
                 "brief-default-34-concise.pdf", "brief-default-34-appendix.pdf",
                 "brief-none-context.pdf", "brief-custom-context.pdf"]:
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
        elif filename.startswith("summary-"):
            assert "Planning insights summary" in text
            summary = text.split("Decision state", 1)[0]
            assert "Reviewed record:" in summary, (filename, "Missing reviewed estimate identifiers")
            assert "exact source locator" in summary, (filename, "Missing full-provenance handoff")
            if filename == "summary-on.pdf":
                assert len(pdf.pages) <= 8, (filename, "Basic opt-in summary exceeds one additional page", len(pdf.pages))
            assert "Universe:" in summary and "Denominator:" in summary
            for unaccepted_prompt in ["Verify available capacity", "Verify pathway timing", "Possible source owner"]:
                assert unaccepted_prompt not in summary
        if filename == "brief-default-34-concise.pdf":
            assert len(pdf.pages) <= 13, (filename, "34 default records should remain concise", len(pdf.pages))
            assert "34 reviewed context records included" in text
            assert "meps24-current-long-covid-population" in text
            assert "meps24-gross-all-cause-spending-total" in text
            assert "Detailed included context records" not in text
        if filename == "brief-default-34-appendix.pdf":
            assert "Detailed included context records" in text
            assert "34 reviewed context records included" in text
        if filename == "brief-none-context.pdf":
            assert "34 reviewed context records included" not in text
            assert "no local context has been selected" in text.lower()
        if filename == "brief-custom-context.pdf":
            assert "4 reviewed context records included" in text
            assert "34 reviewed context records included" not in text
        if filename.startswith("brief-"):
            for index, page_content in enumerate(page_text):
                # Avoid accidental empty print sheets. First/last pages are exempt from a strict
                # content-density budget; footer/provenance alone are not substantive.
                assert len((page_content or "").strip()) > 350, (filename, index + 1, "Nearly blank printed page")
        if shutil.which("pdftoppm") and filename.startswith("brief-"):
            # Attach renderings from the PDF itself (not DOM screenshots) to CI artifacts.
            for page_number, suffix in [(1, "first"), (len(pdf.pages), "last")]:
                subprocess.run(
                    ["pdftoppm", "-f", str(page_number), "-l", str(page_number),
                     "-singlefile", "-scale-to", "1100", "-png",
                     str(directory / filename), str(directory / (filename.removesuffix(".pdf") + "-" + suffix))],
                    check=True, capture_output=True
                )
        results.append({"file": filename, "pages": len(pdf.pages), "minimum_footer_clearance_pt": min(clearances)})
by_file = {entry["file"]: entry["pages"] for entry in results}
assert by_file["brief-default-34-appendix.pdf"] > by_file["brief-default-34-concise.pdf"], "Appendix toggle must add pages"
assert by_file["brief-none-context.pdf"] <= by_file["brief-default-34-concise.pdf"]
report = {"passed": True, "results": results}
(directory / "pdf-verification.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
