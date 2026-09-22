import assert from "node:assert/strict";
import test from "node:test";
import {
  canExportEstimate,
  validateArtifactBundle,
  validateEstimate,
  validateScenario,
  type Estimate
} from "../src/index.ts";

test("suppressed values cannot carry a numeric value", () => {
  const issues = validateEstimate({
    estimate_id: "e1",
    measure_id: "m1",
    label: "Suppressed",
    value: 5,
    unit: "people",
    interval_low: null,
    interval_high: null,
    interval_type: null,
    denominator: "adults",
    universe: "US adults",
    system_boundary: "national survey",
    evidence_type: "survey_estimate",
    release_status: "suppressed",
    display_status: "analytical_artifact",
    source_ref: "src",
    artifact_version: "v1",
    allowed_interpretation: "none",
    prohibited_interpretation: [],
    limitations: []
  });
  assert.ok(issues.some(issue => issue.path.endsWith(".value")));
});

test("scenario reach is a proportion", () => {
  const issues = validateScenario({
    scenario_id: "s",
    eligible_population: 100,
    reach: 25,
    capacity: 25,
    baseline_window_months: 12,
    alternative_window_months: 6,
    horizon_months: 12,
    fixed_cost: 10,
    per_participant_cost: 1,
    target_pathway_step: "recognition",
    mechanism: "navigation",
    assumption_refs: [],
    artifact_version: "v1"
  });
  assert.ok(issues.some(issue => issue.path.endsWith(".reach")));
});

test("only reviewed analytical estimates are exportable", () => {
  const base: Estimate = {
    estimate_id: "e",
    measure_id: "m",
    label: "Estimate",
    value: 1,
    unit: "people",
    interval_low: 0.5,
    interval_high: 1.5,
    interval_type: "95% CI",
    denominator: "adults",
    universe: "US adults",
    system_boundary: "national",
    evidence_type: "survey_estimate",
    release_status: "reviewed_released",
    display_status: "analytical_artifact",
    source_ref: "src",
    artifact_version: "v1",
    allowed_interpretation: "descriptive",
    prohibited_interpretation: [],
    limitations: []
  };
  assert.equal(canExportEstimate(base), true);
  assert.equal(canExportEstimate({ ...base, display_status: "illustrative" }), false);
});


test("numeric analytical artifacts require survey provenance", () => {
  const issues = validateEstimate({
    estimate_id: "candidate",
    measure_id: "gross-spending",
    label: "Candidate",
    value: 123,
    unit: "USD/year",
    interval_low: 100,
    interval_high: 150,
    interval_type: "95% CI",
    denominator: "cohort",
    universe: "national",
    system_boundary: "gross all-cause spending",
    evidence_type: "survey_estimate",
    release_status: "preliminary",
    display_status: "analytical_artifact",
    source_ref: "meps-hc256-2024",
    artifact_version: "candidate-v1",
    allowed_interpretation: "descriptive",
    prohibited_interpretation: [],
    limitations: []
  });
  assert.ok(issues.some(issue => issue.path.endsWith(".weight_variable")));
  assert.ok(issues.some(issue => issue.path.endsWith(".source_locator")));
  assert.ok(issues.some(issue => issue.path.endsWith(".unweighted_n")));
  assert.ok(issues.some(issue => issue.path.endsWith(".ci_df_source")));
  assert.ok(issues.some(issue => issue.path.endsWith(".ci_degrees_of_freedom")));
});

test("preliminary analytical estimate with provenance validates but is not exportable", () => {
  const estimate: Estimate = {
    estimate_id: "candidate",
    measure_id: "gross-spending",
    label: "Candidate",
    value: 123,
    unit: "USD/year",
    interval_low: 100,
    interval_high: 150,
    interval_type: "95% t CI",
    denominator: "cohort",
    universe: "national",
    system_boundary: "gross all-cause spending",
    evidence_type: "survey_estimate",
    release_status: "preliminary",
    display_status: "analytical_artifact",
    source_ref: "meps-hc256-2024",
    artifact_version: "candidate-v1",
    allowed_interpretation: "descriptive",
    prohibited_interpretation: [],
    limitations: [],
    standard_error: 10,
    ci_degrees_of_freedom: 159,
    ci_df_source: "full PERSON / PERWT24F survey design",
    weighted_denominator: 1000,
    unweighted_n: 100,
    weight_variable: "PERWT24F",
    variance_stratum_variable: "VARSTR",
    variance_psu_variable: "VARPSU",
    source_locator: "HC-256 codebook",
    cohort_definition: "reviewed operational cohort",
    statistics_method: "Taylor linearization"
  };
  assert.deepEqual(validateEstimate(estimate), []);
  assert.equal(canExportEstimate(estimate), false);
});


test("artifact runtime validation requires bundle-level provenance", () => {
  const issues = validateArtifactBundle({
    manifest: {
      artifact_version: "candidate-v1",
      generated_at: "",
      code_commit: "",
      run_id: "",
      dataset_releases: [],
      display_status: "analytical_artifact"
    },
    context: {
      condition_id: "long-covid-current",
      cohort_id: "current-long-covid-adults-18-64-meps-2024",
      age_range: "18-64",
      evidence_year: 2024,
      geography_scope: "United States",
      local_context_id: null,
      severity_filter: null,
      artifact_version: "candidate-v1"
    },
    burden_domains: [],
    evidence: [],
    local_context: [],
    qualitative_evidence: [],
    scenario_examples: [],
    data_requests: [],
    sources: []
  });
  assert.ok(issues.some(issue => issue.path === "artifact.manifest.generated_at"));
  assert.ok(issues.some(issue => issue.path === "artifact.manifest.code_commit"));
  assert.ok(issues.some(issue => issue.path === "artifact.manifest.dataset_releases"));
  assert.ok(issues.some(issue => issue.path === "artifact.sources"));
});
