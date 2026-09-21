export const evidenceTypes = [
  "survey_estimate",
  "adjusted_association",
  "contextual_indicator",
  "literature_derived",
  "scenario_assumption",
  "qualitative_evidence"
] as const;

export const releaseStatuses = [
  "preliminary",
  "reviewed_released",
  "not_released",
  "suppressed",
  "unavailable"
] as const;

export const displayStatuses = ["illustrative", "analytical_artifact"] as const;

export const admissibilityStatuses = [
  "supported",
  "supported_with_bounds",
  "limited_use",
  "insufficient"
] as const;

export const dataStates = [
  "loading",
  "loaded",
  "partial",
  "empty",
  "suppressed",
  "error",
  "stale_fallback",
  "unsupported_combination"
] as const;

export type EvidenceType = (typeof evidenceTypes)[number];
export type ReleaseStatus = (typeof releaseStatuses)[number];
export type DisplayStatus = (typeof displayStatuses)[number];
export type AdmissibilityStatus = (typeof admissibilityStatuses)[number];
export type DataState = (typeof dataStates)[number];

export interface AnalysisContext {
  condition_id: string;
  cohort_id: string;
  age_range: string;
  evidence_year: number;
  geography_scope: string;
  local_context_id: string | null;
  severity_filter: string | null;
  artifact_version: string;
}

export interface Estimate {
  estimate_id: string;
  measure_id: string;
  label: string;
  value: number | null;
  unit: string;
  interval_low: number | null;
  interval_high: number | null;
  interval_type: string | null;
  denominator: string;
  universe: string;
  system_boundary: string;
  pathway_step?: string | null;
  evidence_type: EvidenceType;
  release_status: ReleaseStatus;
  display_status: DisplayStatus;
  source_ref: string;
  artifact_version: string;
  allowed_interpretation: string;
  prohibited_interpretation: string[];
  limitations: string[];
  standard_error?: number | null;
  weighted_denominator?: number | null;
  unweighted_n?: number | null;
  unweighted_numerator_n?: number | null;
  weight_variable?: string | null;
  variance_stratum_variable?: string | null;
  variance_psu_variable?: string | null;
  source_locator?: string | null;
  cohort_definition?: string | null;
  statistics_method?: string | null;
  component_of_measure_id?: string | null;
}

export interface BurdenDomain {
  domain_id: string;
  label: string;
  measures: Estimate[];
  availability_state: DataState;
  limitations: string[];
}

export interface Scenario {
  scenario_id: string;
  eligible_population: number;
  reach: number;
  capacity: number;
  baseline_window_months: number;
  alternative_window_months: number;
  horizon_months: number;
  fixed_cost: number;
  per_participant_cost: number;
  target_pathway_step: string;
  mechanism: string;
  assumption_refs: string[];
  artifact_version: string;
}

export interface BoundedEffect {
  parameter_id: string;
  value_low: number;
  value_high: number;
  unit: string;
  pathway_step: string;
  target_mechanism: string;
  evidence_id: string;
}

export interface ScenarioResult {
  scenario_id: string;
  intended_reach: number;
  reached_participants: number;
  capacity_gap: number;
  baseline_person_months: number;
  alternative_person_months: number;
  difference_person_months: number;
  fixed_program_cost: number;
  variable_program_cost: number;
  program_resource_requirement: number;
  target_pathway_step: string;
  target_mechanism: string;
  bounded_effect?: BoundedEffect;
}

export type ReviewerStatus = "draft" | "needs_review" | "approved" | "rejected";

export interface EvidenceRecord {
  evidence_id: string;
  source: string;
  locator: string;
  population: string;
  condition_definition: string;
  outcome: string;
  effect_or_parameter: string | null;
  uncertainty: string | null;
  system_boundary: string;
  pathway_step?: string | null;
  target_mechanism?: string | null;
  geography: string;
  payer: string;
  year: number;
  limitations: string[];
  reviewer_status: ReviewerStatus;
  admissibility_status: AdmissibilityStatus;
  allowed_use: string;
}

export interface LocalContextRecord {
  indicator: string;
  geography: string;
  year: number;
  value: number | string | null;
  unit?: string | null;
  source: string;
  context_type: string;
  state: DataState;
  limitations: string[];
}

