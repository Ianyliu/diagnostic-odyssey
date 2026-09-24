import csv
import json
import os
import tempfile
import unittest
import urllib.error
from io import BytesIO
from pathlib import Path
from unittest.mock import MagicMock, patch

from analysis.local_context.pipeline import (
    ContractError,
    build_acs_request,
    canonical_json_fingerprint,
    download_file,
    fetch_json,
    parse_acs,
    sanitize_url,
    summarize_hrsa,
    verify_acs_metadata,
)

ROOT = Path(__file__).resolve().parents[3]
HRSA_CONFIG = json.loads((ROOT / "analysis/local_context/config/hrsa_hpsa_fields.v1.json").read_text())
ACS_CONFIG = json.loads((ROOT / "analysis/local_context/config/acs_2024_5year_variables.v1.json").read_text())


class FakeResponse:
    def __init__(self, payload: bytes, url: str = "https://example.test/source.csv", headers=None):
        self._stream = BytesIO(payload)
        self._url = url
        self.headers = headers or {}

    def read(self, size: int = -1):
        return self._stream.read(size)

    def geturl(self):
        return self._url

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        return False


class LocalContextPipelineTests(unittest.TestCase):
    def _write_hrsa(self, rows):
        handle = tempfile.NamedTemporaryFile("w", delete=False, newline="", encoding="utf-8")
        writer = csv.DictWriter(handle, fieldnames=HRSA_CONFIG["required_fields"])
        writer.writeheader()
        writer.writerows(rows)
        handle.close()
        self.addCleanup(lambda: os.unlink(handle.name))
        return Path(handle.name)

    def _hrsa_row(self, **overrides):
        field = HRSA_CONFIG["field_map"]
        row = {name: "" for name in HRSA_CONFIG["required_fields"]}
        row.update({
            field["hpsa_id"]: "H1",
            field["discipline"]: "Primary Care",
            field["designation_type"]: "Geographic HPSA",
            field["state_name"]: "West Virginia",
            field["state_fips"]: "54",
            field["county_name"]: "Example County",
            field["county_fips"]: "54001",
            field["status"]: "Designated",
            field["score"]: "17",
            field["rural_status"]: "Rural",
            field["designation_date"]: "01/01/2024",
            field["designation_update_date"]: "09/01/2026",
            field["warehouse_record_create_date"]: "09/20/2026",
        })
        row.update(overrides)
        return row

    def test_hrsa_status_filter_and_distinct_id_counting(self):
        field = HRSA_CONFIG["field_map"]
        rows = [
            self._hrsa_row(),
            self._hrsa_row(**{field["county_name"]: "Other County", field["county_fips"]: "54003"}),
            self._hrsa_row(**{field["hpsa_id"]: "H2", field["status"]: "Withdrawn"}),
        ]
        indicators, diagnostics = summarize_hrsa(self._write_hrsa(rows), HRSA_CONFIG, "primary_care")
        count = next(x for x in indicators if x["indicator_id"].endswith("designated-distinct-count"))
        self.assertEqual(count["value"], 1)
        self.assertEqual(diagnostics["duplicate_hpsa_id_count"], 1)
        self.assertEqual(diagnostics["rows_by_hpsa_status"]["Designated"], 2)

    def test_hrsa_designation_types_are_separate_and_not_summed_quantities(self):
        field = HRSA_CONFIG["field_map"]
        rows = [
            self._hrsa_row(),
            self._hrsa_row(**{
                field["hpsa_id"]: "H2",
                field["designation_type"]: "HPSA Population",
                field["score"]: "12",
            }),
        ]
        indicators, _ = summarize_hrsa(self._write_hrsa(rows), HRSA_CONFIG, "primary_care")
        type_counts = [x for x in indicators if ".designation-type." in x["indicator_id"]]
        self.assertEqual(sum(int(x["value"]) for x in type_counts), 2)
        allowed_families = (
            ".designated-distinct-count",
            ".designation-type.",
            ".max-score",
            ".rural-status.",
        )
        self.assertTrue(all(
            any(token in x["indicator_id"] for token in allowed_families)
            for x in indicators
        ))

    def test_hrsa_duplicate_conflict_fails(self):
        field = HRSA_CONFIG["field_map"]
        rows = [
            self._hrsa_row(),
            self._hrsa_row(**{field["score"]: "18"}),
        ]
        with self.assertRaises(ContractError):
            summarize_hrsa(self._write_hrsa(rows), HRSA_CONFIG, "primary_care")

    def test_hrsa_fips_54_requires_west_virginia_state_name(self):
        field = HRSA_CONFIG["field_map"]
        bad = self._hrsa_row(**{field["state_name"]: "Virginia"})
        with self.assertRaisesRegex(ContractError, "HRSA state mismatch"):
            summarize_hrsa(self._write_hrsa([bad]), HRSA_CONFIG, "primary_care")

    def test_unexpected_rural_status_suppresses_breakdown_and_is_diagnostic(self):
        field = HRSA_CONFIG["field_map"]
        row = self._hrsa_row(**{field["rural_status"]: "New Future Category"})
        indicators, diagnostics = summarize_hrsa(
            self._write_hrsa([row]), HRSA_CONFIG, "primary_care"
        )
        self.assertFalse(diagnostics["rural_status_breakdown_included"])
        self.assertEqual(
            diagnostics["unexpected_rural_status_values"], ["New Future Category"]
        )
        self.assertFalse(any(".rural-status." in x["indicator_id"] for x in indicators))

    def test_not_applicable_rural_status_is_preserved_not_collapsed_to_unknown(self):
        field = HRSA_CONFIG["field_map"]
        row = self._hrsa_row(**{field["rural_status"]: "Not Applicable"})
        indicators, diagnostics = summarize_hrsa(
            self._write_hrsa([row]), HRSA_CONFIG, "primary_care"
        )
        self.assertTrue(diagnostics["rural_status_breakdown_included"])
        not_applicable = next(
            x for x in indicators if x["indicator_id"].endswith("rural-status.not-applicable")
        )
        unknown = next(
            x for x in indicators if x["indicator_id"].endswith("rural-status.unknown")
        )
        self.assertEqual(not_applicable["value"], 1)
        self.assertEqual(unknown["value"], 0)

    def _realistic_acs_metadata(self):
        bulk = {"variables": {}}
        individual = {}
        for spec in ACS_CONFIG["variables"]:
            bulk["variables"][spec["estimate"]] = {
                "label": spec["expected_estimate_label"],
                "concept": "fixture concept",
                "predicateType": "float",
                "group": spec["estimate"].split("_")[0],
                "limit": 0,
                "attributes": ",".join([
                    spec["estimate_annotation"],
                    spec["moe"],
                    spec["moe_annotation"],
                ]),
            }
            individual[spec["moe"]] = {
                "name": spec["moe"],
                "label": spec["expected_moe_label"],
                "concept": "fixture concept",
                "predicateType": "float",
                "group": spec["moe"].split("_")[0],
                "limit": 0,
                "attributes": spec["moe_annotation"],
                "attribute of": spec["estimate"],
                "attribute type": "MARGIN_OF_ERROR",
            }
            individual[spec["estimate_annotation"]] = {
                "name": spec["estimate_annotation"],
                "label": spec["expected_estimate_annotation_label"],
                "concept": "fixture concept",
                "predicateType": "string",
                "group": spec["estimate"].split("_")[0],
                "limit": 0,
                "attribute of": spec["estimate"],
                "attribute type": "ANNOTATION",
            }
            individual[spec["moe_annotation"]] = {
                "name": spec["moe_annotation"],
                "label": spec["expected_moe_annotation_label"],
                "concept": "fixture concept",
                "predicateType": "string",
                "group": spec["estimate"].split("_")[0],
                "limit": 0,
                "attribute of": spec["expected_moe_annotation_attribute_of"],
                "attribute type": "ANNOTATION",
            }
        return bulk, individual

    def test_acs_real_bulk_shape_does_not_require_pm_top_level(self):
        bulk, individual = self._realistic_acs_metadata()
        for spec in ACS_CONFIG["variables"]:
            self.assertNotIn(spec["moe"], bulk["variables"])
        verified, contract = verify_acs_metadata(ACS_CONFIG, bulk, individual)
        self.assertEqual(len(verified), 4)
        self.assertEqual(len(contract["bulk_pe_records"]), 4)
        self.assertEqual(
            {(spec["estimate"], spec["moe"]) for spec in ACS_CONFIG["variables"]},
            {("DP03_0099PE", "DP03_0099PM"), ("DP04_0058PE", "DP04_0058PM"),
             ("DP02_0154PE", "DP02_0154PM"), ("DP03_0128PE", "DP03_0128PM")}
        )

    def test_acs_pe_label_drift_fails(self):
        bulk, individual = self._realistic_acs_metadata()
        bulk["variables"]["DP03_0099PE"]["label"] = "changed"
        with self.assertRaises(ContractError):
            verify_acs_metadata(ACS_CONFIG, bulk, individual)

    def test_acs_wrong_pm_relationship_fails(self):
        bulk, individual = self._realistic_acs_metadata()
        individual["DP03_0099PM"]["attribute of"] = "DP03_0001PE"
        with self.assertRaises(ContractError):
            verify_acs_metadata(ACS_CONFIG, bulk, individual)

    def test_acs_wrong_pm_label_fails(self):
        bulk, individual = self._realistic_acs_metadata()
        individual["DP03_0099PM"]["label"] = "changed"
        with self.assertRaises(ContractError):
            verify_acs_metadata(ACS_CONFIG, bulk, individual)

    def test_acs_missing_pm_from_pe_attributes_fails(self):
        bulk, individual = self._realistic_acs_metadata()
        bulk["variables"]["DP03_0099PE"]["attributes"] = "DP03_0099PEA,DP03_0099PMA"
        with self.assertRaises(ContractError):
            verify_acs_metadata(ACS_CONFIG, bulk, individual)

    def test_acs_wrong_annotation_relationship_fails(self):
        bulk, individual = self._realistic_acs_metadata()
        individual["DP03_0099PMA"]["attribute of"] = "DP03_0099PM"
        with self.assertRaises(ContractError):
            verify_acs_metadata(ACS_CONFIG, bulk, individual)

    def test_acs_pma_relationships_preserve_observed_asymmetry(self):
        bulk, individual = self._realistic_acs_metadata()
        verified, _ = verify_acs_metadata(ACS_CONFIG, bulk, individual)
        self.assertEqual(
            verified["wv.acs.uninsured_pct"]["moe_annotation_attribute_of"],
            "DP03_0099PE",
        )
        self.assertEqual(
            verified["wv.acs.no_vehicle_pct"]["moe_annotation_attribute_of"],
            "DP04_0058PM",
        )
        self.assertEqual(
            verified["wv.acs.broadband_pct"]["moe_annotation_attribute_of"],
            "DP02_0154PM",
        )
        self.assertEqual(
            verified["wv.acs.poverty_pct"]["moe_annotation_attribute_of"],
            "DP03_0128PE",
        )

    def test_acs_pm_annotation_attribute_is_required(self):
        bulk, individual = self._realistic_acs_metadata()
        individual["DP03_0099PM"]["attributes"] = ""
        with self.assertRaises(ContractError):
            verify_acs_metadata(ACS_CONFIG, bulk, individual)

    def test_canonical_json_hashing_is_deterministic_and_newline_bound(self):
        left = canonical_json_fingerprint({"b": 2, "a": [1, {"z": "x"}]})
        right = canonical_json_fingerprint({"a": [1, {"z": "x"}], "b": 2})
        self.assertEqual(left, right)
        self.assertGreater(left["byte_size"], 0)
        self.assertRegex(left["sha256"], r"^[a-f0-9]{64}$")

    def test_acs_fips_universes_and_native_90_percent_moe(self):
        variables = ["NAME"]
        row = ["West Virginia"]
        for i, spec in enumerate(ACS_CONFIG["variables"], start=1):
            variables.extend([spec["estimate"], spec["moe"], spec["estimate_annotation"], spec["moe_annotation"]])
            row.extend([str(10 + i), "0.5", "", ""])
        variables.append("state")
        row.append("54")
        indicators, diagnostics = parse_acs(ACS_CONFIG, [variables, row])
        self.assertEqual(diagnostics["geography_returned"]["state"], "54")
        self.assertEqual({x["universe"] for x in indicators},
                         {"Civilian noninstitutionalized population", "Occupied housing units", "Total households", "All people"})
        self.assertTrue(all(x["confidence_level"] == 0.90 for x in indicators))
        self.assertTrue(all(x["margin_of_error"] == 0.5 for x in indicators))

    def _valid_acs_response(self):
        variables = ["NAME"]
        row = ["West Virginia"]
        for i, spec in enumerate(ACS_CONFIG["variables"], start=1):
            variables.extend([
                spec["estimate"], spec["moe"],
                spec["estimate_annotation"], spec["moe_annotation"]
            ])
            row.extend([str(10 + i), "0.5", "", ""])
        variables.append("state")
        row.append("54")
        return variables, row

    def test_acs_present_blank_annotations_pass(self):
        variables, row = self._valid_acs_response()
        indicators, _ = parse_acs(ACS_CONFIG, [variables, row])
        self.assertEqual(len(indicators), 4)

    def test_acs_present_nonblank_annotation_fails(self):
        variables, row = self._valid_acs_response()
        annotation = ACS_CONFIG["variables"][0]["estimate_annotation"]
        row[variables.index(annotation)] = "N"
        with self.assertRaisesRegex(ContractError, "annotation/special-value"):
            parse_acs(ACS_CONFIG, [variables, row])

    def test_acs_missing_estimate_annotation_column_fails(self):
        variables, row = self._valid_acs_response()
        field = ACS_CONFIG["variables"][0]["estimate_annotation"]
        index = variables.index(field)
        variables.pop(index)
        row.pop(index)
        with self.assertRaisesRegex(ContractError, "missing required columns"):
            parse_acs(ACS_CONFIG, [variables, row])

    def test_acs_missing_moe_annotation_column_fails(self):
        variables, row = self._valid_acs_response()
        field = ACS_CONFIG["variables"][0]["moe_annotation"]
        index = variables.index(field)
        variables.pop(index)
        row.pop(index)
        with self.assertRaisesRegex(ContractError, "missing required columns"):
            parse_acs(ACS_CONFIG, [variables, row])

    def test_acs_wrong_geography_fails(self):
        variables, row = self._valid_acs_response()
        row[0] = "Virginia"
        with self.assertRaises(ContractError):
            parse_acs(ACS_CONFIG, [variables, row])

    def test_census_key_is_required_and_never_part_of_public_endpoint(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(ContractError, "CENSUS_API_KEY"):
                build_acs_request(ACS_CONFIG)
        with patch.dict(os.environ, {"CENSUS_API_KEY": "secret-value"}, clear=True):
            public, keyed = build_acs_request(ACS_CONFIG)
            self.assertNotIn("secret-value", public)
            self.assertIn("key=secret-value", keyed)


    def test_sanitize_url_redacts_api_key(self):
        url = "https://api.census.gov/data?get=NAME&key=secret123&for=state:54"
        safe = sanitize_url(url)
        self.assertNotIn("secret123", safe)
        self.assertIn("key=[REDACTED]", safe)

    def test_fetch_json_failure_never_exposes_api_key(self):
        keyed = "https://api.census.gov/data?get=NAME&key=super-secret"
        error = urllib.error.HTTPError(keyed, 400, "Bad Request", None, None)
        with patch("analysis.local_context.pipeline.urllib.request.urlopen", side_effect=error):
            with self.assertRaises(ContractError) as ctx:
                fetch_json(keyed, max_attempts=3, retry_delay_seconds=0)
        self.assertNotIn("super-secret", str(ctx.exception))
        self.assertIn("[REDACTED]", str(ctx.exception))

    def test_fetch_json_retries_transient_503_but_not_deterministic_400(self):
        transient = urllib.error.HTTPError(
            "https://example.test", 503, "Unavailable", None, None
        )
        response = FakeResponse(b'{"ok": true}')
        with patch(
            "analysis.local_context.pipeline.urllib.request.urlopen",
            side_effect=[transient, response],
        ) as mocked:
            self.assertEqual(
                fetch_json("https://example.test", retry_delay_seconds=0),
                {"ok": True},
            )
            self.assertEqual(mocked.call_count, 2)

        deterministic = urllib.error.HTTPError(
            "https://example.test", 404, "Not Found", None, None
        )
        with patch(
            "analysis.local_context.pipeline.urllib.request.urlopen",
            side_effect=deterministic,
        ) as mocked:
            with self.assertRaises(ContractError):
                fetch_json("https://example.test", retry_delay_seconds=0)
            self.assertEqual(mocked.call_count, 1)

    def test_hrsa_download_is_atomic_and_retries_transient_failure(self):
        transient = urllib.error.URLError("temporary")
        response = FakeResponse(b"header\nvalue\n")
        with tempfile.TemporaryDirectory() as tmpdir:
            destination = Path(tmpdir) / "source.csv"
            part = Path(tmpdir) / "source.csv.part"
            with patch(
                "analysis.local_context.pipeline.urllib.request.urlopen",
                side_effect=[transient, response],
            ) as mocked:
                metadata = download_file(
                    "https://example.test/source.csv",
                    destination,
                    retry_delay_seconds=0,
                )
            self.assertEqual(mocked.call_count, 2)
            self.assertTrue(destination.exists())
            self.assertFalse(part.exists())
            self.assertEqual(metadata["byte_size"], len(b"header\nvalue\n"))

    def test_hrsa_download_does_not_retry_deterministic_404_or_leave_part(self):
        error = urllib.error.HTTPError(
            "https://example.test/source.csv", 404, "Not Found", None, None
        )
        with tempfile.TemporaryDirectory() as tmpdir:
            destination = Path(tmpdir) / "source.csv"
            part = Path(tmpdir) / "source.csv.part"
            with patch(
                "analysis.local_context.pipeline.urllib.request.urlopen",
                side_effect=error,
            ) as mocked:
                with self.assertRaises(ContractError):
                    download_file(
                        "https://example.test/source.csv",
                        destination,
                        retry_delay_seconds=0,
                    )
            self.assertEqual(mocked.call_count, 1)
            self.assertFalse(destination.exists())
            self.assertFalse(part.exists())



if __name__ == "__main__":
    unittest.main()
