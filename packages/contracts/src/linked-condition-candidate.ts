export type LinkedConditionReliabilityStatus = "not_adjudicated";

export interface LinkedConditionSupport {
  label: string;
  unweighted_person_n: number;
  represented_strata_n: number;
  represented_stratum_psu_pairs_n: number;
  represented_singleton_strata_n: number;
}

export interface LinkedConditionCandidateEstimate {
  candidate_id: string;
  label: string;
  unit: string;
  value: number;
  standard_error: number;
  interval_low: number;
  interval_high: number;
  interval_type: string;
  unweighted_target_n: number;
  unweighted_nonzero_person_n: number;
  observed_qualifying_event_n: number;
  weighted_denominator: number;
  ci_degrees_of_freedom: number;
  ci_df_source: string;
  target_support: LinkedConditionSupport;
  nonzero_support: LinkedConditionSupport;
  relative_standard_error: number | null;
  interval_width: number | null;
  reliability_status: LinkedConditionReliabilityStatus;
  reliability_rule_version: string | null;
  release_eligible: false;
  allowed_interpretation: string;
  prohibited_interpretation: string[];
  limitations: string[];
  weight_variable: "PERWT24F";
  variance_stratum_variable: "VARSTR";
  variance_psu_variable: "VARPSU";
  cohort_definition: string;
  statistics_method: string;
  source_refs: string[];
}

export interface LinkedConditionCandidateFile {
  schema_version: "1.0";
  artifact_family: "linked_condition_service_use_candidate";
  status: "preliminary-candidate-only";
  generated_at: string;
  code_commit: string;
  candidates: LinkedConditionCandidateEstimate[];
}

export interface LinkedConditionCandidateManifest {
  schema_version: "1.0";
  artifact_family: "linked_condition_service_use_candidate";
  status: "preliminary-candidate-only";
  candidate_estimates_generated: true;
  automatic_release: false;
  runtime_eligible: false;
  runtime_selection_changed: false;
  reviewed_artifact_modified: false;
  reliability_rule_reviewed: false;
  code_commit: string;
  github_sha: string | null;
  code_commit_matches_github_sha: boolean | null;
  estimates_file: "linked-condition-candidate-estimates.json";
  diagnostics_file: "diagnostics.json";
  hc256_source_metadata_file: "hc256-source-metadata.json";
  linked_condition_source_metadata_file: "linked-condition-source-metadata.json";
}

export interface LinkedConditionCandidateValidationIssue {
  path: string;
  message: string;
}

const forbiddenIdentifierKeys = new Set(["DUPERSID", "CONDIDX", "EVNTIDX", "CLNKIDX"]);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNonnegativeInteger = (value: unknown): value is number =>
  isFiniteNumber(value) && Number.isInteger(value) && value >= 0;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const findForbiddenKeys = (
  value: unknown,
  path: string,
  issues: LinkedConditionCandidateValidationIssue[]
): void => {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => findForbiddenKeys(entry, `${path}[${index}]`, issues));
    return;
  }
  if (!isRecord(value)) return;
  for (const [key, entry] of Object.entries(value)) {
    if (forbiddenIdentifierKeys.has(key)) {
      issues.push({path: `${path}.${key}`, message: "respondent/event identifier fields are forbidden"});
    }
    findForbiddenKeys(entry, `${path}.${key}`, issues);
  }
};

const validateSupport = (
  value: unknown,
  path: string
): LinkedConditionCandidateValidationIssue[] => {
  const issues: LinkedConditionCandidateValidationIssue[] = [];
  if (!isRecord(value)) return [{path, message: "must be an object"}];
  if (!isNonEmptyString(value.label)) issues.push({path: `${path}.label`, message: "must be non-empty"});
  for (const key of [
    "unweighted_person_n",
    "represented_strata_n",
    "represented_stratum_psu_pairs_n",
    "represented_singleton_strata_n"
  ]) {
    if (!isNonnegativeInteger(value[key])) {
      issues.push({path: `${path}.${key}`, message: "must be a non-negative integer"});
    }
  }
  return issues;
};

