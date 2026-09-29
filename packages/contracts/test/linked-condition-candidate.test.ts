import test from "node:test";
import assert from "node:assert/strict";
import {
  assertValidLinkedConditionCandidate,
  evaluateLinkedConditionPrecision,
  linkedConditionCandidateIds,
  linkedConditionCandidateSourceRefs,
  linkedConditionPrecisionReasonCodes,
  linkedConditionPrecisionReportingStatuses,
  linkedConditionPrecisionRuleVersion,
  linkedConditionPrecisionStatuses,
  validateLinkedConditionCandidateDiagnostics,
  validateLinkedConditionCandidateFile,
  validateLinkedConditionCandidateManifest
} from "../src/linked-condition-candidate.ts";

const support = (n = 100) => ({
  label: "support",
  unweighted_person_n: n,
  represented_strata_n: n === 0 ? 0 : Math.min(20, n),
  represented_stratum_psu_pairs_n: n === 0 ? 0 : Math.min(30, n + 1),
  represented_singleton_strata_n: n === 0 ? 0 : Math.min(5, n)
});

const unitFor = (id: string) =>
  id === "u09_linked_service_use_person_share" ? "proportion" as const : "encounters/person/year" as const;

const candidate = (
  id: string,
  overrides: Record<string, unknown> = {}
) => {
  const base = {
    candidate_id: id,
    label: "Candidate",
    unit: unitFor(id),
    value: 0.2,
    standard_error: 0.05,
    interval_low: 0.1,
    interval_high: 0.3,
    interval_type: "95% t CI (Taylor linearization)",
    unweighted_target_n: 100,
    unweighted_nonzero_person_n: 2,
    observed_qualifying_event_n: 3,
    weighted_denominator: 100,
    ci_degrees_of_freedom: 10,
    ci_df_source: "full PERSON / PERWT24F survey design",
    target_support: support(100),
    nonzero_support: support(2),
    relative_standard_error: 0.25,
    interval_width: 0.2,
    allowed_interpretation: "Descriptive only",
    prohibited_interpretation: ["causal"],
    limitations: ["candidate only"],
    weight_variable: "PERWT24F",
    variance_stratum_variable: "VARSTR",
    variance_psu_variable: "VARPSU",
    cohort_definition: "governed cohort",
    statistics_method: "Taylor linearization",
    source_refs: [...linkedConditionCandidateSourceRefs] as string[],
    ...overrides
  };
  return {...base, ...evaluateLinkedConditionPrecision(base)};
};

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
  schema_version: "2.0",
  artifact_family: "linked_condition_service_use_candidate",
  status: "preliminary-candidate-only",
  generated_at: "2026-09-29T00:00:00Z",
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

type CandidateFileFixture = ReturnType<typeof file>;

const candidateAt = (value: CandidateFileFixture, index: number) => {
  const item = value.candidates[index];
  assert.ok(item);
  return item;
};

const sourceRefAt = (index: number): string => {
  const sourceRef = linkedConditionCandidateSourceRefs[index];
  assert.ok(sourceRef);
  return sourceRef;
};

