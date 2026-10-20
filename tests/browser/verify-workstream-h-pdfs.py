"""Workstream H: inspect actual Chromium PDFs, including each physical record opening."""
import json
import re
import fitz  # PyMuPDF; deterministic physical-page raster evidence, no optional binaries
import sys
from pathlib import Path

import pdfplumber
from workstream_h_inventory import validate_matrix, read_json, check_inventory


def flat(s):
    return " ".join((s or "").split())



def verify_spatial_opening(pages, record, filename, appendix_pages):
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
    for number in appendix_pages:
        page = pages[number - 1]
        left = page.crop((0, 0, page.width - 105, page.height))
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
            # The spatial A4 fallback is allowed only on actual detailed-appendix
            # physical pages; an unrelated title elsewhere must never match.
            number = verify_spatial_opening(
                pdf_pages, record, filename, [page for page, _ in sections]
            )
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


def main():
    assert len(sys.argv) in (2, 3), "Usage: verify-workstream-h-pdfs.py OUTPUT [--check-inventory]"
    directory = Path(sys.argv[1])
    if len(sys.argv) == 3:
        assert sys.argv[2] == "--check-inventory", "Unknown verifier option"
        print(json.dumps(check_inventory(directory), indent=2))
        return

    matrix = read_json(directory / "matrix-results.json")
    # Validate independent exact-case expectations *before* touching the PDFs.
    expected, canonicals, applicable, not_applicable = validate_matrix(directory, matrix)
    verified = []
    all_positions = {}
    for filename, entry in expected.items():
        path = directory / filename
        canonical = canonicals[filename]
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
            assert ("Planning insights summary" in whole) == entry["insights"], (filename, "Print insights off/on mismatch")
            detailed = entry["detailed"] and bool(canonical["local_context"])
            assert ("Detailed included context records" in whole) == detailed, (filename, "Appendix off/on mismatch")
            if detailed:
                positions = verify_detailed_openings(page_text, canonical["local_context"], filename, pdf.pages)
            if entry["name"] in ("default", "pilot-only", "stale-request") or detailed:
                renders = {1, len(pdf.pages)}
                if detailed:
                    for hit in positions:
                        if hit["id"] in {"wv.acs.poverty_pct",
                                         "wv.hrsa.primary-care.designation-type.federally-qualified-health-center",
                                         "wv.hrsa.primary-care.designation-type.rural-health-clinic"}:
                            renders.update(n for n in (hit["page"] - 1, hit["page"], hit["page"] + 1)
                                           if 1 <= n <= len(pdf.pages))
                with fitz.open(path) as rendered_pdf:
                    assert len(rendered_pdf) == len(pdf.pages)
                    for number in sorted(renders):
                        png_path = directory / (path.stem + "-page-" + str(number) + ".png")
                        rendered_pdf[number - 1].get_pixmap(
                            matrix=fitz.Matrix(1.55, 1.55), alpha=False
                        ).save(str(png_path))
                        assert png_path.stat().st_size > 2000, (filename, number, "Rasterized page missing")
            verified.append({"file": filename, "pages": len(pdf.pages),
                             "minimum_footer_clearance_pt": min(clearances),
                             "detailed_record_headings_verified": len(positions),
                             "size": entry["size"], "local_context_count": len(canonical["local_context"]),
                             "insights_printed": entry["insights"]})
            if positions:
                all_positions[filename] = positions

    rendered_pngs = sorted(p.name for p in directory.glob("*.png"))
    report = {"passed": True, "mode": matrix["mode"],
              "rendered_page_png_count": len(rendered_pngs),
              "rendered_page_pngs": rendered_pngs,
              "tested_lightweight_combinations": len(matrix["printCombinations"]),
              "applicable_print_states": applicable,
              "not_applicable_print_states": not_applicable,
              "rendered_pdfs": len(verified),
              "physical_pdf_pages": sum(item["pages"] for item in verified),
              "selected_raster_pages": len(rendered_pngs),
              "results": verified, "record_positions": all_positions}
    (directory / "pdf-verification.json").write_text(json.dumps(report, indent=2) + "\n")
    # A separate read-only stage checks exact PNG inventory without rendering
    # missing files. This also rejects extra/duplicate/false report metadata.
    check_inventory(directory)
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