export interface QualitativeEvidence {
  theme_id: string;
  source_type: string;
  scope: string;
  summary: string;
  approved_for_display: boolean;
  limitation: string;
}

export interface DataRequest {
  request_id: string;
  target_question: string;
  pathway_step: string;
  fields_needed: string[];
  likely_source_owner: string;
  granularity_time_window: string;
  rationale: string;
  feasibility_privacy_notes: string;
}

export interface BriefManifest {
  brief_id: string;
  context: AnalysisContext;
  included_estimates: string[];
  scenario_id?: string | null;
  evidence_ids: string[];
  data_requests: DataRequest[];
  omitted_sections: string[];
  warnings: string[];
  version: string;
  generated_at: string;
}

export interface SourceManifestEntry {
  source_ref: string;
  source_name: string;
  official_url: string;
  release_year: number;
  locator: string;
  limitations: string[];
}

export interface ArtifactManifest {
  artifact_version: string;
  generated_at: string;
  code_commit: string;
  run_id: string;
  dataset_releases: string[];
  display_status: DisplayStatus;
}

export interface ArtifactBundle {
  manifest: ArtifactManifest;
  context: AnalysisContext;
  burden_domains: BurdenDomain[];
  evidence: EvidenceRecord[];
  local_context: LocalContextRecord[];
  qualitative_evidence: QualitativeEvidence[];
  scenario_examples: Scenario[];
  data_requests: DataRequest[];
  sources: SourceManifestEntry[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const isNullableFiniteNumber = (value: unknown): value is number | null =>
  value === null || (typeof value === "number" && Number.isFinite(value));

const oneOf = <T extends readonly string[]>(value: unknown, choices: T): value is T[number] =>
  typeof value === "string" && choices.includes(value as T[number]);

export function validateEstimate(value: unknown, path = "estimate"): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!isRecord(value)) return [{ path, message: "must be an object" }];

  const requiredStrings = [
    "estimate_id", "measure_id", "label", "unit", "denominator", "universe",
    "system_boundary", "source_ref", "artifact_version", "allowed_interpretation"
  ];
  for (const key of requiredStrings) {
    if (!isNonEmptyString(value[key])) issues.push({ path: `${path}.${key}`, message: "must be a non-empty string" });
  }

  if (!isNullableFiniteNumber(value.value)) issues.push({ path: `${path}.value`, message: "must be a finite number or null" });
  if (!isNullableFiniteNumber(value.interval_low)) issues.push({ path: `${path}.interval_low`, message: "must be a finite number or null" });
  if (!isNullableFiniteNumber(value.interval_high)) issues.push({ path: `${path}.interval_high`, message: "must be a finite number or null" });
  if (!oneOf(value.evidence_type, evidenceTypes)) issues.push({ path: `${path}.evidence_type`, message: "invalid evidence type" });
  if (!oneOf(value.release_status, releaseStatuses)) issues.push({ path: `${path}.release_status`, message: "invalid release status" });
  if (!oneOf(value.display_status, displayStatuses)) issues.push({ path: `${path}.display_status`, message: "invalid display status" });

  const hiddenStatuses: ReleaseStatus[] = ["not_released", "suppressed", "unavailable"];
  if (hiddenStatuses.includes(value.release_status as ReleaseStatus) && value.value !== null) {
    issues.push({ path: `${path}.value`, message: "must be null when result is not released, suppressed, or unavailable" });
  }

  if (value.interval_low !== null && value.interval_high !== null &&
      typeof value.interval_low === "number" && typeof value.interval_high === "number" &&
      value.interval_low > value.interval_high) {
    issues.push({ path, message: "interval_low cannot exceed interval_high" });
  }

  const isNumericAnalyticalArtifact =
    value.display_status === "analytical_artifact" &&
    typeof value.value === "number" &&
    Number.isFinite(value.value);

