import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  canDisplayDistributionSummary,
  type Estimate
} from "@diagnostic-odyssey/contracts";
import {
  buildPlanningBrief,
  serializeBriefJson
} from "@diagnostic-odyssey/brief-core";
import { formatNativeValue } from "../src/data/formatEstimateValue.ts";

const source = (path: string) =>
  readFileSync(fileURLToPath(new URL(path, import.meta.url)), "utf8");

const estimate = (release_status: Estimate["release_status"]): Estimate => ({
  estimate_id: "synthetic-typical-range",
  measure_id: "gross-all-cause-spending-mean",
  label: "Mean annual all-cause medical spending per person",
  value: release_status === "not_released" ? null : 100,
  unit: "USD/person/year",
  interval_low: 80,
  interval_high: 120,
  interval_type: "95% t CI",
  denominator: "synthetic denominator",
  universe: "synthetic universe",
  system_boundary: "national descriptive burden",
  evidence_type: "survey_estimate",
  release_status,
  display_status: "analytical_artifact",
  source_ref: "meps-hc256-2024",
  artifact_version: "v1",
  allowed_interpretation: "descriptive",
  prohibited_interpretation: ["causal"],
  limitations: ["synthetic"],
  standard_error: 10,
  ci_degrees_of_freedom: 159,
  ci_df_source: "full PERSON / PERWT24F survey design",
  weighted_denominator: 1000,
  unweighted_n: 100,
  weight_variable: "PERWT24F",
  variance_stratum_variable: "VARSTR",
  variance_psu_variable: "VARPSU",
  source_locator: "HC-256",
  cohort_definition: "synthetic cohort",
  statistics_method: "Taylor linearization",
  distribution_summary: {
    summary_type: "survey_weighted_quantiles",
    source_variable: "TOTEXP24",
    p25: 25,
    p50: 50,
    p75: 75,
    unweighted_n: 100,
    weighted_denominator: 1000,
    weight_variable: "PERWT24F",
    variance_stratum_variable: "VARSTR",
    variance_psu_variable: "VARPSU",
    statistics_method: "survey::svyquantile qrule='math'",
    limitations: ["IQR is descriptive, not a confidence interval."]
  }
});

const context = {
  condition_id: "long-covid",
  cohort_id: "test",
  age_range: "18–64",
  evidence_year: 2024,
  geography_scope: "United States",
  local_context_id: null,
  severity_filter: null,
  artifact_version: "v1"
};

test("Typical Range presentation is conditional and preserves native units", () => {
  const released = estimate("reviewed_released");
  assert.equal(canDisplayDistributionSummary(released), true);
  assert.equal(formatNativeValue(released.distribution_summary!.p25, released.unit), "$25");

  const preliminary = estimate("preliminary");
  assert.equal(canDisplayDistributionSummary(preliminary), false);

  const component = source("../src/components/DistributionSummaryText.tsx");
  assert.match(component, /canDisplayDistributionSummary\(estimate\)/);
  assert.match(component, /Typical Range \(25th–75th percentile\)/);
  assert.match(component, /<strong>Median:<\/strong>/);
  assert.match(component, /formatNativeValue\(summary\.p25, estimate\.unit\)/);
});

test("Planning Brief JSON preserves a released valid DistributionSummary with its parent only", () => {
  const released = estimate("reviewed_released");
  const preliminary = {
    ...estimate("preliminary"),
    estimate_id: "preliminary-typical-range"
  };
  const brief = buildPlanningBrief({
    context,
    estimates: [released, preliminary],
    localContext: [],
    scenario: null,
    evidence: [],
    dataRequests: [],
    generatedAt: "2026-09-25T00:00:00Z"
  });

  assert.equal(brief.burden_findings.length, 1);
  assert.equal(brief.burden_findings[0]?.estimate_id, released.estimate_id);
  assert.deepEqual(
    brief.burden_findings[0]?.distribution_summary,
    released.distribution_summary
  );
  const json = serializeBriefJson(brief);
  assert.match(json, /"distribution_summary"/);
  assert.doesNotMatch(json, /preliminary-typical-range/);
});

test("Pilot source contains no empirical-range calibration indicator", () => {
  const pilot = source("../src/pages/PilotPage.tsx");
  assert.doesNotMatch(pilot, /inside (?:the )?(?:typical |empirical )?range/i);
  assert.doesNotMatch(pilot, /outside (?:the )?(?:typical |empirical )?range/i);
  assert.doesNotMatch(pilot, /empirically calibrated/i);
});