export function validateLinkedConditionCandidateEstimate(
  value: unknown,
  path = "candidate"
): LinkedConditionCandidateValidationIssue[] {
  const issues: LinkedConditionCandidateValidationIssue[] = [];
  if (!isRecord(value)) return [{path, message: "must be an object"}];

  for (const key of [
    "candidate_id", "label", "unit", "interval_type", "ci_df_source",
    "allowed_interpretation", "cohort_definition", "statistics_method"
  ]) {
    if (!isNonEmptyString(value[key])) issues.push({path: `${path}.${key}`, message: "must be non-empty"});
  }

  for (const key of ["value", "standard_error", "interval_low", "interval_high", "weighted_denominator", "ci_degrees_of_freedom"]) {
    if (!isFiniteNumber(value[key])) issues.push({path: `${path}.${key}`, message: "must be finite"});
  }
  if (isFiniteNumber(value.standard_error) && value.standard_error < 0) {
    issues.push({path: `${path}.standard_error`, message: "must be >= 0"});
  }
  if (isFiniteNumber(value.weighted_denominator) && value.weighted_denominator < 0) {
    issues.push({path: `${path}.weighted_denominator`, message: "must be >= 0"});
  }
  if (isFiniteNumber(value.ci_degrees_of_freedom) && value.ci_degrees_of_freedom <= 0) {
    issues.push({path: `${path}.ci_degrees_of_freedom`, message: "must be > 0"});
  }
  if (isFiniteNumber(value.interval_low) && isFiniteNumber(value.interval_high) && value.interval_low > value.interval_high) {
    issues.push({path, message: "interval_low cannot exceed interval_high"});
  }
  if (
    isFiniteNumber(value.value) &&
    isFiniteNumber(value.interval_low) &&
    isFiniteNumber(value.interval_high) &&
    (value.value < value.interval_low || value.value > value.interval_high)
  ) {
    issues.push({path, message: "value must lie within interval"});
  }

  for (const key of ["unweighted_target_n", "unweighted_nonzero_person_n", "observed_qualifying_event_n"]) {
    if (!isNonnegativeInteger(value[key])) issues.push({path: `${path}.${key}`, message: "must be a non-negative integer"});
  }
  if (
    isNonnegativeInteger(value.unweighted_target_n) &&
    isNonnegativeInteger(value.unweighted_nonzero_person_n) &&
    value.unweighted_nonzero_person_n > value.unweighted_target_n
  ) {
    issues.push({path: `${path}.unweighted_nonzero_person_n`, message: "cannot exceed target n"});
  }

  issues.push(...validateSupport(value.target_support, `${path}.target_support`));
  issues.push(...validateSupport(value.nonzero_support, `${path}.nonzero_support`));

  if (!(value.relative_standard_error === null || (isFiniteNumber(value.relative_standard_error) && value.relative_standard_error >= 0))) {
    issues.push({path: `${path}.relative_standard_error`, message: "must be null or a non-negative finite number"});
  }
  if (!(value.interval_width === null || (isFiniteNumber(value.interval_width) && value.interval_width >= 0))) {
    issues.push({path: `${path}.interval_width`, message: "must be null or a non-negative finite number"});
  }

  if (value.reliability_status !== "not_adjudicated") {
    issues.push({path: `${path}.reliability_status`, message: "must remain not_adjudicated"});
  }
  if (value.reliability_rule_version !== null) {
    issues.push({path: `${path}.reliability_rule_version`, message: "must remain null before governed reliability review"});
  }
  if (value.release_eligible !== false) {
    issues.push({path: `${path}.release_eligible`, message: "must remain false"});
  }

  if (value.weight_variable !== "PERWT24F") issues.push({path: `${path}.weight_variable`, message: "must be PERWT24F"});
  if (value.variance_stratum_variable !== "VARSTR") issues.push({path: `${path}.variance_stratum_variable`, message: "must be VARSTR"});
  if (value.variance_psu_variable !== "VARPSU") issues.push({path: `${path}.variance_psu_variable`, message: "must be VARPSU"});

  for (const key of ["prohibited_interpretation", "limitations", "source_refs"]) {
    const candidate = value[key];
    if (!Array.isArray(candidate) || candidate.length === 0 || candidate.some(item => !isNonEmptyString(item))) {
      issues.push({path: `${path}.${key}`, message: "must be a non-empty string array"});
    }
  }

  return issues;
}

