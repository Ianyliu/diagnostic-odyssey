"""Compare real, fixed-clock browser downloads from base and candidate servers.

Enforces canonical JSON byte equality and strict stage-aware semantic scientific
completeness on rendered Chromium PDFs across all six lifecycle stages. A legacy
base may lack the new, independently checked evidence freshness field.
"""
from decimal import Decimal, ROUND_HALF_UP
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys


STAGES = [
    "empty",
    "created",
    "stale",
    "refreshed-unselected",
    "refreshed-selected",
    "removed",
]

HEADLINE_CIS = {
    "population": "95% CI 5.9M–7.7M",
    "all_cause_spending": "95% CI $72.0B–$122.5B",
    "paperwork": "95% CI 12.8–36.2 hours/person/year",
    "distress": "95% CI 9.3%–18.8%",
}

REQUIRED_SEMANTIC_PHRASES = {
    "hpsa_not_people": "HPSA figures describe shortage-area designations, not people",
    "acs_statewide": "ACS figures describe statewide Census survey measures",
    "strategy_lab_separate": "An active Pilot-used record may be included separately from checkbox choices.",
    "selected_examples_no_rank": "not a ranking, aggregate, or statewide severity score",
    "json_and_appendix_guidance": (
        "The canonical JSON companion contains all 34 complete records, source locators, "
        "released interpretations and limitations. Enable the detailed print option to include "
        "their full text in the PDF."
    ),
    "esaq_psaq_universes": "ESAQ and PSAQ have their own outcome-specific respondent universes",
    "screening_not_diagnosis": "Screening is not diagnosis",
    "scenario_assumptions_not_evidence": "These inputs are planning assumptions, not observed evidence.",
    "scenario_deterministic_boundary": (
        "Deterministic planning quantities from the applied assumptions above; "
        "not a forecast or savings, and not observed evidence."
    ),
    "pathway_assumption_boundary": (
        "Reach, capacity, recognition-window assumptions, and program-resource inputs "
        "apply only within this modeled step and mechanism."
    ),
    "no_intervention_effect": "No reviewed intervention-effect parameter is loaded",
    "current_request_policy": "only requests current for the applied scenario export",
}

PREVIEW_LOCAL_IDS = [
    "wv.acs.no_vehicle_pct",
    "wv.acs.uninsured_pct",
    "wv.acs.broadband_pct",
    "wv.acs.poverty_pct",
]

CAPACITY_REQUEST_QUESTION = (
    "What provider/program capacity is actually available for this pilot's modeled pathway step?"
)


def norm(text: str) -> str:
    """Normalize punctuation/whitespace for PDF line-wrap semantic checks."""
    return re.sub(r"[\W_]+", "", text.casefold())


def extract_pdf_text(path: Path) -> str:
    raw = subprocess.check_output(["pdftotext", str(path), "-"], text=True)
    return re.sub(
        r"Diagnostic Odyssey\s+Reviewed artifact · see Brief provenance\s+Page \d+ of \d+",
        "",
        raw,
    )


def dehyphenated_norm(text: str) -> str:
    return norm(re.sub(r"-\s*\n\s*", "", text))


def compare_brief_bytes(old_json: bytes, new_json: bytes, brief: dict) -> bool:
    if old_json == new_json:
        return True
    if "evidence_freshness" in json.loads(old_json) or "evidence_freshness" not in brief:
        return False

    # For the additive migration, remove only the new final property. The rest
    # must match exactly, including field order, whitespace and numeric spelling.
    legacy_bytes, delimiter, metadata = new_json.rpartition(b',\n  "evidence_freshness": ')
    return (
        bool(delimiter)
        and metadata.endswith(b"\n}")
        and json.loads(metadata[:-2]) == brief["evidence_freshness"]
        and old_json == legacy_bytes + b"\n}"
    )


def verify_freshness_sources(brief: dict) -> list[str]:
    if "evidence_freshness" not in brief:
        return []
    expected = {(row["source_ref"], row["artifact_version"]) for row in brief["burden_findings"]}
    expected.update(
        (row["source_ref"], brief["context"]["local_context_id"]) for row in brief["local_context"]
    )
    observed = [(row["source_ref"], row["artifact_version"]) for row in brief["evidence_freshness"]]
    if len(observed) != len(expected) or set(observed) != expected:
        return ["Evidence freshness must cover exactly the source and artifact pairs in the Brief"]
    return []


