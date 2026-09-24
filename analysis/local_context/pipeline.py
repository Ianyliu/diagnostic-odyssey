#!/usr/bin/env python3
"""Build a preliminary West Virginia HRSA + ACS local-context candidate.

This pipeline is deliberately separate from the reviewed MEPS national artifact.
It produces only aggregate contextual indicators and provenance metadata.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import socket
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
CONFIG_DIR = Path(__file__).resolve().parent / "config"
HRSA_CONFIG_PATH = CONFIG_DIR / "hrsa_hpsa_fields.v1.json"
ACS_CONFIG_PATH = CONFIG_DIR / "acs_2024_5year_variables.v1.json"
NATIONAL_ARTIFACT_VERSION = "meps-2024-long-covid-candidate-20260923T020607Z"
PROHIBITED = [
    "West Virginia Long COVID prevalence",
    "West Virginia Long COVID cost",
    "state-specific Long COVID burden",
    "causal diagnostic-delay effect",
    "causal pilot benefit",
    "causal effect modifier",
    "calibrated access severity score",
    "attributable cost",
    "savings",
    "ROI",
]
ACS_SENTINELS = {-999999999, -888888888, -666666666, -555555555, -333333333, -222222222}
USER_AGENT = "DiagnosticOdyssey/1.0 (+https://github.com/Ianyliu/diagnostic-odyssey)"


class ContractError(RuntimeError):
    pass


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def utc_now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


ACS_CANONICALIZATION_RULE = (
    "UTF-8 JSON; ensure_ascii=false; object keys sorted recursively; "
    "separators=(',', ':'); arrays preserve source order; exactly one terminal LF; "
    "Census API key and keyed URLs excluded before serialization."
)


def canonical_json_bytes(payload: Any) -> bytes:
    return (
        json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        + "\n"
    ).encode("utf-8")


def canonical_json_fingerprint(payload: Any) -> dict[str, Any]:
    canonical = canonical_json_bytes(payload)
    return {
        "sha256": hashlib.sha256(canonical).hexdigest(),
        "byte_size": len(canonical),
    }


def git_head() -> str:
    expected = os.environ.get("GITHUB_SHA")
    try:
        actual = subprocess.check_output(
            ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
        ).strip()
    except Exception as exc:  # pragma: no cover - only relevant outside a git checkout
        raise ContractError(f"Unable to resolve git HEAD: {exc}") from exc
    if expected and actual != expected:
        raise ContractError(f"Checkout SHA mismatch: HEAD={actual}, GITHUB_SHA={expected}")
    return actual


def sanitize_url(url: str) -> str:
    """Redact Census-style API keys from URLs before surfacing errors."""
    return re.sub(r"([?&]key=)[^&\s]+", r"\1[REDACTED]", url, flags=re.IGNORECASE)


def sanitize_error_text(value: object) -> str:
    """Redact API keys that may be embedded in exception text."""
    return re.sub(
        r"([?&]key=)[^&\s'\"]+",
        r"\1[REDACTED]",
        str(value),
        flags=re.IGNORECASE,
    )


def is_retryable_network_error(exc: BaseException) -> bool:
    if isinstance(exc, urllib.error.HTTPError):
        return exc.code == 429 or 500 <= exc.code <= 599
    return isinstance(
        exc,
        (urllib.error.URLError, TimeoutError, socket.timeout, ConnectionError),
    )


def normalized_fips(value: str, width: int) -> str:
    text = (value or "").strip()
    if not re.fullmatch(r"\d+", text):
        raise ContractError(f"Invalid FIPS value {value!r}")
    return text.zfill(width)


def download_file(
    url: str,
    destination: Path,
    max_attempts: int = 3,
    retry_delay_seconds: float = 0.5,
) -> dict[str, Any]:
    """Download atomically, retrying only transient network/server failures."""
    destination.parent.mkdir(parents=True, exist_ok=True)
    part_path = destination.with_name(destination.name + ".part")
    safe_url = sanitize_url(url)
    last_error: BaseException | None = None

    for attempt in range(1, max_attempts + 1):
        if part_path.exists():
            part_path.unlink()
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        retrieved_at = utc_now()
        h = hashlib.sha256()
        total = 0
        try:
            with urllib.request.urlopen(req, timeout=120) as response, part_path.open("wb") as out:
                final_url = response.geturl()
                last_modified = response.headers.get("Last-Modified")
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    out.write(chunk)
                    h.update(chunk)
                    total += len(chunk)

            if total <= 0:
                raise ContractError(f"Source download was empty: {safe_url}")

            published = None
            if last_modified:
                try:
                    published = parsedate_to_datetime(last_modified).astimezone(timezone.utc).date().isoformat()
                except Exception:
                    published = last_modified

            part_path.replace(destination)
            return {
                "requested_url": safe_url,
                "resolved_url": sanitize_url(final_url),
                "retrieved_at": retrieved_at,
                "byte_size": total,
                "sha256": h.hexdigest(),
                "published_update_date": published,
            }
        except BaseException as exc:
            if part_path.exists():
                part_path.unlink()
            last_error = exc
            if isinstance(exc, ContractError) or not is_retryable_network_error(exc):
                raise ContractError(
                    f"Download failed for {safe_url}: {sanitize_error_text(exc)}"
                ) from exc
            if attempt < max_attempts:
                time.sleep(retry_delay_seconds * attempt)

    raise ContractError(
        f"Download failed after {max_attempts} attempts for {safe_url}: "
        f"{sanitize_error_text(last_error)}"
    ) from last_error


def verify_hrsa_header(fieldnames: list[str] | None, config: dict[str, Any]) -> None:
    if not fieldnames:
        raise ContractError("HRSA CSV has no header")
    missing = [name for name in config["required_fields"] if name not in fieldnames]
    if missing:
        raise ContractError(f"Required HRSA columns changed or are missing: {missing}")


def normalize_rural(value: str) -> str | None:
    text = (value or "").strip()
    if text in {"Rural", "Partially Rural", "Non-Rural", "Unknown", "Not Applicable"}:
        return text
    if text == "":
        return "Unknown"
    if text == "N/A":
        return "Not Applicable"
    return None


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")


def summarize_hrsa(path: Path, config: dict[str, Any], dataset_key: str, state_fips: str = "54") -> tuple[list[dict[str, Any]], dict[str, Any]]:
    field = config["field_map"]
    dataset = config["datasets"][dataset_key]
    by_id: dict[str, list[dict[str, str]]] = defaultdict(list)
    total_rows = 0
    matching_rows = 0
    statuses: Counter[str] = Counter()

    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        verify_hrsa_header(reader.fieldnames, config)
        for row in reader:
            total_rows += 1
            try:
                row_state = normalized_fips(row[field["state_fips"]], 2)
            except ContractError:
                continue
            if row_state != state_fips:
                continue
            row_state_name = (row[field["state_name"]] or "").strip()
            if row_state_name != "West Virginia":
                raise ContractError(
                    f"HRSA state mismatch for FIPS {state_fips}: "
                    f"expected 'West Virginia', got {row_state_name!r}"
                )
            matching_rows += 1
            discipline = (row[field["discipline"]] or "").strip()
            if discipline != dataset["expected_discipline"]:
                raise ContractError(
                    f"Unexpected HRSA discipline in {dataset_key}: {discipline!r}; "
                    f"expected {dataset['expected_discipline']!r}"
                )
            status = (row[field["status"]] or "").strip()
            statuses[status or "<missing>"] += 1
            if status != config["designated_status"]:
                continue
            hpsa_id = (row[field["hpsa_id"]] or "").strip()
            if not hpsa_id:
                raise ContractError("Designated HRSA row has missing HPSA ID")
            by_id[hpsa_id].append(row)

    if total_rows == 0:
        raise ContractError(f"HRSA {dataset_key} source has zero rows")
    if matching_rows == 0:
        raise ContractError(f"HRSA {dataset_key} source has zero West Virginia rows")
    if not by_id:
        raise ContractError(f"HRSA {dataset_key} source has zero currently Designated WV HPSA IDs")

    designation_types: Counter[str] = Counter()
    scores: list[float] = []
    missing_score_ids: list[str] = []
    rural_by_id: dict[str, str] = {}
    mixed_rural_ids: list[str] = []
    unexpected_rural_status_values: set[str] = set()
    duplicate_ids = {hid: len(rows) for hid, rows in by_id.items() if len(rows) > 1}

    for hpsa_id, rows in by_id.items():
        types = {(r[field["designation_type"]] or "").strip() for r in rows}
        disciplines = {(r[field["discipline"]] or "").strip() for r in rows}
        states = {normalized_fips(r[field["state_fips"]], 2) for r in rows}
        raw_scores = {(r[field["score"]] or "").strip() for r in rows if (r[field["score"]] or "").strip()}
        if len(types) != 1 or len(disciplines) != 1 or states != {state_fips} or len(raw_scores) > 1:
            raise ContractError(
                f"Duplicate handling invariant failed for HPSA ID {hpsa_id}: "
                f"types={types}, disciplines={disciplines}, states={states}, scores={raw_scores}"
            )
        designation_type = next(iter(types))
        designation_types[designation_type] += 1

        if raw_scores:
            score_text = next(iter(raw_scores))
            try:
                scores.append(float(score_text))
            except ValueError as exc:
                raise ContractError(f"Non-numeric HPSA score {score_text!r} for {hpsa_id}") from exc
        else:
            missing_score_ids.append(hpsa_id)

        rural_values: set[str] = set()
        rural_drift_for_id = False
        for row in rows:
            raw_rural = (row[field["rural_status"]] or "").strip()
            normalized_rural = normalize_rural(raw_rural)
            if normalized_rural is None:
                rural_drift_for_id = True
                unexpected_rural_status_values.add(raw_rural)
            else:
                rural_values.add(normalized_rural)
        if rural_drift_for_id:
            continue
        if len(rural_values) == 1:
            rural_by_id[hpsa_id] = next(iter(rural_values))
        else:
            mixed_rural_ids.append(hpsa_id)

    distinct_count = len(by_id)
    if sum(designation_types.values()) != distinct_count:
        raise ContractError("Designation-type breakdown does not reconcile to distinct HPSA ID count")

    discipline_slug = "primary-care" if dataset_key == "primary_care" else "mental-health"
    base_id = f"wv.hrsa.{discipline_slug}"
    universe = (
        f"Distinct HRSA HPSA IDs with HPSA Status = Designated, "
        f"Common State FIPS Code = {state_fips}, and HPSA Discipline Class = "
        f"{dataset['expected_discipline']}."
    )
    common = {
        "geography_name": "West Virginia",
        "geography_type": "state",
        "state_fips": state_fips,
        "county_fips": None,
        "source_agency": "HRSA",
        "source_ref": dataset["source_ref"],
        "source_locator": dataset["download_url"],
        "unit": "designations",
        "universe": universe,
        "margin_of_error": None,
        "confidence_level": None,
        "uncertainty_type": None,
        "context_type": "contextual_indicator",
        "state": "loaded",
        "limitations": [
            "HPSA IDs may contain multiple component rows; counts use distinct HPSA IDs.",
            "Designation counts are contextual descriptors and are not a calibrated shortage-severity scale.",
            "HPSA Score is a source-published designation priority/shortage score, not a calibrated statewide access-severity composite.",
            "No HPSA designation populations, FTE-short values, or other overlapping quantities are summed."
        ],
        "allowed_interpretation": "Implementation/access context for West Virginia.",
        "prohibited_interpretation": PROHIBITED,
        "release_status": "preliminary",
    }
    indicators: list[dict[str, Any]] = [{
        **common,
        "indicator_id": f"{base_id}.designated-distinct-count",
        "label": f"Distinct currently Designated {dataset['expected_discipline']} HPSA IDs",
        "value": distinct_count,
    }]

    for designation_type, count in sorted(designation_types.items()):
        indicators.append({
            **common,
            "indicator_id": f"{base_id}.designation-type.{slug(designation_type)}",
            "label": f"{dataset['expected_discipline']} HPSA designation type: {designation_type}",
            "value": count,
        })

    if scores:
        indicators.append({
            **common,
            "indicator_id": f"{base_id}.max-score",
            "label": f"Maximum HPSA score among included {dataset['expected_discipline']} designations",
            "value": max(scores),
            "unit": "HPSA score points",
            "universe": universe + " Restricted to included IDs with non-missing HPSA Score.",
            "limitations": common["limitations"] + [
                "The maximum preserves the source-published HPSA designation priority/shortage score; it is not a statewide severity index or calibrated state composite."
            ],
        })

    rural_breakdown_included = (
        len(mixed_rural_ids) == 0 and len(unexpected_rural_status_values) == 0
    )
    if rural_breakdown_included:
        rural_counts = Counter(rural_by_id.values())
        if sum(rural_counts.values()) != distinct_count:
            raise ContractError("Rural-status breakdown does not reconcile to distinct HPSA ID count")
        for rural_status in ["Rural", "Partially Rural", "Non-Rural", "Not Applicable", "Unknown"]:
            count = rural_counts.get(rural_status, 0)
            indicators.append({
                **common,
                "indicator_id": f"{base_id}.rural-status.{slug(rural_status)}",
                "label": f"{dataset['expected_discipline']} HPSA rural status: {rural_status}",
                "value": count,
                "limitations": common["limitations"] + [
                    "Rural-status breakdown is included only because each included distinct HPSA ID had one unambiguous normalized rural-status value."
                ],
            })

    update_dates = sorted({
        (row[field["designation_update_date"]] or "").strip()
        for rows in by_id.values() for row in rows
        if (row[field["designation_update_date"]] or "").strip()
    })
    diagnostics = {
        "dataset_key": dataset_key,
        "total_rows_read": total_rows,
        "rows_matching_west_virginia": matching_rows,
        "rows_by_hpsa_status": dict(sorted(statuses.items())),
        "distinct_designated_hpsa_ids": distinct_count,
        "designation_type_counts": dict(sorted(designation_types.items())),
        "missing_hpsa_score_distinct_id_count": len(missing_score_ids),
        "duplicate_hpsa_id_count": len(duplicate_ids),
        "duplicate_hpsa_ids": duplicate_ids,
        "rural_status_breakdown_included": rural_breakdown_included,
        "mixed_rural_status_hpsa_ids": mixed_rural_ids,
        "unexpected_rural_status_values": sorted(unexpected_rural_status_values),
        "designation_update_dates_observed": update_dates,
        "source_field_map": field,
    }
    return indicators, diagnostics


def fetch_json(
    url: str,
    max_attempts: int = 3,
    retry_delay_seconds: float = 0.5,
) -> Any:
    """Fetch JSON with bounded transient retries and API-key-safe errors."""
    safe_url = sanitize_url(url)
    last_error: BaseException | None = None
    for attempt in range(1, max_attempts + 1):
        req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(req, timeout=60) as response:
                return json.load(response)
        except BaseException as exc:
            last_error = exc
            if not is_retryable_network_error(exc):
                raise ContractError(
                    f"Failed to fetch JSON from {safe_url}: {sanitize_error_text(exc)}"
                ) from exc
            if attempt < max_attempts:
                time.sleep(retry_delay_seconds * attempt)
    raise ContractError(
        f"Failed to fetch JSON after {max_attempts} attempts from {safe_url}: "
        f"{sanitize_error_text(last_error)}"
    ) from last_error


def _metadata_attributes(record: dict[str, Any], variable_id: str) -> list[str]:
    raw = record.get("attributes")
    if not isinstance(raw, str):
        raise ContractError(
            f"Census metadata relationship changed for {variable_id}: missing string attributes"
        )
    return [value.strip() for value in raw.split(",") if value.strip()]


def _validate_attribute_record(
    entry: Any,
    *,
    variable_id: str,
    expected_label: str,
    expected_attribute_of: str,
    expected_attribute_type: str,
) -> dict[str, Any]:
    if not isinstance(entry, dict):
        raise ContractError(f"Census individual metadata entry for {variable_id} is not an object")
    if entry.get("requested_variable_id") != variable_id:
        raise ContractError(
            f"Census individual metadata request identity changed for {variable_id}: "
            f"got {entry.get('requested_variable_id')!r}"
        )
    record = entry.get("response")
    if not isinstance(record, dict):
        raise ContractError(f"Census individual metadata response for {variable_id} is not an object")
    required = {"label", "attribute of", "attribute type"}
    missing = sorted(required - set(record))
    if missing:
        raise ContractError(
            f"Census individual metadata shape changed for {variable_id}: missing {missing}"
        )
    expected = {
        "label": expected_label,
        "attribute of": expected_attribute_of,
        "attribute type": expected_attribute_type,
    }
    for key, expected_value in expected.items():
        if record.get(key) != expected_value:
            raise ContractError(
                f"Census metadata contract changed for {variable_id} field {key!r}: "
                f"expected {expected_value!r}, got {record.get(key)!r}"
            )
    if "name" in record and record.get("name") != variable_id:
        raise ContractError(
            f"Census metadata contract changed for {variable_id} field 'name': "
            f"expected {variable_id!r}, got {record.get('name')!r}"
        )
    return record


def verify_acs_metadata(
    config: dict[str, Any],
    bulk_metadata: dict[str, Any],
    individual_metadata: dict[str, dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any]]:
    variables = bulk_metadata.get("variables")
    if not isinstance(variables, dict):
        raise ContractError("Census variables metadata has no variables object")

    verified: dict[str, Any] = {}
    bulk_pe_records: dict[str, Any] = {}
    used_individual_records: dict[str, Any] = {}

    for spec in config["variables"]:
        estimate_id = spec["estimate"]
        moe_id = spec["moe"]
        pea_id = spec["estimate_annotation"]
        pma_id = spec["moe_annotation"]

        pe_record = variables.get(estimate_id)
        if not isinstance(pe_record, dict):
            raise ContractError(
                f"Census bulk metadata is missing configured PE variable {estimate_id}"
            )
        if pe_record.get("label") != spec["expected_estimate_label"]:
            raise ContractError(
                f"Census variable meaning changed for {estimate_id}: "
                f"expected {spec['expected_estimate_label']!r}, got {pe_record.get('label')!r}"
            )

        pe_attributes = _metadata_attributes(pe_record, estimate_id)
        expected_pe_attributes = {pea_id, moe_id, pma_id}
        if set(pe_attributes) != expected_pe_attributes:
            raise ContractError(
                f"Census PE attributes relationship changed for {estimate_id}: "
                f"expected {sorted(expected_pe_attributes)}, got {sorted(pe_attributes)}"
            )

        pm_record = _validate_attribute_record(
            individual_metadata.get(moe_id),
            variable_id=moe_id,
            expected_label=spec["expected_moe_label"],
            expected_attribute_of=estimate_id,
            expected_attribute_type="MARGIN_OF_ERROR",
        )
        pm_attributes = _metadata_attributes(pm_record, moe_id)
        if pm_attributes != [pma_id]:
            raise ContractError(
                f"Census PM annotation relationship changed for {moe_id}: "
                f"expected {[pma_id]}, got {pm_attributes}"
            )

        pea_record = _validate_attribute_record(
            individual_metadata.get(pea_id),
            variable_id=pea_id,
            expected_label=spec["expected_estimate_annotation_label"],
            expected_attribute_of=spec["expected_estimate_annotation_attribute_of"],
            expected_attribute_type="ANNOTATION",
        )
        pma_record = _validate_attribute_record(
            individual_metadata.get(pma_id),
            variable_id=pma_id,
            expected_label=spec["expected_moe_annotation_label"],
            expected_attribute_of=spec["expected_moe_annotation_attribute_of"],
            expected_attribute_type="ANNOTATION",
        )

        bulk_pe_records[estimate_id] = pe_record
        for variable_id in (moe_id, pea_id, pma_id):
            used_individual_records[variable_id] = individual_metadata[variable_id]

        verified[spec["indicator_id"]] = {
            "estimate": estimate_id,
            "estimate_label": pe_record["label"],
            "estimate_attributes": pe_attributes,
            "estimate_annotation": pea_id,
            "estimate_annotation_label": pea_record["label"],
            "estimate_annotation_attribute_of": pea_record["attribute of"],
            "moe": moe_id,
            "moe_label": pm_record["label"],
            "moe_attribute_of": pm_record["attribute of"],
            "moe_attribute_type": pm_record["attribute type"],
            "moe_attributes": pm_attributes,
            "moe_annotation": pma_id,
            "moe_annotation_label": pma_record["label"],
            "moe_annotation_attribute_of": pma_record["attribute of"],
        }

    metadata_contract = {
        "bulk_metadata_endpoint": config["metadata_url"],
        "individual_metadata_url_template": config["variable_metadata_url_template"],
        "bulk_pe_records": bulk_pe_records,
        "individual_attribute_records": used_individual_records,
    }
    return verified, metadata_contract


def fetch_acs_individual_metadata(config: dict[str, Any]) -> dict[str, dict[str, Any]]:
    records: dict[str, dict[str, Any]] = {}
    template = config.get("variable_metadata_url_template")
    if not isinstance(template, str) or "{variable}" not in template:
        raise ContractError("ACS variable metadata URL template is missing or invalid")
    for spec in config["variables"]:
        for key in ("moe", "estimate_annotation", "moe_annotation"):
            variable_id = spec[key]
            record = fetch_json(template.replace("{variable}", variable_id))
            if not isinstance(record, dict):
                raise ContractError(
                    f"Census individual metadata response for {variable_id} is not an object"
                )
            records[variable_id] = {
                "requested_variable_id": variable_id,
                "response": record,
            }
    return records


def acs_requested_variables(config: dict[str, Any]) -> list[str]:
    variables = ["NAME"]
    for spec in config["variables"]:
        variables.extend([
            spec["estimate"], spec["moe"],
            spec["estimate_annotation"], spec["moe_annotation"]
        ])
    return variables


def build_acs_request(config: dict[str, Any]) -> tuple[str, str]:
    variables = acs_requested_variables(config)
    base = config["base_url"]
    query = urllib.parse.urlencode(
        {"get": ",".join(variables), "for": config["geography"]["api_for"]},
        safe=",:"
    )
    public_endpoint = f"{base}?{query}"
    key = os.environ.get("CENSUS_API_KEY", "").strip()
    if not key:
        raise ContractError(
            "Missing required GitHub Actions secret/environment variable CENSUS_API_KEY. "
            "Add repository Actions secret CENSUS_API_KEY before dispatching the local-context workflow."
        )
    return public_endpoint, f"{public_endpoint}&key={urllib.parse.quote(key)}"


def parse_acs(config: dict[str, Any], data: list[list[str]]) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    if not isinstance(data, list) or len(data) != 2:
        raise ContractError(f"Census state query must return exactly one data row; got {len(data)-1 if isinstance(data, list) else 'non-list'}")
    header, row = data
    if not isinstance(header, list) or not isinstance(row, list):
        raise ContractError("Census response header and row must both be arrays")
    required_fields = {"NAME", "state"}
    for spec in config["variables"]:
        required_fields.update({
            spec["estimate"],
            spec["moe"],
            spec["estimate_annotation"],
            spec["moe_annotation"],
        })
    missing_fields = sorted(required_fields - set(header))
    if missing_fields:
        raise ContractError(f"Census response missing required columns: {missing_fields}")
    try:
        record = dict(zip(header, row, strict=True))
    except ValueError as exc:
        raise ContractError("Census response header/value lengths do not match") from exc
    geography = config["geography"]
    if record.get("NAME") != geography["name"] or record.get("state") != geography["state_fips"]:
        raise ContractError(
            f"Census geography mismatch: expected {geography['name']} / {geography['state_fips']}, "
            f"got {record.get('NAME')} / {record.get('state')}"
        )

    indicators: list[dict[str, Any]] = []
    values_diag: dict[str, Any] = {}
    for spec in config["variables"]:
        annotations = {
            spec["estimate_annotation"]: record[spec["estimate_annotation"]],
            spec["moe_annotation"]: record[spec["moe_annotation"]],
        }
        if any((value or "").strip() for value in annotations.values()):
            raise ContractError(f"Census annotation/special-value flag present for {spec['indicator_id']}: {annotations}")
        try:
            estimate = float(record[spec["estimate"]])
            moe = float(record[spec["moe"]])
        except (KeyError, TypeError, ValueError) as exc:
            raise ContractError(f"Census returned non-numeric/missing value for {spec['indicator_id']}") from exc
        if estimate in ACS_SENTINELS or moe in ACS_SENTINELS or estimate <= -1e8 or moe <= -1e8:
            raise ContractError(f"Census sentinel/unavailable value returned for {spec['indicator_id']}")
        if not 0 <= estimate <= 100:
            raise ContractError(f"Census percent outside [0,100] for {spec['indicator_id']}: {estimate}")
        if moe < 0:
            raise ContractError(f"Census MOE is negative for {spec['indicator_id']}: {moe}")

        indicators.append({
            "indicator_id": spec["indicator_id"],
            "label": spec["label"],
            "geography_name": geography["name"],
            "geography_type": geography["type"],
            "state_fips": geography["state_fips"],
            "county_fips": geography["county_fips"],
            "source_agency": "U.S. Census Bureau",
            "source_ref": "acs-2024-5year-profile",
            "source_locator": config["base_url"],
            "source_release_vintage": config["vintage"],
            "observation_as_of_date": "2024",
            "value": estimate,
            "unit": "percent",
            "universe": spec["universe"],
            "margin_of_error": moe,
            "confidence_level": config["confidence_level"],
            "uncertainty_type": "published_90_percent_margin_of_error",
            "context_type": "contextual_indicator",
            "state": "loaded",
            "limitations": [
                "ACS 5-year profile estimate; the published margin of error is preserved at its native 90% confidence level.",
                "This aggregate measure has its own published universe and must not be averaged with other local-context percentages.",
                "This is an area-level contextual descriptor, not an individual-level characteristic or causal adjustment factor."
            ],
            "allowed_interpretation": "Implementation/access context for West Virginia.",
            "prohibited_interpretation": PROHIBITED,
            "release_status": "preliminary",
        })
        values_diag[spec["indicator_id"]] = {
            "estimate_variable": spec["estimate"],
            "value": estimate,
            "moe_variable": spec["moe"],
            "margin_of_error_90_percent": moe,
            "annotations": annotations,
            "universe": spec["universe"],
        }
    return indicators, {
        "geography_returned": {"NAME": record["NAME"], "state": record["state"]},
        "values": values_diag,
    }


def write_json(path: Path, payload: Any) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", required=True)
    args = parser.parse_args()

    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    hrsa_config = load_json(HRSA_CONFIG_PATH)
    acs_config = load_json(ACS_CONFIG_PATH)
    code_commit = git_head()
    generated_at = utc_now()
    run_id = os.environ.get("GITHUB_RUN_ID", "local")
    artifact_version = f"local-context-wv-hrsa-acs-candidate-{generated_at.replace(':','').replace('-','')}"

    raw_dir = ROOT / "data" / "raw" / "hrsa" / "current"
    all_indicators: list[dict[str, Any]] = []
    hrsa_diagnostics: dict[str, Any] = {}
    hrsa_sources: list[dict[str, Any]] = []
    hrsa_metadata: dict[str, Any] = {"sources": {}}

    for dataset_key, dataset in hrsa_config["datasets"].items():
        local_path = raw_dir / f"{dataset_key}.csv"
        meta = download_file(dataset["download_url"], local_path)
        indicators, diagnostics = summarize_hrsa(local_path, hrsa_config, dataset_key)
        snapshot_date = meta["retrieved_at"][:10]
        vintage = f"Current HRSA HPSA snapshot retrieved {snapshot_date}"
        for indicator in indicators:
            indicator["source_release_vintage"] = vintage
            indicator["observation_as_of_date"] = snapshot_date
        all_indicators.extend(indicators)
        diagnostics["source_checksum_sha256"] = meta["sha256"]
        hrsa_diagnostics[dataset_key] = diagnostics
        hrsa_metadata["sources"][dataset_key] = {**dataset, **meta}
        hrsa_sources.append({
            "source_ref": dataset["source_ref"],
            "source_agency": "HRSA",
            "source_name": dataset["name"],
            "source_locator": meta["resolved_url"],
            "source_release_vintage": vintage,
            "observation_as_of_date": snapshot_date,
            "retrieved_at": meta["retrieved_at"],
            "byte_size": meta["byte_size"],
            "sha256": meta["sha256"],
            "published_update_date": meta["published_update_date"],
            "limitations": [
                "Live HRSA shortage-designation snapshot; source vintage is retrieval-specific and is not aligned to the ACS multi-year vintage."
            ],
        })

    bulk_metadata = fetch_json(acs_config["metadata_url"])
    individual_metadata = fetch_acs_individual_metadata(acs_config)
    metadata_verified, metadata_contract = verify_acs_metadata(
        acs_config, bulk_metadata, individual_metadata
    )
    public_endpoint, keyed_endpoint = build_acs_request(acs_config)
    acs_retrieved_at = utc_now()
    acs_data = fetch_json(keyed_endpoint)
    acs_indicators, acs_diag = parse_acs(acs_config, acs_data)
    all_indicators.extend(acs_indicators)

    data_fingerprint = canonical_json_fingerprint(acs_data)
    metadata_fingerprint = canonical_json_fingerprint(metadata_contract)
    source_snapshot = {
        "acs_data_response": acs_data,
        "acs_metadata_contract": metadata_contract,
    }
    snapshot_fingerprint = canonical_json_fingerprint(source_snapshot)

    acs_source = {
        "source_ref": "acs-2024-5year-profile",
        "source_agency": "U.S. Census Bureau",
        "source_name": acs_config["dataset"],
        "source_locator": public_endpoint,
        "source_release_vintage": acs_config["vintage"],
        "observation_as_of_date": "2024",
        "retrieved_at": acs_retrieved_at,
        "byte_size": snapshot_fingerprint["byte_size"],
        "sha256": snapshot_fingerprint["sha256"],
        "published_update_date": None,
        "limitations": [
            "2024 ACS 5-year Data Profile estimates summarize the 2020-2024 period and are not temporally equivalent to the current HRSA snapshot.",
            "ACS source SHA-256 identifies the canonical combined state-data response plus the exact metadata contract records used for validation; it is not a hash of a raw HTTP transfer."
        ],
    }

    artifact = {
        "manifest": {
            "artifact_family": "local_context",
            "artifact_version": artifact_version,
            "generated_at": generated_at,
            "code_commit": code_commit,
            "run_id": run_id,
            "release_status": "preliminary",
            "national_meps_artifact_version": NATIONAL_ARTIFACT_VERSION,
            "national_meps_burden_unchanged": True,
        },
        "geography": {
            "geography_name": "West Virginia",
            "geography_type": "state",
            "state_fips": "54",
            "county_fips": None,
        },
        "indicators": all_indicators,
        "sources": [*hrsa_sources, acs_source],
    }

    diagnostics = {
        "artifact_version": artifact_version,
        "national_meps_burden_unchanged": True,
        "hrsa": hrsa_diagnostics,
        "acs": {
            "exact_request_endpoint_excluding_api_key": public_endpoint,
            "metadata_contract_verified": metadata_verified,
            "source_vintage": acs_config["vintage"],
            "acs_data_response_sha256": data_fingerprint["sha256"],
            "acs_data_response_byte_size": data_fingerprint["byte_size"],
            "acs_metadata_contract_sha256": metadata_fingerprint["sha256"],
            "acs_metadata_contract_byte_size": metadata_fingerprint["byte_size"],
            "acs_source_snapshot_sha256": snapshot_fingerprint["sha256"],
            "acs_source_snapshot_byte_size": snapshot_fingerprint["byte_size"],
            **acs_diag,
        },
    }
    review_manifest = {
        "artifact_version": artifact_version,
        "release_status": "preliminary",
        "automatic_release": False,
        "review_required": True,
        "review_checks": [
            {"check": "source_integrity", "status": "needs_review"},
            {"check": "hrsa_universe_and_dedup", "status": "needs_review"},
            {"check": "acs_labels_universes_and_moe", "status": "needs_review"},
            {"check": "geography", "status": "needs_review"},
            {"check": "interpretation_boundaries", "status": "needs_review"},
            {"check": "runtime_separation", "status": "needs_review"},
        ],
        "promotion_rule": "Candidate indicators must not enter runtime until independently reviewed and explicitly promoted to reviewed_released."
    }
    acs_metadata = {
        "source_ref": "acs-2024-5year-profile",
        "dataset": acs_config["dataset"],
        "source_retrieved_at": acs_retrieved_at,
        "source_vintage": acs_config["vintage"],
        "metadata_endpoint": acs_config["metadata_url"],
        "individual_metadata_url_template": acs_config["variable_metadata_url_template"],
        "request_endpoint_excluding_api_key": public_endpoint,
        "exact_variables_requested": acs_requested_variables(acs_config),
        "metadata_contract_verified": metadata_verified,
        "official_metadata_contract": metadata_contract,
        "acs_data_response_sha256": data_fingerprint["sha256"],
        "acs_data_response_byte_size": data_fingerprint["byte_size"],
        "acs_metadata_contract_sha256": metadata_fingerprint["sha256"],
        "acs_metadata_contract_byte_size": metadata_fingerprint["byte_size"],
        "acs_source_snapshot_sha256": snapshot_fingerprint["sha256"],
        "acs_source_snapshot_byte_size": snapshot_fingerprint["byte_size"],
        "canonicalization_rule": ACS_CANONICALIZATION_RULE,
        "source_sha256_represents": (
            "SHA-256 of canonical JSON for {'acs_data_response': <exact parsed state response>, "
            "'acs_metadata_contract': <exact relevant metadata records used for validation>}"
        ),
        "api_key_recorded": False,
        "keyed_url_recorded": False,
    }
    actions_manifest = {
        "repository": os.environ.get("GITHUB_REPOSITORY"),
        "ref": os.environ.get("GITHUB_REF"),
        "sha": os.environ.get("GITHUB_SHA", code_commit),
        "run_id": os.environ.get("GITHUB_RUN_ID"),
        "run_attempt": os.environ.get("GITHUB_RUN_ATTEMPT"),
        "workflow": os.environ.get("GITHUB_WORKFLOW"),
        "generated_at": generated_at,
    }

    files = {
        "local-context.json": artifact,
        "diagnostics.json": diagnostics,
        "review-manifest.json": review_manifest,
        "hrsa-source-metadata.json": hrsa_metadata,
        "acs-source-metadata.json": acs_metadata,
        "github-actions-run-manifest.json": actions_manifest,
    }
    for name, payload in files.items():
        write_json(output_dir / name, payload)

    sums = []
    for name in sorted(files):
        sums.append(f"{sha256_file(output_dir / name)}  {name}")
    (output_dir / "SHA256SUMS").write_text("\n".join(sums) + "\n", encoding="utf-8")

    unexpected = {p.name for p in output_dir.iterdir()} - (set(files) | {"SHA256SUMS"})
    if unexpected:
        raise ContractError(f"Unexpected candidate output files: {sorted(unexpected)}")

    print(f"Generated preliminary local-context candidate {artifact_version}")
    print(f"Output files: {', '.join(sorted(set(files) | {'SHA256SUMS'}))}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except ContractError as exc:
        print(f"LOCAL CONTEXT CONTRACT ERROR: {exc}", file=sys.stderr)
        raise SystemExit(2)
