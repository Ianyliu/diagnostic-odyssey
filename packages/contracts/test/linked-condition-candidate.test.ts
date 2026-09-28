import test from "node:test";
import assert from "node:assert/strict";
import {
  assertValidLinkedConditionCandidate,
  linkedConditionCandidateSourceRefs,
  validateLinkedConditionCandidateDiagnostics,
  validateLinkedConditionCandidateFile,
  validateLinkedConditionCandidateManifest
} from "./linked-condition-candidate.ts";

const support = (n = 4) => ({
  label: "support",
  unweighted_person_n: n,
  represented_strata_n: n === 0 ? 0 : Math.min(2, n),
  represented_stratum_psu_pairs_n: n === 0 ? 0 : Math.min(3, n + 1),
  represented_singleton_strata_n: n === 0 ? 0 : 1
});

const unitFor = (id: string) =>
  id === "u09_linked_service_use_person_share" ? "proportion" : "encounters/person/year";

const candidate = (
  id: string,
  overrides: Record<string, unknown> = {}
) => ({
  candidate_id: id,
  label: "Candidate",
  unit: unitFor(id),
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
  relative_standard_error: 0.25,
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
  source_refs: [...linkedConditionCandidateSourceRefs],
  ...overrides
});

const zeroFamily = (id: string) => candidate(id, {
  value: 0,
  standard_error: 0,
  interval_low: 0,
  interval_high: 0,
  unweighted_nonzero_person_n: 0,
  observed_qualifying_event_n: 0,
  nonzero_support: support(0),
  relative_standard_error: null,
  interval_width: 0
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
    candidate("u09_linked_service_use_office_encounters_mean", {
      observed_qualifying_event_n: 2,
      unweighted_nonzero_person_n: 2,
      nonzero_support: support(2)
    }),
    candidate("u09_linked_service_use_outpatient_encounters_mean", {
      observed_qualifying_event_n: 1,
      unweighted_nonzero_person_n: 1,
      nonzero_support: support(1)
    }),
    zeroFamily("u09_linked_service_use_emergency_encounters_mean"),
    zeroFamily("u09_linked_service_use_inpatient_encounters_mean")
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

const familyCounts = () => ({office: 2, outpatient: 1, emergency: 0, inpatient: 0});

const diagnostics = () => ({
  status: "preliminary-candidate-only",
  code_commit: "abc",
  github_sha: null,
  code_commit_matches_github_sha: null,
  design_integrity: {
    target_missing_varstr_n: 0,
    target_missing_varpsu_n: 0,
    target_missing_or_nonpositive_perwt24f_n: 0,
    target_excluded_from_full_person_design_n: 0,
    target_domain_membership_exact: true
  },
  full_person_design: {
    label: "full PERSON / PERWT24F survey design",
    weight_variable: "PERWT24F",
    unweighted_design_n: 8,
    variance_strata_n: 2,
    unique_varstr_varpsu_n: 4,
    minimum_psus_per_stratum: 2,
    maximum_psus_per_stratum: 2,
    psus_per_stratum_distribution: {n_psu_2: 2},
    true_or_represented_singleton_strata_n: 0,
    singleton_strata: [],
    survey_degf: 2
  },
  target_support: support(4),
  reconciliation: {
    expected: {
      target_n: 4,
      target_nonzero_person_n: 2,
      target_zero_person_n: 2,
      target_unique_events_n: 3,
      family_counts: familyCounts(),
      overall_unique_events_n: 3,
      multiplicity_n: 1,
      represented_strata_n: 2,
      represented_stratum_psu_pairs_n: 3,
      weighted_target_denominator: 100,
      weighted_target_denominator_tolerance: 0.001
    },
    actual: {
      target_n: 4,
      target_nonzero_person_n: 2,
      target_zero_person_n: 2,
      target_unique_events_n: 3,
      family_counts: familyCounts(),
      overall_unique_events_n: 3,
      multiplicity_n: 1,
      represented_strata_n: 2,
      represented_stratum_psu_pairs_n: 3,
      weighted_target_denominator: 100
    },
    passed: true
  },
  linkage_quality: {
    unmatched_condidx_n: 0,
    condidx_person_mismatch_n: 0,
    unmatched_evntidx_n: 0,
    event_family_mismatch_n: 0,
    duplicate_clnkidx_n: 0,
    duplicate_condition_event_pair_n: 0,
    clnkidx_composition_mismatch_n: 0,
    unsupported_eventype_n: 0,
    unsupported_eventype_values: []
  },
  reliability: {
    status: "not_adjudicated",
    rule_version: null,
    rule_reviewed: false,
    release_eligible: false
  },
  scientific_guardrails: ["Descriptive only."]
});

const hasPath = (issues: {path: string}[], fragment: string) =>
  issues.some(issue => issue.path.includes(fragment));

test("valid exact six-record candidate package permits nullable inpatient RSE and zero support", () => {
  assert.deepEqual(validateLinkedConditionCandidateFile(file()), []);
  assert.deepEqual(validateLinkedConditionCandidateManifest(manifest()), []);
  assert.deepEqual(validateLinkedConditionCandidateDiagnostics(diagnostics()), []);
  assert.doesNotThrow(() => assertValidLinkedConditionCandidate(file(), manifest(), diagnostics()));
});

test("rejects six unique but wrong candidate IDs", () => {
  const value = file();
  value.candidates = value.candidates.map((entry, index) => ({...entry, candidate_id: `wrong-${index}`}));
  assert.ok(validateLinkedConditionCandidateFile(value).some(issue => issue.message.includes("governed candidate ID")));
});

test("rejects a missing governed candidate ID", () => {
  const value = file();
  value.candidates[5] = candidate("wrong-id");
  assert.ok(validateLinkedConditionCandidateFile(value).some(issue => issue.message.includes("governed candidate ID")));
});

test("rejects a duplicate governed candidate ID", () => {
  const value = file();
  value.candidates[5] = zeroFamily("u09_linked_service_use_emergency_encounters_mean");
  assert.ok(validateLinkedConditionCandidateFile(value).some(issue => issue.message.includes("governed candidate ID")));
});

test("rejects unexpected candidate-file top-level property", () => {
  const value = file() as ReturnType<typeof file> & {extra?: string};
  value.extra = "forbidden";
  assert.ok(hasPath(validateLinkedConditionCandidateFile(value), "candidate_file.extra"));
});

test("rejects unexpected candidate-record property and arbitrary person_values array", () => {
  const value = file();
  (value.candidates[0] as Record<string, unknown>).person_values = [1, 2, 3];
  assert.ok(hasPath(validateLinkedConditionCandidateFile(value), "person_values"));
});

test("rejects unexpected support-object property", () => {
  const value = file();
  (value.candidates[0].target_support as Record<string, unknown>).extra = 1;
  assert.ok(hasPath(validateLinkedConditionCandidateFile(value), "target_support.extra"));
});

test("rejects unexpected manifest property", () => {
  const value = manifest() as ReturnType<typeof manifest> & {extra?: string};
  value.extra = "forbidden";
  assert.ok(hasPath(validateLinkedConditionCandidateManifest(value), "candidate_manifest.extra"));
});

test("rejects incomplete, duplicate, or wrong source refs", () => {
  const missing = file();
  missing.candidates[0].source_refs = missing.candidates[0].source_refs.slice(0, -1);
  assert.ok(hasPath(validateLinkedConditionCandidateFile(missing), "source_refs"));

  const wrong = file();
  wrong.candidates[0].source_refs = [...linkedConditionCandidateSourceRefs.slice(0, -1), "wrong-source"];
  assert.ok(hasPath(validateLinkedConditionCandidateFile(wrong), "source_refs"));

  const duplicate = file();
  duplicate.candidates[0].source_refs = [...linkedConditionCandidateSourceRefs.slice(0, -1), linkedConditionCandidateSourceRefs[0]];
  assert.ok(hasPath(validateLinkedConditionCandidateFile(duplicate), "source_refs"));
});

test("rejects wrong unit for Candidate A", () => {
  const value = file();
  value.candidates[0].unit = "encounters/person/year";
  assert.ok(hasPath(validateLinkedConditionCandidateFile(value), ".unit"));
});

test("rejects wrong unit for Candidate B or C", () => {
  const value = file();
  value.candidates[1].unit = "proportion";
  assert.ok(hasPath(validateLinkedConditionCandidateFile(value), ".unit"));
});

test("rejects target-support N mismatch", () => {
  const value = file();
  value.candidates[0].target_support.unweighted_person_n = 3;
  assert.ok(hasPath(validateLinkedConditionCandidateFile(value), "target_support.unweighted_person_n"));
});

test("rejects nonzero-support N mismatch", () => {
  const value = file();
  value.candidates[0].nonzero_support.unweighted_person_n = 1;
  assert.ok(hasPath(validateLinkedConditionCandidateFile(value), "nonzero_support.unweighted_person_n"));
});

test("rejects zero-person support with nonzero representation", () => {
  const value = file();
  value.candidates[5].nonzero_support.represented_strata_n = 1;
  assert.ok(hasPath(validateLinkedConditionCandidateFile(value), "nonzero_support.represented_strata_n"));
});

test("rejects nonzero representation exceeding target representation", () => {
  const value = file();
  value.candidates[2].nonzero_support.represented_stratum_psu_pairs_n = 4;
  assert.ok(hasPath(validateLinkedConditionCandidateFile(value), "nonzero_support.represented_stratum_psu_pairs_n"));
});

test("rejects Candidate B event count that does not equal summed C family counts", () => {
  const value = file();
  value.candidates[1].observed_qualifying_event_n = 4;
  value.candidates[0].observed_qualifying_event_n = 4;
  assert.ok(validateLinkedConditionCandidateFile(value).some(issue => issue.message.includes("sum of Candidate C")));
});

test("rejects Candidate A/B nonzero-person inconsistency", () => {
  const value = file();
  value.candidates[1].unweighted_nonzero_person_n = 1;
  value.candidates[1].nonzero_support = support(1);
  assert.ok(validateLinkedConditionCandidateFile(value).some(issue => issue.message.includes("Candidate A and B")));
});

test("rejects cross-candidate target denominator or support inconsistency", () => {
  const value = file();
  value.candidates[3].weighted_denominator = 99;
  value.candidates[4].target_support.represented_strata_n = 1;
  const issues = validateLinkedConditionCandidateFile(value);
  assert.ok(issues.some(issue => issue.message.includes("must match")));
  assert.ok(issues.some(issue => issue.message.includes("target-support counts")));
});

test("rejects candidate/manifest code-commit mismatch", () => {
  const m = manifest();
  m.code_commit = "different";
  assert.throws(() => assertValidLinkedConditionCandidate(file(), m, diagnostics()), /candidate_file\.code_commit/);
});

test("requires non-null manifest github_sha to match candidate code commit", () => {
  const m = manifest();
  m.github_sha = "different";
  m.code_commit_matches_github_sha = true;
  assert.throws(() => assertValidLinkedConditionCandidate(file(), m, diagnostics()), /github_sha/);
});

test("rejects diagnostics unexpected top-level property", () => {
  const value = diagnostics() as ReturnType<typeof diagnostics> & {extra?: string};
  value.extra = "forbidden";
  assert.ok(hasPath(validateLinkedConditionCandidateDiagnostics(value), "diagnostics.extra"));
});

test("rejects diagnostics arbitrary row-level object array", () => {
  const value = diagnostics() as ReturnType<typeof diagnostics> & {person_rows?: object[]};
  value.person_rows = [{value: 1}];
  assert.ok(hasPath(validateLinkedConditionCandidateDiagnostics(value), "diagnostics.person_rows"));
});

test("rejects diagnostics forbidden identifier key", () => {
  const value = diagnostics();
  (value.linkage_quality as Record<string, unknown>).DUPERSID = ["P1"];
  assert.ok(hasPath(validateLinkedConditionCandidateDiagnostics(value), "DUPERSID"));
});

test("rejects diagnostics nested unknown properties", () => {
  const value = diagnostics();
  (value.reliability as Record<string, unknown>).person_values = [1];
  assert.ok(hasPath(validateLinkedConditionCandidateDiagnostics(value), "reliability.person_values"));
});

test("rejects diagnostics provenance mismatch with candidate and manifest", () => {
  const d = diagnostics();
  d.code_commit = "different";
  assert.throws(() => assertValidLinkedConditionCandidate(file(), manifest(), d), /diagnostics\.code_commit/);
});

test("rejects release eligibility and reliability adjudication", () => {
  const value = file();
  value.candidates[0].release_eligible = true;
  value.candidates[0].reliability_status = "reliable";
  assert.ok(validateLinkedConditionCandidateFile(value).length >= 2);
});

test("rejects respondent/event identifier fields in candidate package", () => {
  const value = file() as ReturnType<typeof file> & {DUPERSID?: string[]};
  value.DUPERSID = ["P1"];
  assert.ok(hasPath(validateLinkedConditionCandidateFile(value), "DUPERSID"));
});