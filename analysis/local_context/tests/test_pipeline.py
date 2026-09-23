import csv
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from analysis.local_context.pipeline import (
    ContractError,
    build_acs_request,
    parse_acs,
    summarize_hrsa,
    verify_acs_labels,
)

ROOT = Path(__file__).resolve().parents[3]
HRSA_CONFIG = json.loads((ROOT / "analysis/local_context/config/hrsa_hpsa_fields.v1.json").read_text())
ACS_CONFIG = json.loads((ROOT / "analysis/local_context/config/acs_2024_5year_variables.v1.json").read_text())


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

    def test_acs_variable_ids_labels_and_percent_moe_pairing(self):
        metadata = {"variables": {}}
        for spec in ACS_CONFIG["variables"]:
            metadata["variables"][spec["estimate"]] = {"label": spec["expected_estimate_label"]}
            metadata["variables"][spec["moe"]] = {"label": spec["expected_moe_label"]}
        verified = verify_acs_labels(ACS_CONFIG, metadata)
        self.assertEqual(len(verified), 4)
        self.assertEqual(
            {(spec["estimate"], spec["moe"]) for spec in ACS_CONFIG["variables"]},
            {("DP03_0099PE", "DP03_0099PM"), ("DP04_0058PE", "DP04_0058PM"),
             ("DP02_0154PE", "DP02_0154PM"), ("DP03_0128PE", "DP03_0128PM")}
        )

    def test_acs_label_drift_fails(self):
        metadata = {"variables": {}}
        for spec in ACS_CONFIG["variables"]:
            metadata["variables"][spec["estimate"]] = {"label": spec["expected_estimate_label"]}
            metadata["variables"][spec["moe"]] = {"label": spec["expected_moe_label"]}
        metadata["variables"]["DP03_0099PE"]["label"] = "changed"
        with self.assertRaises(ContractError):
            verify_acs_labels(ACS_CONFIG, metadata)

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
                         {"Civilian noninstitutionalized population", "Occupied housing units", "Households", "All people"})
        self.assertTrue(all(x["confidence_level"] == 0.90 for x in indicators))
        self.assertTrue(all(x["margin_of_error"] == 0.5 for x in indicators))

    def test_acs_annotation_and_wrong_geography_fail(self):
        variables = ["NAME"]
        row = ["West Virginia"]
        for i, spec in enumerate(ACS_CONFIG["variables"], start=1):
            variables.extend([spec["estimate"], spec["moe"], spec["estimate_annotation"], spec["moe_annotation"]])
            row.extend([str(10 + i), "0.5", "N", ""])
        variables.append("state")
        row.append("54")
        with self.assertRaises(ContractError):
            parse_acs(ACS_CONFIG, [variables, row])
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


if __name__ == "__main__":
    unittest.main()
