export const linkedConditionPrecisionRuleVersion = "meps_hc_precision_v1" as const;

export const linkedConditionPrecisionStatuses = [
  "meps_precise",
  "meps_questionable_precision",
  "meps_low_percentage_exception",
  "meps_unstable_precision",
  "insufficient_sample",
  "unsupported_zero",
  "review_required"
] as const;
export type LinkedConditionPrecisionStatus = typeof linkedConditionPrecisionStatuses[number];

export const linkedConditionPrecisionReportingStatuses = [
  "reportable",
  "reportable_with_caution",
  "suppress_precision",
  "suppress_insufficient_sample",
  "suppress_unsupported_zero",
  "suppress_pending_review"
] as const;
export type LinkedConditionPrecisionReportingStatus = typeof linkedConditionPrecisionReportingStatuses[number];

export const linkedConditionPrecisionReasonCodes = [
  "sample_n_below_60",
  "rse_30_to_50",
  "rse_above_50",
  "low_percentage_exception",
  "zero_positive_support",
  "precision_input_invalid"
] as const;
export type LinkedConditionPrecisionReasonCode = typeof linkedConditionPrecisionReasonCodes[number];

export interface LinkedConditionPrecisionDecision {
  computationally_valid: boolean;
  precision_status: LinkedConditionPrecisionStatus;
  precision_reason_codes: LinkedConditionPrecisionReasonCode[];
  precision_reporting_status: LinkedConditionPrecisionReportingStatus;
  precision_rule_version: typeof linkedConditionPrecisionRuleVersion;
  product_release_eligible: false;
}

export const linkedConditionCandidateIds = [
  "u09_linked_service_use_person_share",
  "u09_linked_service_use_encounters_mean",
  "u09_linked_service_use_office_encounters_mean",
  "u09_linked_service_use_outpatient_encounters_mean",
  "u09_linked_service_use_emergency_encounters_mean",
  "u09_linked_service_use_inpatient_encounters_mean"
] as const;

export type LinkedConditionCandidateId = typeof linkedConditionCandidateIds[number];

export const linkedConditionCandidateSourceRefs = [
  "meps-hc256-2024",
  "meps-hc255-2024",
  "meps-hc254i-2024",
  "meps-hc254g-2024",
  "meps-hc254f-2024",
  "meps-hc254e-2024",
  "meps-hc254d-2024"
] as const;

export interface LinkedConditionSupport {
  label: string;
  unweighted_person_n: number;
  represented_strata_n: number;
  represented_stratum_psu_pairs_n: number;
  represented_singleton_strata_n: number;
}

export interface LinkedConditionCandidateEstimate {
  candidate_id: LinkedConditionCandidateId;
  label: string;
  unit: "proportion" | "encounters/person/year";
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
  computationally_valid: boolean;
  precision_status: LinkedConditionPrecisionStatus;
  precision_reason_codes: LinkedConditionPrecisionReasonCode[];
  precision_reporting_status: LinkedConditionPrecisionReportingStatus;
  precision_rule_version: typeof linkedConditionPrecisionRuleVersion;
  product_release_eligible: false;
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
  schema_version: "2.0";
  artifact_family: "linked_condition_service_use_candidate";
  status: "preliminary-candidate-only";
  generated_at: string;
  code_commit: string;
  candidates: LinkedConditionCandidateEstimate[];
}

