"""Inspect actual Chromium PDFs; requires test-only pdfplumber (never bundled).

Usage: python3 tests/browser/verify-insights-pdfs.py SCREEN_OUTPUT
"""
import json
import logging
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pdfplumber

logging.getLogger("pdfminer").setLevel(logging.ERROR)


def normalized(value):
    """PDF line wraps are layout, not semantic boundaries within a heading."""
    return " ".join(value.split())


def assert_no_local_record_heading_orphans(page_text, local_records, filename):
    """Assert every selected reviewed record *opening* is on one actual PDF page.

    Inspect every title (not specific page numbers or only the poverty record).
    A valid opening has the record's own status, geography and numeric value
    immediately after its heading. Long interpretations/limitations may flow
    naturally onto subsequent pages. Fail if a heading wraps across sheets,
    disappears, or is duplicated; avoid false positives from the four-record
    executive synopsis by restricting checks to the detailed appendix section.
    """
    sections = []
    inside = False
    for page_num, raw in enumerate(page_text, 1):
        content = normalized(raw or "")
        if "Detailed included context records" in content:
            inside = True
            content = content.split("Detailed included context records", 1)[1]
        if inside:
            content = content.split("Intervention-effect evidence", 1)[0]
            sections.append((page_num, content))
        if inside and "Intervention-effect evidence" in normalized(raw or ""):
            break
    assert sections, (filename, "Detailed local-context appendix missing")
    positions = []
    for record in local_records:
        label = normalized(record["label"])
        status = {
            "loaded": "Available", "partial": "Partial",
            "unavailable": "Unavailable", "loading": "Loading",
            "error": "Error"
        }.get(record["state"], record["state"])
        title_pattern = re.compile(re.escape(label) + r"\s+" + re.escape(status) + r"\b")
        hits = [(p, match, text) for p, text in sections for match in title_pattern.finditer(text)]
        assert len(hits) == 1, (filename, record["indicator_id"], "Record heading missing/duplicated/split across pages", [p for p, _, _ in hits])
        p, match, text = hits[0]
        value = record["value"]
        if value is None:
            opening_value = r"(?:Not available|Suppressed|Not published|—)"
        elif record["unit"] == "percent":
            opening_value = re.escape(f"{value:,.1f}%")
        else:
            opening_value = re.escape(f"{value:,.0f}" if value == int(value) else f"{value:,.1f}")
        # This checks the same heading's own geography and first value, not a
        # matching geography elsewhere on the sheet or on the following page.
        geography = re.escape(record["geography_name"] + " (" + record["geography_type"] + ")")
        opening = re.compile(r"^\\s+" + geography + r"\s+" + opening_value + r"(?=\s|%|±)")
        tail = text[match.end():match.end() + 230]
        assert opening.search(tail), (
            filename, p, record["indicator_id"],
            "Orphaned heading: its geography and opening value/status are not on the same PDF page",
            tail[:120]
        )
        positions.append({"id": record["indicator_id"], "page": p})
    assert len(positions) == len(local_records), (filename, "Not all selected records checked")
    return positions

directory = Path(sys.argv[1])
results = []
record_positions = {}
selected_json = json.loads((directory / "brief-default-34.json").read_text())
selected_records = selected_json["local_context"]
assert len(selected_records) == 34 and len({r["indicator_id"] for r in selected_records}) == 34
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
        # Four curated, reviewed, population-specific national measures belong to the
        # Brief itself, not to the optional Planning Insights print preference.
        for heading in [
            "U.S. population represented",
            "Total national all-cause spending",
            "Health care paperwork time",
            "Serious psychological distress",
        ]:
            assert heading in text, (filename, "Missing always-on executive headline", heading)
        assert "not attributable to Long COVID" in text, (filename, "Missing noncausal headline boundary")
        assert "National reviewed context:" not in text, (filename, "Old unconditional insights print bypass")
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
            assert 7 <= len(pdf.pages) <= 9, (filename, "34 default with four new headings should stay close to former seven-page print", len(pdf.pages))
            assert "34 reviewed context records included" in text
            assert "meps24-current-long-covid-population" in text
            assert "meps24-gross-all-cause-spending-total" in text
            assert "Detailed included context records" not in text
        if filename == "brief-default-34-appendix.pdf":
            record_positions[filename] = assert_no_local_record_heading_orphans(page_text, selected_records, filename)
            assert 21 <= len(pdf.pages) <= 25, (filename, "Appendix unexpectedly differs from original 22 pages", len(pdf.pages))
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
assert by_file["brief-default-34-appendix.pdf"] - by_file["brief-default-34-concise.pdf"] >= 12
report = {"passed": True, "results": results, "checked_appendix_records": record_positions}
(directory / "pdf-verification.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
