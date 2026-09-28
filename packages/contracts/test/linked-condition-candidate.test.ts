import test from "node:test";
import assert from "node:assert/strict";
import {
  validateLinkedConditionCandidateFile,
  validateLinkedConditionCandidateManifest
} from "../src/linked-condition-candidate.ts";

const support = (n = 4) => ({
  label: "support",
  unweighted_person_n: n,
  represented_strata_n: n === 0 ? 0 : 2,
  represented_stratum_psu_pairs_n: n === 0 ? 0 : 3,
  represented_singleton_strata_n: n === 0 ? 0 : 1
});

const candidate = (id: string, rse: number | null = 0.25) => ({
  candidate_id: id,
  label: "Candidate",
  unit: "encounters/person/year",
  value: 0.2,
  standard_error: 0.05,
  interval_low: 0.1,
  interval_high: 0.3,
  interval_type: "95% t CI (Taylor linearization)",
  unweighted_target_n: 4,
  unweighted_nonzero_person_n: 2,
  observed_qualifying_event_n: 3,
  weighted_denominator: 100,
  ci_degrees_of_freedom: 10,
  ci_df_source: "full PERSON / PERWT24F survey design",
  target_support: support(4),
  nonzero_support: support(2),
  relative_standard_error: rse,
  interval_width: 0.2,
  reliability_status: "not_adjudicated",
  reliability_rule_version: null,
  release_eligible: false,
  allowed_interpretation: "Descriptive only",
  prohibited_interpretation: ["causal"],
  limitations: ["candidate only"],
  weight_variable: "PERWT24F",
  variance_stratum_variable: "VARSTR",
  variance_psu_variable: "VARPSU",
  cohort_definition: "governed cohort",
  statistics_method: "Taylor linearization",
  source_refs: ["meps-hc256-2024", "meps-hc255-2024"]
});

const file = () => ({
  schema_version: "1.0",
  artifact_family: "linked_condition_service_use_candidate",
  status: "preliminary-candidate-only",
  generated_at: "2026-09-28T00:00:00Z",
  code_commit: "abc",
  candidates: [
    candidate("u09_linked_service_use_person_share"),
    candidate("u09_linked_service_use_encounters_mean"),
    candidate("u09_linked_service_use_office_encounters_mean"),
    candidate("u09_linked_service_use_outpatient_encounters_mean"),
    candidate("u09_linked_service_use_emergency_encounters_mean"),
    {...candidate("u09_linked_service_use_inpatient_encounters_mean", null), value: 0, standard_error: 0, interval_low: 0, interval_high: 0, unweighted_nonzero_person_n: 0, observed_qualifying_event_n: 0, nonzero_support: support(0)}
  ]
});

const manifest = () => ({
  schema_version: "1.0",
  artifact_family: "linked_condition_service_use_candidate",
  status: "preliminary-candidate-only",
  candidate_estimates_generated: true,
  automatic_release: false,
  runtime_eligible: false,
  runtime_selection_changed: false,
  reviewed_artifact_modified: false,
  reliability_rule_reviewed: false,
  code_commit: "abc",
  github_sha: null,
  code_commit_matches_github_sha: null,
  estimates_file: "linked-condition-candidate-estimates.json",
  diagnostics_file: "diagnostics.json",
  hc256_source_metadata_file: "hc256-source-metadata.json",
  linked_condition_source_metadata_file: "linked-condition-source-metadata.json"
});

test("linked-condition candidate contract permits structural null RSE", () => {
  assert.deepEqual(validateLinkedConditionCandidateFile(file()), []);
  assert.deepEqual(validateLinkedConditionCandidateManifest(manifest()), []);
});

test("linked-condition candidate contract rejects release eligibility and reliability adjudication", () => {
  const value = file();
  value.candidates[0].release_eligible = true;
  value.candidates[0].reliability_status = "reliable";
  assert.ok(validateLinkedConditionCandidateFile(value).length >= 2);
});

test("linked-condition candidate contract rejects respondent/event identifier fields", () => {
  const value = file() as ReturnType<typeof file> & {DUPERSID?: string[]};
  value.DUPERSID = ["P1"];
  assert.ok(validateLinkedConditionCandidateFile(value).some(issue => issue.path.includes("DUPERSID")));
});