export interface LinkedConditionCandidateManifest {
  schema_version: "2.0";
  artifact_family: "linked_condition_service_use_candidate";
  status: "preliminary-candidate-only";
  candidate_estimates_generated: true;
  automatic_release: false;
  runtime_eligible: false;
  runtime_selection_changed: false;
  reviewed_artifact_modified: false;
  precision_rule_version: typeof linkedConditionPrecisionRuleVersion;
  precision_rule_reviewed: true;
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
const candidateIdSet = new Set<string>(linkedConditionCandidateIds);
const sourceRefSet = new Set<string>(linkedConditionCandidateSourceRefs);

const supportKeys = [
  "label",
  "unweighted_person_n",
  "represented_strata_n",
  "represented_stratum_psu_pairs_n",
  "represented_singleton_strata_n"
] as const;

const candidateKeys = [
  "candidate_id", "label", "unit", "value", "standard_error", "interval_low",
  "interval_high", "interval_type", "unweighted_target_n", "unweighted_nonzero_person_n",
  "observed_qualifying_event_n", "weighted_denominator", "ci_degrees_of_freedom",
  "ci_df_source", "target_support", "nonzero_support", "relative_standard_error",
  "interval_width", "computationally_valid", "precision_status", "precision_reason_codes",
  "precision_reporting_status", "precision_rule_version", "product_release_eligible",
  "allowed_interpretation", "prohibited_interpretation", "limitations", "weight_variable",
  "variance_stratum_variable", "variance_psu_variable", "cohort_definition",
  "statistics_method", "source_refs"
] as const;

const candidateFileKeys = [
  "schema_version", "artifact_family", "status", "generated_at", "code_commit", "candidates"
] as const;

const manifestKeys = [
  "schema_version", "artifact_family", "status", "candidate_estimates_generated",
  "automatic_release", "runtime_eligible", "runtime_selection_changed",
  "reviewed_artifact_modified", "precision_rule_version", "precision_rule_reviewed", "code_commit", "github_sha",
  "code_commit_matches_github_sha", "estimates_file", "diagnostics_file",
  "hc256_source_metadata_file", "linked_condition_source_metadata_file"
] as const;

const diagnosticsKeys = [
  "schema_version", "status", "code_commit", "github_sha", "code_commit_matches_github_sha",
  "design_integrity", "full_person_design", "target_support", "reconciliation",
  "linkage_quality", "precision_governance", "scientific_guardrails"
] as const;

const designIntegrityKeys = [
  "target_missing_varstr_n", "target_missing_varpsu_n",
  "target_missing_or_nonpositive_perwt24f_n", "target_excluded_from_full_person_design_n",
  "target_domain_membership_exact"
] as const;

const fullPersonDesignKeys = [
  "label", "weight_variable", "unweighted_design_n", "variance_strata_n",
  "unique_varstr_varpsu_n", "minimum_psus_per_stratum", "maximum_psus_per_stratum",
  "psus_per_stratum_distribution", "true_or_represented_singleton_strata_n",
  "singleton_strata", "survey_degf"
] as const;

const reconciliationKeys = ["expected", "actual", "passed"] as const;
const expectedReconciliationKeys = [
  "target_n", "target_nonzero_person_n", "target_zero_person_n", "target_unique_events_n",
  "family_counts", "overall_unique_events_n", "multiplicity_n", "represented_strata_n",
  "represented_stratum_psu_pairs_n", "weighted_target_denominator",
  "weighted_target_denominator_tolerance"
] as const;
const actualReconciliationKeys = [
  "target_n", "target_nonzero_person_n", "target_zero_person_n", "target_unique_events_n",
  "family_counts", "overall_unique_events_n", "multiplicity_n", "represented_strata_n",
  "represented_stratum_psu_pairs_n", "weighted_target_denominator"
] as const;
const familyCountKeys = ["office", "outpatient", "emergency", "inpatient"] as const;
const linkageQualityKeys = [
  "unmatched_condidx_n", "condidx_person_mismatch_n", "unmatched_evntidx_n",
  "event_family_mismatch_n", "duplicate_clnkidx_n", "duplicate_condition_event_pair_n",
  "clnkidx_composition_mismatch_n", "unsupported_eventype_n", "unsupported_eventype_values"
] as const;
const precisionGovernanceKeys = ["rule_version", "rule_reviewed", "product_release_eligible"] as const;

const precisionStatusSet = new Set<string>(linkedConditionPrecisionStatuses);
const precisionReportingStatusSet = new Set<string>(linkedConditionPrecisionReportingStatuses);
const precisionReasonCodeSet = new Set<string>(linkedConditionPrecisionReasonCodes);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const isNonnegativeInteger = (value: unknown): value is number =>
  isFiniteNumber(value) && Number.isInteger(value) && value >= 0;

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const canonicalPrecisionReasonCodes = (
  values: readonly LinkedConditionPrecisionReasonCode[]
): LinkedConditionPrecisionReasonCode[] =>
  linkedConditionPrecisionReasonCodes.filter(code => values.includes(code));

export function evaluateLinkedConditionPrecision(
  value: unknown
): LinkedConditionPrecisionDecision {
  const reasons: LinkedConditionPrecisionReasonCode[] = [];
  if (!isRecord(value)) {
    return {
      computationally_valid: false,
      precision_status: "review_required",
      precision_reason_codes: ["precision_input_invalid"],
      precision_reporting_status: "suppress_pending_review",
      precision_rule_version: linkedConditionPrecisionRuleVersion,
      product_release_eligible: false
    };
  }

  const unitValid = value.unit === "proportion" || value.unit === "encounters/person/year";
  const targetNValid = isNonnegativeInteger(value.unweighted_target_n);
  const valueValid = isFiniteNumber(value.value) &&
    value.value >= 0 &&
    (value.unit !== "proportion" || value.value <= 1);
  const standardErrorValid = isFiniteNumber(value.standard_error) && value.standard_error >= 0;
  const intervalHighValid = isFiniteNumber(value.interval_high);
  const nonzeroNValid = isNonnegativeInteger(value.unweighted_nonzero_person_n);
  const eventNValid = isNonnegativeInteger(value.observed_qualifying_event_n);
  const rseValid = value.relative_standard_error === null ||
    (isFiniteNumber(value.relative_standard_error) && value.relative_standard_error >= 0);

  if (targetNValid && value.unweighted_target_n < 60) reasons.push("sample_n_below_60");

  let invalid = !unitValid ||
    !targetNValid ||
    !valueValid ||
    !standardErrorValid ||
    !intervalHighValid ||
    !nonzeroNValid ||
    !eventNValid ||
    !rseValid;

  if (
    targetNValid &&
    nonzeroNValid &&
    value.unweighted_nonzero_person_n > value.unweighted_target_n
  ) invalid = true;

  if (valueValid && intervalHighValid && value.interval_high < value.value) invalid = true;

  const supportConsistent = nonzeroNValid &&
    eventNValid &&
    (
      (value.unweighted_nonzero_person_n === 0 && value.observed_qualifying_event_n === 0) ||
      (value.unweighted_nonzero_person_n > 0 && value.observed_qualifying_event_n > 0)
    );
  if (nonzeroNValid && eventNValid && !supportConsistent) invalid = true;

  const exactZeroSupport = valueValid &&
    standardErrorValid &&
    rseValid &&
    nonzeroNValid &&
    eventNValid &&
    value.value === 0 &&
    value.standard_error === 0 &&
    value.relative_standard_error === null &&
    value.unweighted_nonzero_person_n === 0 &&
    value.observed_qualifying_event_n === 0;

  if (exactZeroSupport) reasons.push("zero_positive_support");

  if (
    nonzeroNValid &&
    eventNValid &&
    value.unweighted_nonzero_person_n === 0 &&
    value.observed_qualifying_event_n === 0 &&
    !exactZeroSupport
  ) invalid = true;

  if (valueValid && value.value !== 0 && value.relative_standard_error === null) invalid = true;

  if (
    valueValid &&
    value.value === 0 &&
    nonzeroNValid &&
    eventNValid &&
    (value.unweighted_nonzero_person_n > 0 || value.observed_qualifying_event_n > 0)
  ) invalid = true;

  if (invalid) {
    reasons.push("precision_input_invalid");
    return {
      computationally_valid: false,
      precision_status: "review_required",
      precision_reason_codes: canonicalPrecisionReasonCodes(reasons),
      precision_reporting_status: "suppress_pending_review",
      precision_rule_version: linkedConditionPrecisionRuleVersion,
      product_release_eligible: false
    };
  }

  if (exactZeroSupport) {
    return {
      computationally_valid: true,
      precision_status: "unsupported_zero",
      precision_reason_codes: canonicalPrecisionReasonCodes(reasons),
      precision_reporting_status: "suppress_unsupported_zero",
      precision_rule_version: linkedConditionPrecisionRuleVersion,
      product_release_eligible: false
    };
  }

  if (!isFiniteNumber(value.relative_standard_error)) {
    reasons.push("precision_input_invalid");
    return {
      computationally_valid: false,
      precision_status: "review_required",
      precision_reason_codes: canonicalPrecisionReasonCodes(reasons),
      precision_reporting_status: "suppress_pending_review",
      precision_rule_version: linkedConditionPrecisionRuleVersion,
      product_release_eligible: false
    };
  }

  let precisionStatus: LinkedConditionPrecisionStatus;
  let reportingStatus: LinkedConditionPrecisionReportingStatus;
  const rse = value.relative_standard_error;

  if (rse < 0.30) {
    precisionStatus = "meps_precise";
    reportingStatus = "reportable";
  } else if (rse <= 0.50) {
    reasons.push("rse_30_to_50");
    precisionStatus = "meps_questionable_precision";
    reportingStatus = "reportable_with_caution";
  } else {
    reasons.push("rse_above_50");
    if (value.unit === "proportion" && value.interval_high <= 0.10) {
      reasons.push("low_percentage_exception");
      precisionStatus = "meps_low_percentage_exception";
      reportingStatus = "reportable_with_caution";
    } else {
      precisionStatus = "meps_unstable_precision";
      reportingStatus = "suppress_precision";
    }
  }

  if (value.unweighted_target_n < 60) {
    precisionStatus = "insufficient_sample";
    reportingStatus = "suppress_insufficient_sample";
  }

  return {
    computationally_valid: true,
    precision_status: precisionStatus,
    precision_reason_codes: canonicalPrecisionReasonCodes(reasons),
    precision_reporting_status: reportingStatus,
    precision_rule_version: linkedConditionPrecisionRuleVersion,
    product_release_eligible: false
  };
}

const validatePrecisionReasonCodes = (
  value: unknown,
  path: string
): LinkedConditionCandidateValidationIssue[] => {
  if (!Array.isArray(value)) return [{path, message: "must be an array"}];
  const issues: LinkedConditionCandidateValidationIssue[] = [];
  if (value.some(item => !isNonEmptyString(item) || !precisionReasonCodeSet.has(item))) {
    issues.push({path, message: "must contain only governed precision reason codes"});
    return issues;
  }
  const strings = value as string[];
  if (new Set(strings).size !== strings.length) {
    issues.push({path, message: "must not contain duplicate reason codes"});
  }
  const canonical = linkedConditionPrecisionReasonCodes.filter(code => strings.includes(code));
  if (strings.length === canonical.length && strings.some((entry, index) => entry !== canonical[index])) {
    issues.push({path, message: "must use deterministic governed reason-code order"});
  }
  return issues;
};

const closedObjectIssues = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  path: string
): LinkedConditionCandidateValidationIssue[] => {
  const allowed = new Set(allowedKeys);
  return Object.keys(value)
    .filter(key => !allowed.has(key))
    .map(key => ({path: `${path}.${key}`, message: "unexpected property is forbidden by the closed aggregate-only contract"}));
};

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

