"""Rendered A4 Brief contract: compact by default, detailed appendix only by choice.

The canonical selection/export contract is tested in the browser and unit tests.
This checks the actual PDFs created by Chromium, not just print-media CSS.
"""
import json
import logging
import re
import sys
from pathlib import Path

import pdfplumber

logging.getLogger("pdfminer").setLevel(logging.ERROR)
directory = Path(sys.argv[1])
required_summary = [
    "Population represented",
    "Gross national all-cause spending",
    "Administrative time",
    "Serious psychological distress",
    "West Virginia implementation context",
    "Analyst pilot assumptions",
    "Operational data requests",
]
required_appendix = [
    "Reviewed national burden findings",
    "Pilot planning assumptions",
    "Local implementation context",
    "Intervention-effect evidence",
    "What to collect next",
    "Interpretation boundaries",
]

def verify(filename: str, *, screenshot: str):
    with pdfplumber.open(directory / filename) as pdf:
        assert pdf.pages, (filename, "empty PDF")
        text = "\n".join(page.extract_text() or "" for page in pdf.pages)
        flat = re.sub(r"\\s+", " ", text)
        # A multi-column role heading can wrap while the other columns share
        # the same baseline. Crop the first column before extracting its text.
        first_column = pdf.pages[0].crop((0, 0, pdf.pages[0].width * .36, pdf.pages[0].height))
        first_column_text = re.sub(r"\s+", " ", first_column.extract_text() or "")
        for phrase in required_summary:
            reading_order = first_column_text if phrase == "West Virginia implementation context" else flat
            assert phrase in reading_order, (filename, "missing executive element", phrase, reading_order[:2500])
        assert "Analyze with AI" not in text and "Explore future AI concept" not in text, filename
        assert "Planning insights summary" not in text, (filename, "optional Insights must remain off")
        metrics = []
        for number, page in enumerate(pdf.pages, start=1):
            chars = [ch for ch in page.chars if ch["text"].strip()]
            assert len(chars) >= 30, (filename, number, "near-blank page", len(chars))
            visible = [ch for ch in chars if ch["top"] >= -1 and ch["bottom"] <= page.height + 1]
            assert len(visible) == len(chars), (filename, number, "vertical clipping")
            outside = [ch for ch in chars if ch["x0"] < -1 or ch["x1"] > page.width + 1]
            assert not outside, (filename, number, "horizontal clipping", outside[:4])
            # Body text should remain readable; the 6.8pt footer is permitted.
            assert min(ch["size"] for ch in chars) >= 6.5, (filename, number, "illegibly small type")
            metrics.append({"page": number, "characters": len(chars)})
        pdf.pages[0].to_image(resolution=125).save(str(directory / screenshot), format="PNG")
        return {"pages": len(pdf.pages), "pages_checked": metrics, "first_page_image": screenshot}, text

none, none_text = verify("collapsed-report.pdf", screenshot="none-selected-page-1.png")
default, default_text = verify("all-context-report.pdf", screenshot="default-34-page-1.png")
expanded, expanded_text = verify("all-context-expanded.pdf", screenshot="expanded-34-page-1.png")
assert "0 reviewed records included" in re.sub(r"\\s+", " ", none_text), "None-selected context not disclosed"
assert "34 reviewed records included" in re.sub(r"\\s+", " ", default_text), "All-reviewed default not disclosed"
assert "34 reviewed records included" in re.sub(r"\\s+", " ", expanded_text)
for section in required_appendix:
    assert section not in re.sub(r"\\s+", " ", none_text), ("None-selected summary must omit full appendix", section)
    assert section not in re.sub(r"\\s+", " ", default_text), ("Default summary must omit full appendix", section)
    assert section in re.sub(r"\\s+", " ", expanded_text), ("Expanded appendix missing", section)
assert 1 <= default["pages"] <= 4, ("Default print unexpectedly long", default)
assert 1 <= none["pages"] <= 4, ("No-context print unexpectedly long", none)
assert expanded["pages"] > default["pages"], ("Appendix did not increase page count", default, expanded)
assert "meps24-current-long-covid-population" in re.sub(r"\\s+", "", default_text)
assert "meps24-gross-all-cause-spending-total" in re.sub(r"\\s+", "", default_text)
assert "meps24-k6-serious-distress" in re.sub(r"\\s+", "", default_text)
assert "meps24-k6-score-mean" not in default_text, "Mean K6 should not lead executive summary"
result = {
    "passed": True, "summary_required": required_summary,
    "appendix_required": required_appendix, "none_selected": none,
    "default_all_34": default, "expanded_all_34": expanded,
}
(directory / "pdf-verification.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps(result, indent=2))
