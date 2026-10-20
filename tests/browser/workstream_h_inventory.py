"""Independent, fail-closed inventory contract for Workstream H native-PDF QA.

Expected files and selection/print coordinates are intentionally constructed
without consulting matrix["pdfs"] or matrix["printCombinations"]. The check-only
path never renders (or repairs) an omitted PNG.
"""
from itertools import product
from pathlib import Path
import json

import fitz

MODE_FLAGS = {
    "default": (False, False),
    "deterministic-only": (True, False),
    "concept-only": (False, True),
    "all-enabled": (True, True),
}
SELECTIONS = {"default": 34, "none": 0, "custom": 4, "pilot-only": 1, "pilot-overlap": 1}
SPECIAL_SELECTIONS = {"stale-request": 34, "extreme": 34}
BOUNDARY_IDS = {
    "wv.acs.poverty_pct",
    "wv.hrsa.primary-care.designation-type.federally-qualified-health-center",
    "wv.hrsa.primary-care.designation-type.rural-health-clinic",
}

def require(condition, message):
    if not condition:
        raise AssertionError(message)

def read_json(path):
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, ValueError) as exc:
        raise AssertionError(f"Missing or invalid JSON {path.name}: {exc}") from exc

def expected_pdfs(mode):
    """Independent contract, not a projection of the runner-provided PDF list."""
    require(mode in MODE_FLAGS, f"Unknown feature mode {mode!r}")
    insights, _ = MODE_FLAGS[mode]
    expected = {}

    def add(name, detailed, requested, size):
        filename = (f"{name}-{'detailed' if detailed else 'concise'}-"
                    f"{'insights' if requested else 'plain'}-{size}.pdf")
        expected[filename] = {
            "file": filename, "name": name, "detailed": detailed,
            "insights": insights and requested, "requestedInsights": requested,
            "size": size, "selected": SELECTIONS.get(name, SPECIAL_SELECTIONS.get(name)),
        }

    for detailed, requested in product((False, True), repeat=2):
        add("default", detailed, requested, "Letter")
    if mode == "default":
        for detailed in (False, True):
            add("default", detailed, False, "A4")
        for name, detailed in (("none", False), ("custom", True),
                               ("pilot-only", True), ("pilot-overlap", True),
                               ("stale-request", True), ("extreme", True)):
            add(name, detailed, False, "Letter")
    require(len(expected) == (12 if mode == "default" else 4), "Bad verifier PDF contract")
    return expected