const validateStringArray = (
  value: unknown,
  path: string,
  allowEmpty = false
): LinkedConditionCandidateValidationIssue[] => {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0) || value.some(item => !isNonEmptyString(item))) {
    return [{path, message: allowEmpty ? "must be a string array" : "must be a non-empty string array"}];
  }
  return [];
};

const validateExactStringSet = (
  value: unknown,
  expected: readonly string[],
  path: string
): LinkedConditionCandidateValidationIssue[] => {
  const issues = validateStringArray(value, path);
  if (issues.length || !Array.isArray(value)) return issues;
  const strings = value as string[];
  const counts = new Map<string, number>();
  strings.forEach(item => counts.set(item, (counts.get(item) ?? 0) + 1));
  const wrongLength = strings.length !== expected.length;
  const wrongMembership = strings.some(item => !sourceRefSet.has(item)) || expected.some(item => counts.get(item) !== 1);
  if (wrongLength || wrongMembership) {
    issues.push({path, message: `must contain exactly once each governed source ref: ${expected.join(", ")}`});
  }
  return issues;
};

const validateSupport = (
  value: unknown,
  path: string
): LinkedConditionCandidateValidationIssue[] => {
  const issues: LinkedConditionCandidateValidationIssue[] = [];
  if (!isRecord(value)) return [{path, message: "must be an object"}];
  issues.push(...closedObjectIssues(value, supportKeys, path));
  if (!isNonEmptyString(value.label)) issues.push({path: `${path}.label`, message: "must be non-empty"});
  for (const key of supportKeys.slice(1)) {
    if (!isNonnegativeInteger(value[key])) {
      issues.push({path: `${path}.${key}`, message: "must be a non-negative integer"});
    }
  }
  return issues;
};