def format_native_estimate(value: float, unit: str) -> list[str]:
    """Return expected display text variants matching Intl.NumberFormat in formatEstimateValue.ts."""
    d = Decimal(str(value))
    if unit == "proportion":
        pct = (d * Decimal(100)).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
        return [f"{pct}%"]
    if unit == "USD/year":
        billions = (d / Decimal("1000000000")).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
        return [f"${billions}B"]
    if unit == "USD/person/year":
        dollars = int(d.quantize(Decimal("1"), rounding=ROUND_HALF_UP))
        return [f"${dollars:,}"]
    if unit == "people":
        millions = (d / Decimal("1000000")).quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
        return [f"{millions}M"]
    rounded = d.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    s = f"{rounded:.1f}"
    if s.endswith(".0"):
        s = s[:-2]
    return [f"{s} {unit}", s]


def verify_semantic_pdf(stage: str, brief: dict, pdf_text: str, page_count: int) -> list[str]:
    errors: list[str] = []
    flat_norm = norm(pdf_text)
    unwrap_norm = dehyphenated_norm(pdf_text)

    def has_phrase(phrase: str) -> bool:
        target = norm(phrase)
        return target in flat_norm or target in unwrap_norm

    if not (5 <= page_count <= 10):
        errors.append(f"Unexpected concise PDF page count: {page_count}")

    # 1. All 21 national measures: labels, native formatted values + units, interpretations, boundaries.
    findings = brief.get("burden_findings", [])
    if len(findings) != 21:
        errors.append(f"Expected 21 burden_findings in JSON, got {len(findings)}")
    for row in findings:
        if not has_phrase(row["label"]):
            errors.append(f"Missing national measure label: {row['label']}")
        if not has_phrase(row["allowed_interpretation"]):
            errors.append(f"Missing allowed_interpretation for {row['estimate_id']}")
        if row.get("system_boundary") and not has_phrase(row["system_boundary"]):
            errors.append(f"Missing system_boundary for {row['estimate_id']}")
        if isinstance(row.get("value"), (int, float)):
            variants = format_native_estimate(row["value"], row["unit"])
            if not any(v in pdf_text or has_phrase(v) for v in variants):
                errors.append(
                    f"Missing native formatted value {variants} for {row['estimate_id']}"
                )

    # 2. All four executive headline 95% confidence intervals.
    for key, ci_text in HEADLINE_CIS.items():
        if not has_phrase(ci_text):
            errors.append(f"Missing headline 95% CI ({key}): {ci_text}")

    # 3. Every canonical warning preserved.
    for warning in brief.get("warnings", []):
        if not has_phrase(warning):
            errors.append(f"Missing canonical warning: {warning}")

    # 4. Scientific scope & provenance statements.
    for key, phrase in REQUIRED_SEMANTIC_PHRASES.items():
        if not has_phrase(phrase):
            errors.append(f"Missing required scientific caveat ({key}): {phrase}")

    local_id = brief.get("context", {}).get("local_context_id")
    if local_id:
        local_section = pdf_text.partition("Local implementation context")[2].partition(
            "Intervention-effect evidence"
        )[0]
        if local_id not in local_section:
            errors.append("Local section missing reviewed local artifact ID")
        local_sec_norm = norm(local_section)
        for ind_id in PREVIEW_LOCAL_IDS:
            if norm(ind_id) not in local_sec_norm:
                errors.append(f"Local synopsis missing example indicator ID: {ind_id}")
        source_refs = re.findall(r"acs-?2024-?5year-?profile", re.sub(r"\s+", "", local_section))
        if len(source_refs) < 4:
            errors.append(
                f"Expected >= 4 preview source_ref IDs in local section, found {len(source_refs)}"
            )

    # 5. Stage-specific data request membership & stale warning fidelity.
    request_region = pdf_text.partition("What to collect next")[2]
    request_region_norm = dehyphenated_norm(request_region)
    expected_requests = brief.get("data_requests", [])
    q_count = request_region_norm.count(norm(CAPACITY_REQUEST_QUESTION))

    if stage in ("created", "refreshed-selected"):
        if len(expected_requests) != 1 or q_count != 1:
            errors.append(
                f"Stage {stage}: expected 1 request in JSON/PDF, got JSON={len(expected_requests)} PDF={q_count}"
            )
        if expected_requests:
            req = expected_requests[0]
            if norm(" ".join(req["fields_needed"])) not in request_region_norm:
                errors.append(f"Stage {stage}: missing fields_needed in PDF request section")
    else:
        if len(expected_requests) != 0 or q_count != 0:
            errors.append(
                f"Stage {stage}: expected 0 requests in JSON/PDF, got JSON={len(expected_requests)} PDF={q_count}"
            )

    if stage == "stale":
        stale_phrases = [w for w in brief.get("warnings", []) if "stale" in w.lower()]
        if not stale_phrases or not all(has_phrase(w) for w in stale_phrases):
            errors.append("Stage stale: missing stale-selected warning in JSON or PDF")
        if not has_phrase("Data requests are available, but none has been selected for this brief"):
            errors.append("Stage stale: missing excluded-request state in What to collect next")
    elif stage == "refreshed-unselected":
        if not has_phrase("Data requests are available, but none has been selected for this brief"):
            errors.append("Stage refreshed-unselected: missing available-unselected message")
    elif stage in ("empty", "removed"):
        if not has_phrase("No data request has been created or loaded"):
            errors.append(f"Stage {stage}: missing empty request message")

    # 6. Decision Trace formatting & print chrome hygiene (SA-06).
    if re.search(r"\b[1-6]\.\s+0[1-6]\b", pdf_text):
        errors.append("Printed Decision trace contains duplicate step numbers (e.g. '1. 01')")
    merged_tokens = [
        "Released observed burdenReviewed",
        "selections)No Pilot-specific",
        "Target pathway stepRecognition",
        "Planning mechanismNavigation",
        "request needed1",
        "request needed0",
        "boundaryNo reviewed",
    ]
    for token in merged_tokens:
        if token in pdf_text:
            errors.append(f"Printed Decision trace merges label and value: {token!r}")
    for nav_leak in [
        "Review Local Context",
        "Review current data requests",
        "Select in Local context",
        "Analyze with AI",
        "Open Strategy AI Studio",
    ]:
        if nav_leak in pdf_text:
            errors.append(f"Printed PDF contains interactive navigation control text: {nav_leak!r}")

    return errors


