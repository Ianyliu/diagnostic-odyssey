"""Workstream H: inspect actual Chromium PDFs, including each physical record opening."""
import json
import re
import shutil
import subprocess
import sys
from pathlib import Path

import pdfplumber


def flat(s):
    return " ".join((s or "").split())



def verify_spatial_opening(pages, record, filename):
    """Fallback for A4 two-column headings: inspect physical text geometry.

    An Available badge may be extracted *between* words of a long left-column
    title. Never accept merely finding a heading somewhere else in the PDF.
    """
    label = flat(record["label"])
    geography = record["geography_name"] + " (" + record["geography_type"] + ")"
    value = record["value"]
    if value is None:
        opening_value = r"(?:Not available|Suppressed|Not published|—)"
    elif record["unit"] == "percent":
        opening_value = re.escape(f"{value:,.1f}%")
    else:
        opening_value = re.escape(f"{value:,.0f}" if value == int(value) else f"{value:,.1f}")
    title_pattern = r"\s+".join(re.escape(word) for word in label.split())
    geography_pattern = r"\s+".join(re.escape(word) for word in geography.split())
    full_opening = re.compile(title_pattern + r"\s+" + geography_pattern +
                              r"\s+(?:Active Pilot planning context\s+)?" + opening_value + r"(?=\s|%|±)")
    status = {"loaded": "Available", "partial": "Partial", "unavailable": "Unavailable",
              "loading": "Loading", "error": "Error"}.get(record["state"], record["state"])
    matches = []
    for number, page in enumerate(pages, 1):
        left = page.crop((0, 0, page.width - 95, page.height))
        left_text = flat(left.extract_text())
        if not full_opening.search(left_text):
            continue
        title_boxes = left.search(title_pattern, regex=True)
        for title in title_boxes:
            badge = [w for w in page.extract_words()
                     if w["text"] == status and w["x0"] > page.width - 110
                     and title["top"] - 5 <= w["top"] <= title["bottom"] + 5]
            if len(badge) != 1:
                continue
            assert badge[0]["x0"] > title["x1"] + 2, (
                filename, number, record["indicator_id"], "Heading collides horizontally with status")
            assert badge[0]["x1"] < page.width - 15, (
                filename, number, record["indicator_id"], "Status extends outside printable space")
            matches.append(number)
    assert len(matches) == 1, (
        filename, record["indicator_id"],
        "Opening not on one physical page with its own complete, unwrapped badge", matches)
    return matches[0]

def verify_detailed_openings(pages, records, filename, pdf_pages):
    sections = []
    inside = False
    for number, raw in enumerate(pages, 1):
        words = flat(raw)
        if "Detailed included context records" in words:
            inside = True
            words = words.split("Detailed included context records", 1)[1]
        if inside:
            sections.append((number, words.split("Intervention-effect evidence", 1)[0]))
        if inside and "Intervention-effect evidence" in flat(raw):
            break
    assert sections, (filename, "Missing detailed appendix")
    positions = []
    for record in records:
        status = {"loaded": "Available", "partial": "Partial", "unavailable": "Unavailable",
                  "loading": "Loading", "error": "Error"}.get(record["state"], record["state"])
        heading = re.compile(re.escape(flat(record["label"])) + r"\s+" + re.escape(status) + r"\b")
        hits = [(number, m, words) for number, words in sections for m in heading.finditer(words)]
        if len(hits) != 1:
            probes = [record["label"].split()[-1], "Look-A-Like", "Qualified", "FQHC"]
            nearby = []
            for page_number, raw_text in enumerate(pages, 1):
                text_page = flat(raw_text)
                for probe in probes:
                    pos = text_page.lower().find(probe.lower())
                    if pos >= 0:
                        nearby.append({"page": page_number, "term": probe, "context": text_page[max(0, pos - 130):pos + 330]})
                        break
            number = verify_spatial_opening(pdf_pages, record, filename)
            positions.append({"id": record["indicator_id"], "page": number})
            continue
        number, match, words = hits[0]
        value = record["value"]
        if value is None:
            opening_value = r"(?:Not available|Suppressed|Not published|—)"
        elif record["unit"] == "percent":
            opening_value = re.escape(f"{value:,.1f}%")
        else:
            opening_value = re.escape(f"{value:,.0f}" if value == int(value) else f"{value:,.1f}")
        geography = re.escape(record["geography_name"] + " (" + record["geography_type"] + ")")
        opening = re.compile(r"^\s+" + geography + r"\s+(?:Active Pilot planning context\s+)?" +
                             opening_value + r"(?=\s|%|±)")
        tail = words[match.end():match.end() + 230]
        assert opening.search(tail), (filename, number, record["indicator_id"],
                                     "Orphaned: own geography/value/status not on heading page", tail[:160])
        positions.append({"id": record["indicator_id"], "page": number})
    return positions