const supportCounts = (value: unknown): number[] | null => {
  if (!isRecord(value)) return null;
  const keys = supportKeys.slice(1);
  const values = keys.map(key => value[key]);
  return values.every(isNonnegativeInteger) ? values as number[] : null;
};

const supportCountsEqual = (left: unknown, right: unknown): boolean => {
  const a = supportCounts(left);
  const b = supportCounts(right);
  return a !== null && b !== null && a.length === b.length && a.every((item, index) => item === b[index]);
};

const validateFamilyCounts = (
  value: unknown,
  path: string
): LinkedConditionCandidateValidationIssue[] => {
  if (!isRecord(value)) return [{path, message: "must be an object"}];
  const issues = closedObjectIssues(value, familyCountKeys, path);
  for (const key of familyCountKeys) {
    if (!isNonnegativeInteger(value[key])) issues.push({path: `${path}.${key}`, message: "must be a non-negative integer"});
  }
  return issues;
};

const validateReconciliationSide = (
  value: unknown,
  path: string,
  includeTolerance: boolean
): LinkedConditionCandidateValidationIssue[] => {
  if (!isRecord(value)) return [{path, message: "must be an object"}];
  const keys = includeTolerance ? expectedReconciliationKeys : actualReconciliationKeys;
  const issues = closedObjectIssues(value, keys, path);
  for (const key of [
    "target_n", "target_nonzero_person_n", "target_zero_person_n", "target_unique_events_n",
    "overall_unique_events_n", "multiplicity_n", "represented_strata_n",
    "represented_stratum_psu_pairs_n"
  ]) {
    if (!isNonnegativeInteger(value[key])) issues.push({path: `${path}.${key}`, message: "must be a non-negative integer"});
  }
  if (!isFiniteNumber(value.weighted_target_denominator) || value.weighted_target_denominator < 0) {
    issues.push({path: `${path}.weighted_target_denominator`, message: "must be a non-negative finite number"});
  }
  if (includeTolerance && (!isFiniteNumber(value.weighted_target_denominator_tolerance) || value.weighted_target_denominator_tolerance < 0)) {
    issues.push({path: `${path}.weighted_target_denominator_tolerance`, message: "must be a non-negative finite number"});
  }
  issues.push(...validateFamilyCounts(value.family_counts, `${path}.family_counts`));
  return issues;
};