  if (isNumericAnalyticalArtifact) {
    const provenanceStrings = [
      "weight_variable",
      "variance_stratum_variable",
      "variance_psu_variable",
      "source_locator",
      "cohort_definition",
      "statistics_method"
    ];
    for (const key of provenanceStrings) {
      if (!isNonEmptyString(value[key])) {
        issues.push({
          path: `${path}.${key}`,
          message: "is required for a numeric analytical artifact"
        });
      }
    }

    for (const key of ["standard_error", "weighted_denominator", "unweighted_n"]) {
      const candidate = value[key];
      if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate < 0) {
        issues.push({
          path: `${path}.${key}`,
          message: "must be a non-negative finite number for a numeric analytical artifact"
        });
      }
    }
  }

  if (typeof value.component_of_measure_id === "string" &&
      value.component_of_measure_id === value.measure_id) {
    issues.push({
      path: `${path}.component_of_measure_id`,
      message: "cannot refer to the same measure_id"
    });
  }

  return issues;
}

export function validateScenario(value: unknown, path = "scenario"): ValidationIssue[] {
  if (!isRecord(value)) return [{ path, message: "must be an object" }];
  const issues: ValidationIssue[] = [];
  for (const key of ["scenario_id", "target_pathway_step", "mechanism", "artifact_version"]) {
    if (!isNonEmptyString(value[key])) issues.push({ path: `${path}.${key}`, message: "must be a non-empty string" });
  }

  const nonNegative = [
    "eligible_population", "capacity", "baseline_window_months", "alternative_window_months",
    "horizon_months", "fixed_cost", "per_participant_cost"
  ];
  for (const key of nonNegative) {
    if (typeof value[key] !== "number" || !Number.isFinite(value[key]) || (value[key] as number) < 0) {
      issues.push({ path: `${path}.${key}`, message: "must be a non-negative finite number" });
    }
  }

  if (typeof value.reach !== "number" || !Number.isFinite(value.reach) || value.reach < 0 || value.reach > 1) {
    issues.push({ path: `${path}.reach`, message: "must be a proportion between 0 and 1" });
  }
  if (typeof value.alternative_window_months === "number" &&
      typeof value.baseline_window_months === "number" &&
      value.alternative_window_months > value.baseline_window_months) {
    issues.push({ path: `${path}.alternative_window_months`, message: "cannot exceed baseline window" });
  }
  return issues;
}

export function validateArtifactBundle(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) return [{ path: "artifact", message: "must be an object" }];
  const issues: ValidationIssue[] = [];

  if (!isRecord(value.manifest)) issues.push({ path: "artifact.manifest", message: "must be an object" });
  if (!isRecord(value.context)) issues.push({ path: "artifact.context", message: "must be an object" });

  if (!Array.isArray(value.burden_domains)) {
    issues.push({ path: "artifact.burden_domains", message: "must be an array" });
  } else {
    value.burden_domains.forEach((domain, domainIndex) => {
      if (!isRecord(domain)) {
        issues.push({ path: `artifact.burden_domains[${domainIndex}]`, message: "must be an object" });
        return;
      }
      if (!oneOf(domain.availability_state, dataStates)) {
        issues.push({ path: `artifact.burden_domains[${domainIndex}].availability_state`, message: "invalid data state" });
      }
      if (!Array.isArray(domain.measures)) {
        issues.push({ path: `artifact.burden_domains[${domainIndex}].measures`, message: "must be an array" });
      } else {
        domain.measures.forEach((estimate, estimateIndex) => {
          issues.push(...validateEstimate(estimate, `artifact.burden_domains[${domainIndex}].measures[${estimateIndex}]`));
        });
      }
    });
  }

  if (!Array.isArray(value.scenario_examples)) {
    issues.push({ path: "artifact.scenario_examples", message: "must be an array" });
  } else {
    value.scenario_examples.forEach((scenario, index) => {
      issues.push(...validateScenario(scenario, `artifact.scenario_examples[${index}]`));
    });
  }

  return issues;
}

export function assertValidArtifactBundle(value: unknown): asserts value is ArtifactBundle {
  const issues = validateArtifactBundle(value);
  if (issues.length > 0) {
    throw new Error(`Invalid Diagnostic Odyssey artifact:\n${issues.map(i => `- ${i.path}: ${i.message}`).join("\n")}`);
  }
}

export const canExportEstimate = (estimate: Estimate): boolean =>
  estimate.release_status === "reviewed_released" &&
  estimate.display_status === "analytical_artifact" &&
  estimate.value !== null;