before, after, report_path = map(Path, sys.argv[1:])
results = []
for stage in STAGES:
    old_json = (before / f"{stage}.json").read_bytes()
    new_json = (after / f"{stage}.json").read_bytes()
    old_text = extract_pdf_text(before / f"{stage}.pdf")
    new_text = extract_pdf_text(after / f"{stage}.pdf")
    page_counts = []
    for root in [before, after]:
        info = subprocess.check_output(["pdfinfo", str(root / f"{stage}.pdf")], text=True)
        page_counts.append(
            int(next(line for line in info.splitlines() if line.startswith("Pages:")).split(":")[1])
        )
    brief = json.loads(new_json)
    semantic_errors = verify_semantic_pdf(stage, brief, new_text, page_counts[1])
    freshness_errors = verify_freshness_sources(brief)
    results.append(
        {
            "stage": stage,
            "json_byte_equal": old_json == new_json,
            "legacy_json_byte_equal": compare_brief_bytes(old_json, new_json, brief),
            "freshness_sources_pass": len(freshness_errors) == 0,
            "freshness_errors": freshness_errors,
            "freshness_field_added": "evidence_freshness" in brief and "evidence_freshness" not in json.loads(old_json),
            "semantic_pdf_pass": len(semantic_errors) == 0,
            "semantic_errors": semantic_errors,
            "pdf_pages": page_counts,
            "json_sha256": hashlib.sha256(new_json).hexdigest(),
            "pdf_text_sha256": hashlib.sha256(new_text.encode("utf-8")).hexdigest(),
            "exact_legacy_text_equal": old_text == new_text,
        }
    )

report = {
    "passed": all(r["legacy_json_byte_equal"] and r["freshness_sources_pass"] and r["semantic_pdf_pass"] for r in results),
    "comparison_mode": "exact_legacy_json_bytes_and_stage_aware_semantic_pdf",
    "allowed_additions_to_legacy_base": ["evidence_freshness"],
    "clock": "2026-10-25T15:00:00Z",
    "results": results,
    "limits": (
        "Enforces exact JSON byte parity, allowing only the addition of source-bound evidence_freshness "
        "when the base lacks it, plus strict stage-aware "
        "semantic PDF verification (all 21 national findings, 4 headline CIs, native units, "
        "boundaries, local/ESAQ/PSAQ caveats, provenance locators, Decision trace formatting, "
        "and request lifecycle inclusion/stale states); layout/typography differences alone may pass."
    ),
}
report_path.write_text(json.dumps(report, indent=2) + "\n")
print(json.dumps(report, indent=2))
assert report["passed"], "Canonical JSON bytes or semantic PDF checks failed; inspect comparison before merging."