def validate_matrix(directory, matrix):
    mode = matrix.get("mode")
    require(mode in MODE_FLAGS, f"Unknown mode: {mode!r}")
    insights, concept = MODE_FLAGS[mode]
    require(type(matrix.get("insights")) is bool and matrix["insights"] == insights,
            f"Incorrect feature flag insights for {mode}")
    require(type(matrix.get("concept")) is bool and matrix["concept"] == concept,
            f"Incorrect feature flag concept for {mode}")
    require(matrix.get("errors") == [], "Browser console/page errors")

    actual_rows = matrix.get("printCombinations")
    require(isinstance(actual_rows, list), "Missing printCombinations")
    expected_keys = set(product(SELECTIONS, (False, True), (False, True)))
    seen = set()
    applicable = not_applicable = 0
    for row in actual_rows:
        require(isinstance(row, dict) and set(row) ==
                {"selection", "local", "planning", "effectivePlanning", "status"},
                f"Malformed print row: {row!r}")
        require(type(row["local"]) is bool and type(row["planning"]) is bool and
                type(row["effectivePlanning"]) is bool,
                f"Non-boolean print coordinate: {row!r}")
        key = (row["selection"], row["local"], row["planning"])
        require(key in expected_keys, f"Unexpected print coordinate {key}")
        require(key not in seen, f"Duplicate print coordinate {key}")
        seen.add(key)
        expected_status = "PASS" if (insights or not row["planning"]) else "NOT_APPLICABLE_DISABLED"
        require(row["status"] == expected_status, f"Wrong print status for {key}: {row['status']!r}")
        require(row["effectivePlanning"] is (insights and row["planning"]),
                f"Wrong effectivePlanning for {key}")
        applicable += expected_status == "PASS"
        not_applicable += expected_status == "NOT_APPLICABLE_DISABLED"
    require(seen == expected_keys, f"Missing print coordinates: {sorted(expected_keys - seen)}")
    require(applicable + not_applicable == 20, "Expected 20 enumerated print rows")
    require((applicable, not_applicable) == ((20, 0) if insights else (10, 10)),
            "Unexpected applicable/not-applicable counts")

    tests = matrix.get("tests")
    require(isinstance(tests, list), "Missing runner tests")
    required_tests = set(SELECTIONS)
    if mode == "default":
        required_tests |= {"data-request-selected-deselected-stale", "extreme-finite-scenario"}
    testnames = [t.get("name") for t in tests if isinstance(t, dict)]
    require(len(testnames) == len(tests) and len(set(testnames)) == len(testnames) and
            set(testnames) == required_tests, f"Unexpected runner tests: {testnames!r}")
    for test in tests:
        require(test.get("status") == "PASS", f"Failed runner test: {test!r}")
        if test["name"] in SELECTIONS:
            require(type(test.get("selected")) is int and
                    test["selected"] == SELECTIONS[test["name"]] and
                    test.get("completeLocalRecords") is True and
                    test.get("printCanonicalByteIdentical") is True,
                    f"Incomplete source/selection/JSON integrity: {test!r}")

    expected = expected_pdfs(mode)
    actual = matrix.get("pdfs")
    require(isinstance(actual, list), "Missing PDF manifest")
    seen_names = set()
    for entry in actual:
        require(isinstance(entry, dict) and set(entry) == set(next(iter(expected.values()))),
                f"Malformed PDF metadata: {entry!r}")
        filename = entry["file"]
        require(isinstance(filename, str) and filename in expected,
                f"Unexpected PDF manifest entry: {filename!r}")
        require(filename not in seen_names, f"Duplicate PDF manifest entry: {filename}")
        seen_names.add(filename)
        require(entry == expected[filename] and
                type(entry["detailed"]) is bool and type(entry["insights"]) is bool and
                type(entry["requestedInsights"]) is bool and type(entry["selected"]) is int,
                f"Incorrect PDF metadata for {filename}: {entry!r}")
    require(seen_names == set(expected), f"Missing PDF manifest entries: {sorted(set(expected) - seen_names)}")
    disk_pdfs = {p.name for p in directory.glob("*.pdf")}
    require(disk_pdfs == set(expected),
            f"Physical PDF inventory mismatch: missing={sorted(set(expected)-disk_pdfs)}, extra={sorted(disk_pdfs-set(expected))}")
    expected_json = {name + ".json" for name in expected}
    disk_json = {p.name for p in directory.glob("*.pdf.json")}
    require(disk_json == expected_json,
            f"Canonical companion inventory mismatch: missing={sorted(expected_json-disk_json)}, extra={sorted(disk_json-expected_json)}")
    canonical = {}
    for name, entry in expected.items():
        data = read_json(directory / (name + ".json"))
        require(isinstance(data, dict) and isinstance(data.get("burden_findings"), list) and
                isinstance(data.get("local_context"), list), f"Invalid canonical shape: {name}")
        findings = data["burden_findings"]
        selected = data["local_context"]
        require(len(findings) == 21 and len({f["estimate_id"] for f in findings}) == 21 and
                all("u09" not in f["estimate_id"].lower() for f in findings),
                f"National 21-finding integrity lost: {name}")
        require(len(selected) == entry["selected"] and
                len({r["indicator_id"] for r in selected}) == len(selected),
                f"Local selection integrity lost: {name}")
        canonical[name] = data
    return expected, canonical, applicable, not_applicable