export function validateLinkedConditionCandidateFile(
  value: unknown
): LinkedConditionCandidateValidationIssue[] {
  const issues: LinkedConditionCandidateValidationIssue[] = [];
  if (!isRecord(value)) return [{path: "candidate_file", message: "must be an object"}];
  if (value.schema_version !== "1.0") issues.push({path: "candidate_file.schema_version", message: "must be 1.0"});
  if (value.artifact_family !== "linked_condition_service_use_candidate") {
    issues.push({path: "candidate_file.artifact_family", message: "invalid artifact family"});
  }
  if (value.status !== "preliminary-candidate-only") {
    issues.push({path: "candidate_file.status", message: "must remain preliminary-candidate-only"});
  }
  if (!isNonEmptyString(value.generated_at)) issues.push({path: "candidate_file.generated_at", message: "must be non-empty"});
  if (!isNonEmptyString(value.code_commit)) issues.push({path: "candidate_file.code_commit", message: "must be non-empty"});
  if (!Array.isArray(value.candidates) || value.candidates.length !== 6) {
    issues.push({path: "candidate_file.candidates", message: "must contain exactly six A/B/C candidate records"});
  } else {
    value.candidates.forEach((candidate, index) => {
      issues.push(...validateLinkedConditionCandidateEstimate(candidate, `candidate_file.candidates[${index}]`));
    });
    const ids = value.candidates
      .filter(isRecord)
      .map(candidate => candidate.candidate_id)
      .filter(isNonEmptyString);
    if (new Set(ids).size !== ids.length) {
      issues.push({path: "candidate_file.candidates", message: "candidate_id values must be unique"});
    }
  }
  findForbiddenKeys(value, "candidate_file", issues);
  return issues;
}

export function validateLinkedConditionCandidateManifest(
  value: unknown
): LinkedConditionCandidateValidationIssue[] {
  const issues: LinkedConditionCandidateValidationIssue[] = [];
  if (!isRecord(value)) return [{path: "candidate_manifest", message: "must be an object"}];
  const exact = {
    schema_version: "1.0",
    artifact_family: "linked_condition_service_use_candidate",
    status: "preliminary-candidate-only",
    candidate_estimates_generated: true,
    automatic_release: false,
    runtime_eligible: false,
    runtime_selection_changed: false,
    reviewed_artifact_modified: false,
    reliability_rule_reviewed: false,
    estimates_file: "linked-condition-candidate-estimates.json",
    diagnostics_file: "diagnostics.json",
    hc256_source_metadata_file: "hc256-source-metadata.json",
    linked_condition_source_metadata_file: "linked-condition-source-metadata.json"
  } as const;
  for (const [key, expected] of Object.entries(exact)) {
    if (value[key] !== expected) issues.push({path: `candidate_manifest.${key}`, message: `must equal ${String(expected)}`});
  }
  if (!isNonEmptyString(value.code_commit)) issues.push({path: "candidate_manifest.code_commit", message: "must be non-empty"});
  if (!(value.github_sha === null || isNonEmptyString(value.github_sha))) {
    issues.push({path: "candidate_manifest.github_sha", message: "must be null or non-empty"});
  }
  if (!(value.code_commit_matches_github_sha === null || value.code_commit_matches_github_sha === true)) {
    issues.push({path: "candidate_manifest.code_commit_matches_github_sha", message: "must be null or true"});
  }
  findForbiddenKeys(value, "candidate_manifest", issues);
  return issues;
}

export function assertValidLinkedConditionCandidate(
  candidateFile: unknown,
  manifest: unknown
): void {
  const issues = [
    ...validateLinkedConditionCandidateFile(candidateFile),
    ...validateLinkedConditionCandidateManifest(manifest)
  ];
  if (issues.length) {
    throw new Error(
      "Invalid linked-condition candidate artifact:\n" +
      issues.map(issue => `- ${issue.path}: ${issue.message}`).join("\n")
    );
  }
}