const manifest = () => ({
  schema_version: "2.0",
  artifact_family: "linked_condition_service_use_candidate",
  status: "preliminary-candidate-only",
  candidate_estimates_generated: true,
  automatic_release: false,
  runtime_eligible: false,
  runtime_selection_changed: false,
  reviewed_artifact_modified: false,
  precision_rule_version: "meps_hc_precision_v1",
  precision_rule_reviewed: true,
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
  schema_version: "2.0",
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
    unweighted_design_n: 200,
    variance_strata_n: 20,
    unique_varstr_varpsu_n: 40,
    minimum_psus_per_stratum: 2,
    maximum_psus_per_stratum: 2,
    psus_per_stratum_distribution: {n_psu_2: 20},
    true_or_represented_singleton_strata_n: 0,
    singleton_strata: [],
    survey_degf: 20
  },
  target_support: support(100),
  reconciliation: {
    expected: {
      target_n: 100,
      target_nonzero_person_n: 2,
      target_zero_person_n: 98,
      target_unique_events_n: 3,
      family_counts: familyCounts(),
      overall_unique_events_n: 3,
      multiplicity_n: 1,
      represented_strata_n: 20,
      represented_stratum_psu_pairs_n: 30,
      weighted_target_denominator: 100,
      weighted_target_denominator_tolerance: 0.001
    },
    actual: {
      target_n: 100,
      target_nonzero_person_n: 2,
      target_zero_person_n: 98,
      target_unique_events_n: 3,
      family_counts: familyCounts(),
      overall_unique_events_n: 3,
      multiplicity_n: 1,
      represented_strata_n: 20,
      represented_stratum_psu_pairs_n: 30,
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
  precision_governance: {
    rule_version: "meps_hc_precision_v1",
    rule_reviewed: true,
    product_release_eligible: false
  },
  scientific_guardrails: ["Descriptive only."]
});

const hasPath = (issues: {path: string}[], fragment: string) =>
  issues.some(issue => issue.path.includes(fragment));

test("valid schema-v2 exact six-record candidate package passes", () => {
  assert.deepEqual(validateLinkedConditionCandidateFile(file()), []);
  assert.deepEqual(validateLinkedConditionCandidateManifest(manifest()), []);
  assert.deepEqual(validateLinkedConditionCandidateDiagnostics(diagnostics()), []);
  assert.doesNotThrow(() => assertValidLinkedConditionCandidate(file(), manifest(), diagnostics()));
});

test("schema v2 rejects schema v1 and legacy reliability fields", () => {
  const oldVersion = file();
  oldVersion.schema_version = "1.0";
  assert.ok(hasPath(validateLinkedConditionCandidateFile(oldVersion), "schema_version"));

  const legacy = file();
  Object.assign(candidateAt(legacy, 0) as Record<string, unknown>, {
    reliability_status: "not_adjudicated",
    reliability_rule_version: null,
    release_eligible: false
  });
  const issues = validateLinkedConditionCandidateFile(legacy);
  assert.ok(hasPath(issues, "reliability_status"));
  assert.ok(hasPath(issues, "reliability_rule_version"));
  assert.ok(hasPath(issues, "release_eligible"));
});

test("independent TypeScript evaluator covers every governed status and reporting status", () => {
  const cases = [
    [candidate("u09_linked_service_use_encounters_mean"), "meps_precise", "reportable"],
    [candidate("u09_linked_service_use_encounters_mean", {relative_standard_error: 0.30}), "meps_questionable_precision", "reportable_with_caution"],
    [candidate("u09_linked_service_use_person_share", {relative_standard_error: 0.51, interval_high: 0.10}), "meps_low_percentage_exception", "reportable_with_caution"],
    [candidate("u09_linked_service_use_encounters_mean", {relative_standard_error: 0.51}), "meps_unstable_precision", "suppress_precision"],
    [candidate("u09_linked_service_use_encounters_mean", {unweighted_target_n: 59, target_support: support(59)}), "insufficient_sample", "suppress_insufficient_sample"],
    [zeroFamily("u09_linked_service_use_inpatient_encounters_mean"), "unsupported_zero", "suppress_unsupported_zero"],
    [candidate("u09_linked_service_use_encounters_mean", {relative_standard_error: null}), "review_required", "suppress_pending_review"]
  ] as const;

  for (const [value, status, reporting] of cases) {
    const result = evaluateLinkedConditionPrecision(value);
    assert.equal(result.precision_status, status);
    assert.equal(result.precision_reporting_status, reporting);
    assert.equal(result.product_release_eligible, false);
    assert.equal(result.precision_rule_version, linkedConditionPrecisionRuleVersion);
  }

  assert.equal(new Set(cases.map(([, status]) => status)).size, linkedConditionPrecisionStatuses.length);
  assert.equal(new Set(cases.map(([, , reporting]) => reporting)).size, linkedConditionPrecisionReportingStatuses.length);
});

test("precision reason codes are governed, unique, deterministic, and independently recomputed", () => {
  const value = file();
  const b = candidateAt(value, 1);
  const base = {...b, relative_standard_error: 0.30};
  Object.assign(b, evaluateLinkedConditionPrecision(base), {relative_standard_error: 0.30});
  assert.deepEqual(b.precision_reason_codes, ["rse_30_to_50"]);
  assert.deepEqual(validateLinkedConditionCandidateFile(value), []);

  b.precision_reason_codes = ["rse_30_to_50", "rse_30_to_50"];
  assert.ok(hasPath(validateLinkedConditionCandidateFile(value), "precision_reason_codes"));

  b.precision_reason_codes = ["precision_input_invalid", "rse_30_to_50"];
  assert.ok(hasPath(validateLinkedConditionCandidateFile(value), "precision_reason_codes"));

  (b.precision_reason_codes as unknown as string[]) = ["not_governed"];
  assert.ok(hasPath(validateLinkedConditionCandidateFile(value), "precision_reason_codes"));
  assert.deepEqual(
    linkedConditionPrecisionReasonCodes,
    [
      "sample_n_below_60",
      "rse_30_to_50",
      "rse_above_50",
      "low_percentage_exception",
      "zero_positive_support",
      "precision_input_invalid"
    ]
  );
});

test("serialized precision fields must exactly match independent TypeScript recomputation", () => {
  const value = file();
  const a = candidateAt(value, 0);
  a.precision_status = "meps_unstable_precision";
  assert.ok(validateLinkedConditionCandidateFile(value).some(issue =>
    issue.message.includes("independent meps_hc_precision_v1 recomputation")
  ));

  const value2 = file();
  const a2 = candidateAt(value2, 0);
  a2.precision_reason_codes = ["rse_above_50"];
  assert.ok(validateLinkedConditionCandidateFile(value2).some(issue =>
    issue.message.includes("independent meps_hc_precision_v1 recomputation")
  ));
});

test("attempts to authorize product release or use wrong rule version are rejected", () => {
  const value = file();
  (candidateAt(value, 0) as Record<string, unknown>).product_release_eligible = true;
  (candidateAt(value, 1) as Record<string, unknown>).precision_rule_version = "wrong";
  const issues = validateLinkedConditionCandidateFile(value);
  assert.ok(hasPath(issues, "product_release_eligible"));
  assert.ok(hasPath(issues, "precision_rule_version"));

  const m = manifest() as Record<string, unknown>;
  m.precision_rule_version = "wrong";
  assert.ok(hasPath(validateLinkedConditionCandidateManifest(m), "precision_rule_version"));

  const d = diagnostics();
  d.precision_governance.product_release_eligible = true;
  assert.ok(hasPath(validateLinkedConditionCandidateDiagnostics(d), "product_release_eligible"));
});

test("manifest and diagnostics require governed v2 precision metadata", () => {
  const m = manifest();
  m.precision_rule_reviewed = false;
  assert.ok(hasPath(validateLinkedConditionCandidateManifest(m), "precision_rule_reviewed"));

  const d = diagnostics();
  d.schema_version = "1.0";
  d.precision_governance.rule_reviewed = false;
  const issues = validateLinkedConditionCandidateDiagnostics(d);
  assert.ok(hasPath(issues, "schema_version"));
  assert.ok(hasPath(issues, "precision_governance.rule_reviewed"));
});

test("reviewed six real-data-shaped decisions are frozen in TypeScript", () => {
  const reviewed = [
    candidate("u09_linked_service_use_person_share", {
      unweighted_target_n: 380,
      target_support: support(380),
      value: 0.04796093404373186,
      standard_error: 0.01140890642074523,
      interval_high: 0.07049348101652217,
      relative_standard_error: 0.2378791541120182,
      unweighted_nonzero_person_n: 22,
      nonzero_support: support(22),
      observed_qualifying_event_n: 109
    }),
    candidate("u09_linked_service_use_encounters_mean", {
      unweighted_target_n: 380,
      target_support: support(380),
      value: 0.1973708941306436,
      standard_error: 0.06722129795093537,
      interval_high: 0.3301327030010547,
      relative_standard_error: 0.3405836420158299,
      unweighted_nonzero_person_n: 22,
      nonzero_support: support(22),
      observed_qualifying_event_n: 109
    }),
    candidate("u09_linked_service_use_office_encounters_mean", {
      unweighted_target_n: 380,
      target_support: support(380),
      value: 0.1562085830927701,
      standard_error: 0.05513049229600549,
      interval_high: 0.2650910965853873,
      relative_standard_error: 0.3529287008721169,
      unweighted_nonzero_person_n: 17,
      nonzero_support: support(17),
      observed_qualifying_event_n: 86
    }),
    candidate("u09_linked_service_use_outpatient_encounters_mean", {
      unweighted_target_n: 380,
      target_support: support(380),
      value: 0.03350284715268952,
      standard_error: 0.01902069550751614,
      interval_low: -0.004062954438858124,
      interval_high: 0.07106864874423717,
      relative_standard_error: 0.5677337039693717,
      unweighted_nonzero_person_n: 7,
      nonzero_support: support(7),
      observed_qualifying_event_n: 21
    }),
    candidate("u09_linked_service_use_emergency_encounters_mean", {
      unweighted_target_n: 380,
      target_support: support(380),
      value: 0.007659463885183907,
      standard_error: 0.006239326370914688,
      interval_low: -0.004663182067592815,
      interval_high: 0.01998210983796063,
      relative_standard_error: 0.8145904810627459,
      unweighted_nonzero_person_n: 2,
      nonzero_support: support(2),
      observed_qualifying_event_n: 2
    }),
    zeroFamily("u09_linked_service_use_inpatient_encounters_mean")
  ];

  const expected = [
    ["meps_precise", "reportable", []],
    ["meps_questionable_precision", "reportable_with_caution", ["rse_30_to_50"]],
    ["meps_questionable_precision", "reportable_with_caution", ["rse_30_to_50"]],
    ["meps_unstable_precision", "suppress_precision", ["rse_above_50"]],
    ["meps_unstable_precision", "suppress_precision", ["rse_above_50"]],
    ["unsupported_zero", "suppress_unsupported_zero", ["zero_positive_support"]]
  ] as const;

  reviewed.forEach((entry, index) => {
    const decision = evaluateLinkedConditionPrecision(entry);
    const expectedEntry = expected[index];
    assert.ok(expectedEntry);
    assert.equal(decision.precision_status, expectedEntry[0]);
    assert.equal(decision.precision_reporting_status, expectedEntry[1]);
    assert.deepEqual(decision.precision_reason_codes, expectedEntry[2]);
    assert.equal(decision.product_release_eligible, false);
  });
});

test("rejects six unique but wrong candidate IDs", () => {
  const value = file();
  value.candidates = value.candidates.map((entry, index) => ({...entry, candidate_id: `wrong-${index}`}));
  assert.ok(validateLinkedConditionCandidateFile(value).some(issue => issue.message.includes("governed candidate ID")));
});

test("rejects a duplicate governed candidate ID", () => {
  const value = file();
  value.candidates[5] = zeroFamily("u09_linked_service_use_emergency_encounters_mean");
  assert.ok(validateLinkedConditionCandidateFile(value).some(issue => issue.message.includes("governed candidate ID")));
});

test("rejects unexpected candidate-file and candidate-record properties", () => {
  const value = file() as ReturnType<typeof file> & {extra?: string};
  value.extra = "forbidden";
  (candidateAt(value, 0) as Record<string, unknown>).person_values = [1, 2, 3];
  const issues = validateLinkedConditionCandidateFile(value);
  assert.ok(hasPath(issues, "candidate_file.extra"));
  assert.ok(hasPath(issues, "person_values"));
});

test("rejects unexpected support and manifest properties", () => {
  const value = file();
  (candidateAt(value, 0).target_support as Record<string, unknown>).extra = 1;
  assert.ok(hasPath(validateLinkedConditionCandidateFile(value), "target_support.extra"));

  const m = manifest() as ReturnType<typeof manifest> & {extra?: string};
  m.extra = "forbidden";
  assert.ok(hasPath(validateLinkedConditionCandidateManifest(m), "candidate_manifest.extra"));
});

test("rejects incomplete, duplicate, or wrong source refs", () => {
  const missing = file();
  const missingCandidate = candidateAt(missing, 0);
  missingCandidate.source_refs = missingCandidate.source_refs.slice(0, -1);
  assert.ok(hasPath(validateLinkedConditionCandidateFile(missing), "source_refs"));

  const wrong = file();
  candidateAt(wrong, 0).source_refs = [...linkedConditionCandidateSourceRefs.slice(0, -1), "wrong-source"];
  assert.ok(hasPath(validateLinkedConditionCandidateFile(wrong), "source_refs"));

  const duplicate = file();
  candidateAt(duplicate, 0).source_refs = [
    ...linkedConditionCandidateSourceRefs.slice(0, -1),
    sourceRefAt(0)
  ];
  assert.ok(hasPath(validateLinkedConditionCandidateFile(duplicate), "source_refs"));
});

test("rejects wrong units and support inconsistencies", () => {
  const wrongA = file();
  candidateAt(wrongA, 0).unit = "encounters/person/year";
  assert.ok(hasPath(validateLinkedConditionCandidateFile(wrongA), ".unit"));

  const targetMismatch = file();
  candidateAt(targetMismatch, 0).target_support.unweighted_person_n = 99;
  assert.ok(hasPath(validateLinkedConditionCandidateFile(targetMismatch), "target_support.unweighted_person_n"));

  const zeroMismatch = file();
  candidateAt(zeroMismatch, 5).nonzero_support.represented_strata_n = 1;
  assert.ok(hasPath(validateLinkedConditionCandidateFile(zeroMismatch), "nonzero_support.represented_strata_n"));
});

test("retains A/B/C event, denominator, and support reconciliation", () => {
  const eventMismatch = file();
  candidateAt(eventMismatch, 1).observed_qualifying_event_n = 4;
  candidateAt(eventMismatch, 0).observed_qualifying_event_n = 4;
  assert.ok(validateLinkedConditionCandidateFile(eventMismatch).some(issue => issue.message.includes("sum of Candidate C")));

  const abMismatch = file();
  candidateAt(abMismatch, 1).unweighted_nonzero_person_n = 1;
  candidateAt(abMismatch, 1).nonzero_support = support(1);
  assert.ok(validateLinkedConditionCandidateFile(abMismatch).some(issue => issue.message.includes("Candidate A and B")));

  const denominatorMismatch = file();
  candidateAt(denominatorMismatch, 3).weighted_denominator = 99;
  assert.ok(validateLinkedConditionCandidateFile(denominatorMismatch).some(issue => issue.message.includes("must match")));
});

test("retains provenance and forbidden-identifier protections", () => {
  const m = manifest();
  m.code_commit = "different";
  assert.throws(() => assertValidLinkedConditionCandidate(file(), m, diagnostics()), /candidate_file\.code_commit/);

  const d = diagnostics();
  d.code_commit = "different";
  assert.throws(() => assertValidLinkedConditionCandidate(file(), manifest(), d), /diagnostics\.code_commit/);

  const value = file() as ReturnType<typeof file> & {DUPERSID?: string[]};
  value.DUPERSID = ["P1"];
  assert.ok(hasPath(validateLinkedConditionCandidateFile(value), "DUPERSID"));

  const diag = diagnostics();
  (diag.linkage_quality as Record<string, unknown>).CONDIDX = ["C1"];
  assert.ok(hasPath(validateLinkedConditionCandidateDiagnostics(diag), "CONDIDX"));
});

test("governed vocabularies are exact", () => {
  assert.deepEqual([...linkedConditionCandidateIds], [
    "u09_linked_service_use_person_share",
    "u09_linked_service_use_encounters_mean",
    "u09_linked_service_use_office_encounters_mean",
    "u09_linked_service_use_outpatient_encounters_mean",
    "u09_linked_service_use_emergency_encounters_mean",
    "u09_linked_service_use_inpatient_encounters_mean"
  ]);
  assert.equal(linkedConditionPrecisionRuleVersion, "meps_hc_precision_v1");
});
