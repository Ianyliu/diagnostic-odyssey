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
import subprocess
import sys
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
    "state-specific Long COVID burden",
    "causal determinant of diagnostic delay",
    "causal effect modifier",
    "attributable cost",
    "predicted pilot effect",
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
    return re.sub(r"([?&]key=)[^&]+", r"\1[REDACTED]", url)


def normalized_fips(value: str, width: int) -> str:
    text = (value or "").strip()
    if not re.fullmatch(r"\d+", text):
        raise ContractError(f"Invalid FIPS value {value!r}")
    return text.zfill(width)


def download_file(url: str, destination: Path, max_retries: int = 3) -> dict[str, Any]:
    destination.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    retrieved_at = utc_now()
    safe_url = sanitize_url(url)
    last_error: Exception | None = None

    for attempt in range(1, max_retries + 1):
        tmp = destination.with_suffix(".part")
        if tmp.exists():
            tmp.unlink()
        h = hashlib.sha256()
        total = 0
        try:
            with urllib.request.urlopen(req, timeout=120) as response, tmp.open("wb") as out:
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

            tmp.replace(destination)
            return {
                "requested_url": url,
                "resolved_url": final_url,
                "retrieved_at": retrieved_at,
                "byte_size": total,
                "sha256": h.hexdigest(),
                "published_update_date": published,
            }
        except Exception as exc:
            if tmp.exists():
                tmp.unlink()
            last_error = exc
            if attempt < max_retries:
                import time
                time.sleep(0.5 * attempt)

    raise ContractError(f"Download failed after {max_retries} attempts for {safe_url}: {sanitize_url(str(last_error))}")


def verify_hrsa_header(fieldnames: list[str] | None, config: dict[str, Any]) -> None:
    if not fieldnames:
        raise ContractError("HRSA CSV has no header")
    missing = [name for name in config["required_fields"] if name not in fieldnames]
    if missing:
        raise ContractError(f"Required HRSA columns changed or are missing: {missing}")


def normalize_rural(value: str) -> str:
    text = (value or "").strip()
    if text in {"Rural", "Partially Rural", "Non-Rural"}:
        return text
    if text in {"", "Unknown", "Not Applicable", "N/A"}:
        return "Unknown"
    return "Unknown"


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

        rural_values = {normalize_rural(r[field["rural_status"]]) for r in rows}
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
                "The maximum is a source-published HPSA score, not a state-level composite severity score."
            ],
        })

    rural_breakdown_included = len(mixed_rural_ids) == 0
    if rural_breakdown_included:
        rural_counts = Counter(rural_by_id.values())
        if sum(rural_counts.values()) != distinct_count:
            raise ContractError("Rural-status breakdown does not reconcile to distinct HPSA ID count")
        for rural_status in ["Rural", "Partially Rural", "Non-Rural", "Unknown"]:
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
        "designation_update_dates_observed": update_dates,
        "source_field_map": field,
    }
    return indicators, diagnostics


def fetch_json(url: str) -> Any:
    safe_url = sanitize_url(url)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return json.load(response)
    except Exception as exc:
        raise ContractError(f"Failed to fetch JSON from {safe_url}: {sanitize_url(str(exc))}") from exc


def verify_acs_labels(config: dict[str, Any], metadata: dict[str, Any]) -> dict[str, dict[str, str]]:
    variables = metadata.get("variables")
    if not isinstance(variables, dict):
        raise ContractError("Census variables metadata has no variables object")
    verified: dict[str, dict[str, str]] = {}
    for spec in config["variables"]:
        for key, expected_key in [("estimate", "expected_estimate_label"), ("moe", "expected_moe_label")]:
            variable_id = spec[key]
            actual = variables.get(variable_id, {}).get("label")
            expected = spec[expected_key]
            if actual != expected:
                raise ContractError(
                    f"Census variable meaning changed for {variable_id}: "
                    f"expected {expected!r}, got {actual!r}"
                )
        verified[spec["indicator_id"]] = {
            "estimate": spec["estimate"],
            "estimate_label": variables[spec["estimate"]]["label"],
            "moe": spec["moe"],
            "moe_label": variables[spec["moe"]]["label"],
        }
    return verified


def build_acs_request(config: dict[str, Any]) -> tuple[str, str]:
    variables = ["NAME"]
    for spec in config["variables"]:
        variables.extend([
            spec["estimate"], spec["moe"],
            spec["estimate_annotation"], spec["moe_annotation"]
        ])
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
    record = dict(zip(header, row, strict=True))
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
            spec["estimate_annotation"]: record.get(spec["estimate_annotation"], ""),
            spec["moe_annotation"]: record.get(spec["moe_annotation"], ""),
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

    metadata = fetch_json(acs_config["metadata_url"])
    labels_verified = verify_acs_labels(acs_config, metadata)
    public_endpoint, keyed_endpoint = build_acs_request(acs_config)
    acs_retrieved_at = utc_now()
    acs_data = fetch_json(keyed_endpoint)
    acs_indicators, acs_diag = parse_acs(acs_config, acs_data)
    all_indicators.extend(acs_indicators)

    acs_source = {
        "source_ref": "acs-2024-5year-profile",
        "source_agency": "U.S. Census Bureau",
        "source_name": acs_config["dataset"],
        "source_locator": acs_config["base_url"],
        "source_release_vintage": acs_config["vintage"],
        "observation_as_of_date": "2024",
        "retrieved_at": acs_retrieved_at,
        "byte_size": None,
        "sha256": None,
        "published_update_date": None,
        "limitations": [
            "2024 ACS 5-year Data Profile estimates summarize the 2020-2024 period and are not temporally equivalent to the current HRSA snapshot."
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
            "variable_labels_verified": labels_verified,
            "source_vintage": acs_config["vintage"],
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
        "source_retrieved_at": acs_retrieved_at,
        "source_vintage": acs_config["vintage"],
        "metadata_endpoint": acs_config["metadata_url"],
        "request_endpoint_excluding_api_key": public_endpoint,
        "variable_labels_verified": labels_verified,
        "api_key_recorded": False,
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