export function validateLinkedConditionCandidateEstimate(
  value: unknown,
  path = "candidate"
): LinkedConditionCandidateValidationIssue[] {
  const issues: LinkedConditionCandidateValidationIssue[] = [];
  if (!isRecord(value)) return [{path, message: "must be an object"}];
  issues.push(...closedObjectIssues(value, candidateKeys, path));

  for (const key of [
    "candidate_id", "label", "unit", "interval_type", "ci_df_source",
    "allowed_interpretation", "cohort_definition", "statistics_method"
  ]) {
    if (!isNonEmptyString(value[key])) issues.push({path: `${path}.${key}`, message: "must be non-empty"});
  }

  if (isNonEmptyString(value.candidate_id) && candidateIdSet.has(value.candidate_id)) {
    const expectedUnit = value.candidate_id === "u09_linked_service_use_person_share"
      ? "proportion"
      : "encounters/person/year";
    if (value.unit !== expectedUnit) {
      issues.push({path: `${path}.unit`, message: `must be ${expectedUnit} for ${value.candidate_id}`});
    }
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

  if (isRecord(value.target_support) && isNonnegativeInteger(value.unweighted_target_n) &&
      value.target_support.unweighted_person_n !== value.unweighted_target_n) {
    issues.push({path: `${path}.target_support.unweighted_person_n`, message: "must equal unweighted_target_n"});
  }
  if (isRecord(value.nonzero_support) && isNonnegativeInteger(value.unweighted_nonzero_person_n) &&
      value.nonzero_support.unweighted_person_n !== value.unweighted_nonzero_person_n) {
    issues.push({path: `${path}.nonzero_support.unweighted_person_n`, message: "must equal unweighted_nonzero_person_n"});
  }
  if (isRecord(value.target_support) && isRecord(value.nonzero_support)) {
    for (const key of ["represented_strata_n", "represented_stratum_psu_pairs_n"] as const) {
      if (isNonnegativeInteger(value.target_support[key]) && isNonnegativeInteger(value.nonzero_support[key]) &&
          value.nonzero_support[key] > value.target_support[key]) {
        issues.push({path: `${path}.nonzero_support.${key}`, message: `cannot exceed target_support.${key}`});
      }
    }
  }
  if (value.unweighted_nonzero_person_n === 0 && isRecord(value.nonzero_support)) {
    for (const key of supportKeys.slice(1)) {
      if (value.nonzero_support[key] !== 0) {
        issues.push({path: `${path}.nonzero_support.${key}`, message: "must be 0 when unweighted_nonzero_person_n is 0"});
      }
    }
  }

  if (!(value.relative_standard_error === null || (isFiniteNumber(value.relative_standard_error) && value.relative_standard_error >= 0))) {
    issues.push({path: `${path}.relative_standard_error`, message: "must be null or a non-negative finite number"});
  }
  if (!(value.interval_width === null || (isFiniteNumber(value.interval_width) && value.interval_width >= 0))) {
    issues.push({path: `${path}.interval_width`, message: "must be null or a non-negative finite number"});
  }

  if (typeof value.computationally_valid !== "boolean") {
    issues.push({path: `${path}.computationally_valid`, message: "must be boolean"});
  }
  if (!isNonEmptyString(value.precision_status) || !precisionStatusSet.has(value.precision_status)) {
    issues.push({path: `${path}.precision_status`, message: "must be a governed precision status"});
  }
  issues.push(...validatePrecisionReasonCodes(value.precision_reason_codes, `${path}.precision_reason_codes`));
  if (!isNonEmptyString(value.precision_reporting_status) || !precisionReportingStatusSet.has(value.precision_reporting_status)) {
    issues.push({path: `${path}.precision_reporting_status`, message: "must be a governed precision reporting status"});
  }
  if (value.precision_rule_version !== linkedConditionPrecisionRuleVersion) {
    issues.push({path: `${path}.precision_rule_version`, message: `must be ${linkedConditionPrecisionRuleVersion}`});
  }
  if (value.product_release_eligible !== false) {
    issues.push({path: `${path}.product_release_eligible`, message: "must remain false"});
  }

  const expectedPrecision = evaluateLinkedConditionPrecision(value);
  for (const key of [
    "computationally_valid",
    "precision_status",
    "precision_reporting_status",
    "precision_rule_version",
    "product_release_eligible"
  ] as const) {
    if (value[key] !== expectedPrecision[key]) {
      issues.push({path: `${path}.${key}`, message: "must match independent meps_hc_precision_v1 recomputation"});
    }
  }
  if (
    Array.isArray(value.precision_reason_codes) &&
    (
      value.precision_reason_codes.length !== expectedPrecision.precision_reason_codes.length ||
      value.precision_reason_codes.some(
        (entry, index) => entry !== expectedPrecision.precision_reason_codes[index]
      )
    )
  ) {
    issues.push({path: `${path}.precision_reason_codes`, message: "must match independent meps_hc_precision_v1 recomputation"});
  }

  if (value.weight_variable !== "PERWT24F") issues.push({path: `${path}.weight_variable`, message: "must be PERWT24F"});
  if (value.variance_stratum_variable !== "VARSTR") issues.push({path: `${path}.variance_stratum_variable`, message: "must be VARSTR"});
  if (value.variance_psu_variable !== "VARPSU") issues.push({path: `${path}.variance_psu_variable`, message: "must be VARPSU"});

  for (const key of ["prohibited_interpretation", "limitations"]) {
    issues.push(...validateStringArray(value[key], `${path}.${key}`));
  }
  issues.push(...validateExactStringSet(value.source_refs, linkedConditionCandidateSourceRefs, `${path}.source_refs`));

  return issues;
}

export function validateLinkedConditionCandidateFile(
  value: unknown
): LinkedConditionCandidateValidationIssue[] {
  const issues: LinkedConditionCandidateValidationIssue[] = [];
  if (!isRecord(value)) return [{path: "candidate_file", message: "must be an object"}];
  issues.push(...closedObjectIssues(value, candidateFileKeys, "candidate_file"));
  if (value.schema_version !== "2.0") issues.push({path: "candidate_file.schema_version", message: "must be 2.0"});
  if (value.artifact_family !== "linked_condition_service_use_candidate") {
    issues.push({path: "candidate_file.artifact_family", message: "invalid artifact family"});
  }
  if (value.status !== "preliminary-candidate-only") {
    issues.push({path: "candidate_file.status", message: "must remain preliminary-candidate-only"});
  }
  if (!isNonEmptyString(value.generated_at)) issues.push({path: "candidate_file.generated_at", message: "must be non-empty"});
  if (!isNonEmptyString(value.code_commit)) issues.push({path: "candidate_file.code_commit", message: "must be non-empty"});
  if (!Array.isArray(value.candidates) || value.candidates.length !== linkedConditionCandidateIds.length) {
    issues.push({path: "candidate_file.candidates", message: "must contain exactly six A/B/C candidate records"});
  } else {
    const candidates = value.candidates as unknown[];
    candidates.forEach((candidate, index) => {
      issues.push(...validateLinkedConditionCandidateEstimate(candidate, `candidate_file.candidates[${index}]`));
    });
    const ids = candidates.filter(isRecord).map(candidate => candidate.candidate_id).filter(isNonEmptyString);
    const counts = new Map<string, number>();
    ids.forEach(id => counts.set(id, (counts.get(id) ?? 0) + 1));
    const exactSet = ids.length === linkedConditionCandidateIds.length &&
      ids.every(id => candidateIdSet.has(id)) &&
      linkedConditionCandidateIds.every(id => counts.get(id) === 1);
    if (!exactSet) {
      issues.push({path: "candidate_file.candidates", message: `must contain exactly once each governed candidate ID: ${linkedConditionCandidateIds.join(", ")}`});
    }

    if (exactSet) {
      const byId = new Map(ids.map((id, index) => [id, candidates[index] as Record<string, unknown>]));
      const reference = byId.get(linkedConditionCandidateIds[0]);
      if (reference) {
        for (const id of linkedConditionCandidateIds.slice(1)) {
          const candidate = byId.get(id);
          if (!candidate) continue;
          for (const key of [
            "unweighted_target_n", "weighted_denominator", "ci_degrees_of_freedom", "ci_df_source",
            "cohort_definition", "weight_variable", "variance_stratum_variable", "variance_psu_variable"
          ]) {
            if (candidate[key] !== reference[key]) {
              issues.push({path: `candidate_file.candidates.${id}.${key}`, message: `must match ${linkedConditionCandidateIds[0]}.${key}`});
            }
          }
          if (!supportCountsEqual(candidate.target_support, reference.target_support)) {
            issues.push({path: `candidate_file.candidates.${id}.target_support`, message: "target-support counts must match across all six candidates"});
          }
        }
      }

      const a = byId.get("u09_linked_service_use_person_share");
      const b = byId.get("u09_linked_service_use_encounters_mean");
      if (a && b) {
        if (a.unweighted_nonzero_person_n !== b.unweighted_nonzero_person_n) {
          issues.push({path: "candidate_file.candidates", message: "Candidate A and B must have the same unweighted_nonzero_person_n"});
        }
        if (a.observed_qualifying_event_n !== b.observed_qualifying_event_n) {
          issues.push({path: "candidate_file.candidates", message: "Candidate A and B must have the same observed_qualifying_event_n"});
        }
      }
      const familyIds = linkedConditionCandidateIds.slice(2);
      if (b && familyIds.every(id => byId.has(id)) && isNonnegativeInteger(b.observed_qualifying_event_n)) {
        const familyTotal = familyIds.reduce((sum, id) => {
          const eventN = byId.get(id)?.observed_qualifying_event_n;
          return sum + (isNonnegativeInteger(eventN) ? eventN : Number.NaN);
        }, 0);
        if (!Number.isNaN(familyTotal) && b.observed_qualifying_event_n !== familyTotal) {
          issues.push({path: "candidate_file.candidates", message: "Candidate B observed_qualifying_event_n must equal the sum of Candidate C family event counts"});
        }
      }
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
  issues.push(...closedObjectIssues(value, manifestKeys, "candidate_manifest"));
  const exact = {
    schema_version: "2.0",
    artifact_family: "linked_condition_service_use_candidate",
    status: "preliminary-candidate-only",
    candidate_estimates_generated: true,
    automatic_release: false,
    runtime_eligible: false,
    runtime_selection_changed: false,
    reviewed_artifact_modified: false,
    precision_rule_version: linkedConditionPrecisionRuleVersion,
    precision_rule_reviewed: true,
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

export function validateLinkedConditionCandidateDiagnostics(
  value: unknown
): LinkedConditionCandidateValidationIssue[] {
  const issues: LinkedConditionCandidateValidationIssue[] = [];
  if (!isRecord(value)) return [{path: "diagnostics", message: "must be an object"}];
  issues.push(...closedObjectIssues(value, diagnosticsKeys, "diagnostics"));
  if (value.schema_version !== "2.0") issues.push({path: "diagnostics.schema_version", message: "must be 2.0"});
  if (value.status !== "preliminary-candidate-only") issues.push({path: "diagnostics.status", message: "must remain preliminary-candidate-only"});
  if (!isNonEmptyString(value.code_commit)) issues.push({path: "diagnostics.code_commit", message: "must be non-empty"});
  if (!(value.github_sha === null || isNonEmptyString(value.github_sha))) issues.push({path: "diagnostics.github_sha", message: "must be null or non-empty"});
  if (!(value.code_commit_matches_github_sha === null || value.code_commit_matches_github_sha === true)) {
    issues.push({path: "diagnostics.code_commit_matches_github_sha", message: "must be null or true"});
  }

  if (!isRecord(value.design_integrity)) {
    issues.push({path: "diagnostics.design_integrity", message: "must be an object"});
  } else {
    issues.push(...closedObjectIssues(value.design_integrity, designIntegrityKeys, "diagnostics.design_integrity"));
    for (const key of designIntegrityKeys.slice(0, 4)) {
      if (!isNonnegativeInteger(value.design_integrity[key])) issues.push({path: `diagnostics.design_integrity.${key}`, message: "must be a non-negative integer"});
    }
    if (value.design_integrity.target_domain_membership_exact !== true) {
      issues.push({path: "diagnostics.design_integrity.target_domain_membership_exact", message: "must be true"});
    }
  }

  if (!isRecord(value.full_person_design)) {
    issues.push({path: "diagnostics.full_person_design", message: "must be an object"});
  } else {
    const full = value.full_person_design;
    issues.push(...closedObjectIssues(full, fullPersonDesignKeys, "diagnostics.full_person_design"));
    if (!isNonEmptyString(full.label)) issues.push({path: "diagnostics.full_person_design.label", message: "must be non-empty"});
    if (full.weight_variable !== "PERWT24F") issues.push({path: "diagnostics.full_person_design.weight_variable", message: "must be PERWT24F"});
    for (const key of [
      "unweighted_design_n", "variance_strata_n", "unique_varstr_varpsu_n",
      "minimum_psus_per_stratum", "maximum_psus_per_stratum",
      "true_or_represented_singleton_strata_n"
    ]) {
      if (!isNonnegativeInteger(full[key])) issues.push({path: `diagnostics.full_person_design.${key}`, message: "must be a non-negative integer"});
    }
    if (!isFiniteNumber(full.survey_degf) || full.survey_degf <= 0) issues.push({path: "diagnostics.full_person_design.survey_degf", message: "must be a positive finite number"});
    if (!isRecord(full.psus_per_stratum_distribution) || Object.keys(full.psus_per_stratum_distribution).length === 0) {
      issues.push({path: "diagnostics.full_person_design.psus_per_stratum_distribution", message: "must be a non-empty aggregate count map"});
    } else {
      for (const [key, entry] of Object.entries(full.psus_per_stratum_distribution)) {
        if (!/^n_psu_[0-9]+$/.test(key) || !isNonnegativeInteger(entry)) {
          issues.push({path: `diagnostics.full_person_design.psus_per_stratum_distribution.${key}`, message: "must be an n_psu_<integer> non-negative aggregate count"});
        }
      }
    }
    if (!Array.isArray(full.singleton_strata) || full.singleton_strata.some(entry => !isFiniteNumber(entry))) {
      issues.push({path: "diagnostics.full_person_design.singleton_strata", message: "must be an aggregate finite-number array"});
    }
  }

  issues.push(...validateSupport(value.target_support, "diagnostics.target_support"));

  if (!isRecord(value.reconciliation)) {
    issues.push({path: "diagnostics.reconciliation", message: "must be an object"});
  } else {
    issues.push(...closedObjectIssues(value.reconciliation, reconciliationKeys, "diagnostics.reconciliation"));
    issues.push(...validateReconciliationSide(value.reconciliation.expected, "diagnostics.reconciliation.expected", true));
    issues.push(...validateReconciliationSide(value.reconciliation.actual, "diagnostics.reconciliation.actual", false));
    if (value.reconciliation.passed !== true) issues.push({path: "diagnostics.reconciliation.passed", message: "must be true"});
  }

  if (!isRecord(value.linkage_quality)) {
    issues.push({path: "diagnostics.linkage_quality", message: "must be an object"});
  } else {
    issues.push(...closedObjectIssues(value.linkage_quality, linkageQualityKeys, "diagnostics.linkage_quality"));
    for (const key of linkageQualityKeys.slice(0, -1)) {
      if (!isNonnegativeInteger(value.linkage_quality[key])) issues.push({path: `diagnostics.linkage_quality.${key}`, message: "must be a non-negative integer"});
    }
    issues.push(...validateStringArray(value.linkage_quality.unsupported_eventype_values, "diagnostics.linkage_quality.unsupported_eventype_values", true));
  }

  if (!isRecord(value.precision_governance)) {
    issues.push({path: "diagnostics.precision_governance", message: "must be an object"});
  } else {
    issues.push(...closedObjectIssues(value.precision_governance, precisionGovernanceKeys, "diagnostics.precision_governance"));
    if (value.precision_governance.rule_version !== linkedConditionPrecisionRuleVersion) {
      issues.push({path: "diagnostics.precision_governance.rule_version", message: `must be ${linkedConditionPrecisionRuleVersion}`});
    }
    if (value.precision_governance.rule_reviewed !== true) {
      issues.push({path: "diagnostics.precision_governance.rule_reviewed", message: "must be true"});
    }
    if (value.precision_governance.product_release_eligible !== false) {
      issues.push({path: "diagnostics.precision_governance.product_release_eligible", message: "must remain false"});
    }
  }

  issues.push(...validateStringArray(value.scientific_guardrails, "diagnostics.scientific_guardrails"));
  findForbiddenKeys(value, "diagnostics", issues);
  return issues;
}

export function assertValidLinkedConditionCandidate(
  candidateFile: unknown,
  manifest: unknown,
  diagnostics: unknown
): void {
  const issues = [
    ...validateLinkedConditionCandidateFile(candidateFile),
    ...validateLinkedConditionCandidateManifest(manifest),
    ...validateLinkedConditionCandidateDiagnostics(diagnostics)
  ];

  if (isRecord(candidateFile) && isRecord(manifest)) {
    if (candidateFile.code_commit !== manifest.code_commit) {
      issues.push({path: "candidate_manifest.code_commit", message: "must equal candidate_file.code_commit"});
    }
    if (manifest.github_sha !== null) {
      if (manifest.github_sha !== candidateFile.code_commit) {
        issues.push({path: "candidate_manifest.github_sha", message: "must equal candidate_file.code_commit when non-null"});
      }
      if (manifest.code_commit_matches_github_sha !== true) {
        issues.push({path: "candidate_manifest.code_commit_matches_github_sha", message: "must be true when github_sha is non-null"});
      }
    }
  }

  if (isRecord(candidateFile) && isRecord(manifest) && isRecord(diagnostics)) {
    if (diagnostics.code_commit !== candidateFile.code_commit) {
      issues.push({path: "diagnostics.code_commit", message: "must equal candidate_file.code_commit"});
    }
    if (diagnostics.github_sha !== manifest.github_sha) {
      issues.push({path: "diagnostics.github_sha", message: "must equal candidate_manifest.github_sha"});
    }
    if (diagnostics.code_commit_matches_github_sha !== manifest.code_commit_matches_github_sha) {
      issues.push({path: "diagnostics.code_commit_matches_github_sha", message: "must equal candidate_manifest.code_commit_matches_github_sha"});
    }
  }

  if (issues.length) {
    throw new Error(
      "Invalid linked-condition candidate artifact:\n" +
      issues.map(issue => `- ${issue.path}: ${issue.message}`).join("\n")
    );
  }
}