directory = Path(sys.argv[1])
matrix = json.loads((directory / "matrix-results.json").read_text())
assert len(matrix["printCombinations"]) == 20, "Expected 5 selections x 4 print choices for this feature job"
assert not matrix["errors"], matrix["errors"]
assert all(row["status"] == "PASS" for row in matrix["tests"]), matrix["tests"]
verified = []
all_positions = {}
for entry in matrix["pdfs"]:
    filename = entry["file"]
    path = directory / filename
    canonical = json.loads((directory / (filename + ".json")).read_text())
    positions = []
    with pdfplumber.open(path) as pdf:
        assert len(pdf.pages) >= 1, (filename, "No pages")
        page_text = []
        clearances = []
        for idx, page in enumerate(pdf.pages, 1):
            words = page.extract_words()
            footer = [w for w in words if w["text"] == "Diagnostic" and w["top"] > page.height - 80]
            assert len(footer) == 1, (filename, idx, "Missing or duplicate page footer")
            body = [ch for ch in page.chars if abs(ch["size"] - 6.8) > .05 and ch["text"].strip()]
            assert body, (filename, idx, "Footer-only or blank page")
            clearance = footer[0]["top"] - max(ch["bottom"] for ch in body)
            assert clearance >= 4, (filename, idx, "Body/footer collision", clearance)
            clearances.append(round(clearance, 2))
            text = page.extract_text() or ""
            assert len(flat(text)) > 350, (filename, idx, "Nearly empty substantive sheet", len(flat(text)))
            page_text.append(text)
        whole = "\n".join(page_text)
        for title in ["U.S. population represented", "Total national all-cause spending",
                      "Health care paperwork time", "Serious psychological distress"]:
            assert title in whole, (filename, "Missing national executive heading", title)
        assert "not attributable to Long COVID" in whole, (filename, "Missing noncausal boundary")
        assert ("Planning insights summary" in whole) == bool(entry["insights"]), (filename, "Print insights off/on mismatch")
        detailed = bool(entry["detailed"]) and bool(canonical["local_context"])
        assert ("Detailed included context records" in whole) == detailed, (filename, "Appendix off/on mismatch")
        if detailed:
            positions = verify_detailed_openings(page_text, canonical["local_context"], filename, pdf.pages)
        if shutil.which("pdftoppm") and (entry["name"] in ("default", "pilot-only", "stale-request") or detailed):
            renders = {1, len(pdf.pages)}
            if detailed:
                for hit in positions:
                    if hit["id"] in {"wv.acs.poverty_pct",
                                     "wv.hrsa.primary-care.designation-type.federally-qualified-health-center",
                                     "wv.hrsa.primary-care.designation-type.rural-health-clinic"}:
                        renders.update(n for n in (hit["page"] - 1, hit["page"], hit["page"] + 1)
                                       if 1 <= n <= len(pdf.pages))
            for number in sorted(renders):
                subprocess.run(["pdftoppm", "-f", str(number), "-l", str(number),
                                "-singlefile", "-scale-to", "1100", "-png",
                                str(path), str(directory / (path.stem + "-page-" + str(number)))],
                               capture_output=True, check=True)
        verified.append({"file": filename, "pages": len(pdf.pages),
                         "minimum_footer_clearance_pt": min(clearances),
                         "detailed_record_headings_verified": len(positions),
                         "size": entry["size"], "local_context_count": len(canonical["local_context"]),
                         "insights_printed": entry["insights"]})
        if positions:
            all_positions[filename] = positions
report = {"passed": True, "mode": matrix["mode"], "tested_lightweight_combinations": len(matrix["printCombinations"]),
          "rendered_pdfs": len(verified), "results": verified, "record_positions": all_positions}
(directory / "pdf-verification.json").write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