def expected_pngs(directory, expected, canonical, report):
    """Derive required first/last and record-adjacent pages from verified PDF geometry."""
    require(isinstance(report, dict), "Missing PDF verification report")
    results = report.get("results")
    require(isinstance(results, list), "Missing verified PDF page results")
    result_names = [r.get("file") for r in results if isinstance(r, dict)]
    require(len(result_names) == len(results) and len(set(result_names)) == len(result_names)
            and set(result_names) == set(expected), "Missing, extra, or duplicate verified PDFs")
    by_file = {r["file"]: r for r in results}
    positions = report.get("record_positions")
    require(isinstance(positions, dict), "Missing record page-position report")
    required = set()
    total_pages = 0
    for name, spec in expected.items():
        item = by_file[name]
        require(set(item) == {"file", "pages", "minimum_footer_clearance_pt",
                              "detailed_record_headings_verified", "size", "local_context_count",
                              "insights_printed"}, f"Unexpected PDF verification fields: {name}")
        with fitz.open(directory / name) as doc:
            count = len(doc)
        require(type(item["pages"]) is int and item["pages"] == count and count > 0,
                f"Physical PDF page count mismatch: {name}")
        total_pages += count
        records = canonical[name]["local_context"]
        detailed = spec["detailed"] and bool(records)
        require(item["size"] == spec["size"] and
                item["insights_printed"] is spec["insights"] and
                item["local_context_count"] == len(records) and
                item["detailed_record_headings_verified"] == (len(records) if detailed else 0) and
                isinstance(item["minimum_footer_clearance_pt"], (int, float)) and
                item["minimum_footer_clearance_pt"] >= 4,
                f"Incorrect PDF verification metadata: {name}")
        hits = positions.get(name, [])
        require(isinstance(hits, list), f"Malformed record positions: {name}")
        require((name in positions) == detailed, f"Missing/unexpected heading positions: {name}")
        require(len(hits) == (len(records) if detailed else 0),
                f"Incomplete detailed record positions: {name}")
        hit_ids = [hit.get("id") for hit in hits if isinstance(hit, dict)]
        require(len(hit_ids) == len(hits) and len(set(hit_ids)) == len(hit_ids) and
                set(hit_ids) == ({r["indicator_id"] for r in records} if detailed else set()),
                f"Wrong detailed record IDs: {name}")
        for hit in hits:
            require(set(hit) == {"id", "page"} and type(hit["page"]) is int and
                    1 <= hit["page"] <= count, f"Invalid physical heading page: {name}: {hit!r}")
        if spec["name"] in ("default", "pilot-only", "stale-request") or detailed:
            pages = {1, count}
            for hit in hits:
                if hit["id"] in BOUNDARY_IDS:
                    pages.update(n for n in (hit["page"] - 1, hit["page"], hit["page"] + 1)
                                 if 1 <= n <= count)
            required.update(f"{Path(name).stem}-page-{p}.png" for p in pages)
    require(set(positions) <= set(expected), "Unexpected record-position PDF key")
    return required, total_pages

def validate_render_inventory(directory, expected, canonical, report, applicable, not_applicable):
    required, total_pages = expected_pngs(directory, expected, canonical, report)
    images = {p.name for p in directory.glob("*.png")}
    require(images == required, f"Raster PNG inventory mismatch: missing={sorted(required-images)}, extra={sorted(images-required)}")
    for name in required:
        path = directory / name
        require(path.stat().st_size > 2000, f"Truncated raster PNG: {name}")
        try:
            pixmap = fitz.Pixmap(str(path))
            require(pixmap.width >= 500 and pixmap.height >= 500 and pixmap.n >= 3,
                    f"Invalid/nontrivial raster dimensions: {name}")
        except (RuntimeError, ValueError) as exc:
            raise AssertionError(f"Unreadable raster PNG {name}: {exc}") from exc
    require(report.get("passed") is True and report.get("mode") in MODE_FLAGS,
            "Missing or false PDF verification pass")
    require(report["mode"] == read_json(directory / "matrix-results.json")["mode"],
            "Mode mismatch between inventory report and matrix")
    require(report.get("rendered_pdfs") == len(expected), "Incorrect reported native PDF count")
    require(report.get("rendered_page_png_count") == len(required), "Incorrect reported raster count")
    require(report.get("rendered_page_pngs") == sorted(required), "Incorrect reported raster names")
    require(report.get("tested_lightweight_combinations") == 20, "Incorrect enumerated row count")
    require(report.get("applicable_print_states") == applicable and
            report.get("not_applicable_print_states") == not_applicable,
            "Incorrect reported applicable/not-applicable states")
    require(report.get("physical_pdf_pages") == total_pages and
            report.get("selected_raster_pages") == len(required),
            "Incorrect reported physical/raster page inventory")
    return total_pages, len(required)

def check_inventory(directory):
    matrix = read_json(directory / "matrix-results.json")
    expected, canonical, applicable, not_applicable = validate_matrix(directory, matrix)
    report = read_json(directory / "pdf-verification.json")
    total_pages, rendered = validate_render_inventory(directory, expected, canonical, report,
                                                      applicable, not_applicable)
    return {"mode": matrix["mode"], "pdfs": len(expected), "enumerated": 20,
            "applicable": applicable, "not_applicable": not_applicable,
            "physical_pages": total_pages, "raster_pages": rendered}
