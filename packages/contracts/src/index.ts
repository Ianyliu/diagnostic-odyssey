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

export interface DistributionSummary {
  summary_type: "survey_weighted_quantiles";
  source_variable: string;
  p25: number;
  p50: number;
  p75: number;
  unweighted_n: number;
  weighted_denominator: number;
  weight_variable: string;
  variance_stratum_variable: string;
  variance_psu_variable: string;
  statistics_method: string;
  limitations: string[];
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
  ci_degrees_of_freedom?: number | null;
  ci_df_source?: string | null;
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
  relative_standard_error?: number | null;
  interval_width?: number | null;
  unweighted_excluded_or_missing_n?: number | null;
  distribution_summary?: DistributionSummary;
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

export type LocalGeographyType = "state" | "county";
export type LocalContextReleaseStatus = Extract<ReleaseStatus, "preliminary" | "reviewed_released">;

export interface LocalContextGeography {
  geography_name: string;
  geography_type: LocalGeographyType;
  state_fips: string;
  county_fips: string | null;
}

export interface LocalContextRecord {
  /**
   * Legacy presentation aliases retained temporarily so existing empty/fixture runtime
   * surfaces continue to typecheck. Reviewed local-context artifacts are validated
   * against the canonical fields below and do not rely on these aliases.
   */
  indicator?: string;
  geography?: string;
  year?: number;
  source?: string;
  indicator_id: string;
  label: string;
  geography_name: string;
  geography_type: LocalGeographyType;
  state_fips: string;
  county_fips: string | null;
  source_agency: string;
  source_ref: string;
  source_locator: string;
  source_release_vintage: string;
  observation_as_of_date: string | null;
  value: number | string | null;
  unit: string;
  universe: string;
  margin_of_error: number | null;
  confidence_level: number | null;
  uncertainty_type: string | null;
  context_type: "contextual_indicator";
  state: DataState;
  limitations: string[];
  allowed_interpretation: string;
  prohibited_interpretation: string[];
  release_status: LocalContextReleaseStatus;
}

export interface LocalContextSource {
  source_ref: string;
  source_agency: string;
  source_name: string;
  source_locator: string;
  source_release_vintage: string;
  observation_as_of_date: string | null;
  retrieved_at: string;
  byte_size: number | null;
  sha256: string | null;
  published_update_date: string | null;
  limitations: string[];
}

export interface LocalContextManifest {
  artifact_family: "local_context";
  artifact_version: string;
  generated_at: string;
  code_commit: string;
  run_id: string;
  release_status: LocalContextReleaseStatus;
  national_meps_artifact_version: string;
  national_meps_burden_unchanged: true;
}

export interface LocalContextArtifact {
  manifest: LocalContextManifest;
  geography: LocalContextGeography;
  indicators: LocalContextRecord[];
  sources: LocalContextSource[];
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
  target_mechanism?: string | null;
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
      "statistics_method",
      "ci_df_source"
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

    const ciDf = value.ci_degrees_of_freedom;
    if (typeof ciDf !== "number" || !Number.isFinite(ciDf) || ciDf <= 0) {
      issues.push({
        path: `${path}.ci_degrees_of_freedom`,
        message: "must be a positive finite number for a numeric analytical artifact"
      });
    }
  }

  if (value.distribution_summary !== undefined) {
    const summaryPath = `${path}.distribution_summary`;
    const summary = value.distribution_summary;
    if (!isRecord(summary)) {
      issues.push({ path: summaryPath, message: "must be an object" });
    } else {
      if (summary.summary_type !== "survey_weighted_quantiles") {
        issues.push({
          path: `${summaryPath}.summary_type`,
          message: "must be survey_weighted_quantiles"
        });
      }

      for (const key of [
        "source_variable",
        "weight_variable",
        "variance_stratum_variable",
        "variance_psu_variable",
        "statistics_method"
      ]) {
        if (!isNonEmptyString(summary[key])) {
          issues.push({
            path: `${summaryPath}.${key}`,
            message: "must be a non-empty string"
          });
        }
      }

      for (const key of ["p25", "p50", "p75", "weighted_denominator"]) {
        const candidate = summary[key];
        if (typeof candidate !== "number" || !Number.isFinite(candidate)) {
          issues.push({
            path: `${summaryPath}.${key}`,
            message: "must be a finite number"
          });
        }
      }

      if (
        typeof summary.weighted_denominator === "number" &&
        Number.isFinite(summary.weighted_denominator) &&
        summary.weighted_denominator < 0
      ) {
        issues.push({
          path: `${summaryPath}.weighted_denominator`,
          message: "must be non-negative"
        });
      }

      if (
        typeof summary.unweighted_n !== "number" ||
        !Number.isFinite(summary.unweighted_n) ||
        !Number.isInteger(summary.unweighted_n) ||
        summary.unweighted_n < 0
      ) {
        issues.push({
          path: `${summaryPath}.unweighted_n`,
          message: "must be a non-negative integer"
        });
      }

      if (
        typeof summary.p25 === "number" && Number.isFinite(summary.p25) &&
        typeof summary.p50 === "number" && Number.isFinite(summary.p50) &&
        summary.p25 > summary.p50
      ) {
        issues.push({ path: summaryPath, message: "p25 cannot exceed p50" });
      }
      if (
        typeof summary.p50 === "number" && Number.isFinite(summary.p50) &&
        typeof summary.p75 === "number" && Number.isFinite(summary.p75) &&
        summary.p50 > summary.p75
      ) {
        issues.push({ path: summaryPath, message: "p50 cannot exceed p75" });
      }

      if (
        !Array.isArray(summary.limitations) ||
        summary.limitations.some(item => !isNonEmptyString(item))
      ) {
        issues.push({
          path: `${summaryPath}.limitations`,
          message: "must be an array of non-empty strings"
        });
      }

      if (!isNumericAnalyticalArtifact) {
        issues.push({
          path: summaryPath,
          message: "requires a numeric analytical parent estimate"
        });
      }

      for (const [summaryKey, parentKey] of [
        ["weight_variable", "weight_variable"],
        ["variance_stratum_variable", "variance_stratum_variable"],
        ["variance_psu_variable", "variance_psu_variable"]
      ] as const) {
        if (
          isNonEmptyString(summary[summaryKey]) &&
          isNonEmptyString(value[parentKey]) &&
          summary[summaryKey] !== value[parentKey]
        ) {
          issues.push({
            path: `${summaryPath}.${summaryKey}`,
            message: `must match parent estimate ${parentKey}`
          });
        }
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

export function validateLocalContextRecord(
  value: unknown,
  path = "local_context"
): ValidationIssue[] {
  if (!isRecord(value)) return [{ path, message: "must be an object" }];
  const issues: ValidationIssue[] = [];

  for (const key of [
    "indicator_id", "label", "geography_name", "source_agency", "source_ref",
    "source_locator", "source_release_vintage", "unit", "universe",
    "allowed_interpretation"
  ]) {
    if (!isNonEmptyString(value[key])) {
      issues.push({ path: `${path}.${key}`, message: "must be a non-empty string" });
    }
  }

  if (value.geography_type !== "state" && value.geography_type !== "county") {
    issues.push({ path: `${path}.geography_type`, message: "must be state or county" });
  }
  if (typeof value.state_fips !== "string" || !/^\d{2}$/.test(value.state_fips)) {
    issues.push({ path: `${path}.state_fips`, message: "must be a two-digit FIPS code" });
  }

  const countyFips = value.county_fips;
  if (value.geography_type === "state" && countyFips !== null) {
    issues.push({ path: `${path}.county_fips`, message: "must be null for state geography" });
  }
  if (value.geography_type === "county") {
    if (typeof countyFips !== "string" || !/^\d{5}$/.test(countyFips)) {
      issues.push({ path: `${path}.county_fips`, message: "must be a five-digit FIPS code for county geography" });
    } else if (typeof value.state_fips === "string" && !countyFips.startsWith(value.state_fips)) {
      issues.push({ path: `${path}.county_fips`, message: "must begin with state_fips" });
    }
  }

  if (!(value.value === null || typeof value.value === "string" ||
        (typeof value.value === "number" && Number.isFinite(value.value)))) {
    issues.push({ path: `${path}.value`, message: "must be a finite number, string, or null" });
  }

  if (!isNullableFiniteNumber(value.margin_of_error) ||
      (typeof value.margin_of_error === "number" && value.margin_of_error < 0)) {
    issues.push({ path: `${path}.margin_of_error`, message: "must be a non-negative finite number or null" });
  }
  if (!(value.confidence_level === null ||
        (typeof value.confidence_level === "number" && Number.isFinite(value.confidence_level) &&
         value.confidence_level > 0 && value.confidence_level <= 1))) {
    issues.push({ path: `${path}.confidence_level`, message: "must be in (0, 1] or null" });
  }
  if (!(value.observation_as_of_date === null || isNonEmptyString(value.observation_as_of_date))) {
    issues.push({ path: `${path}.observation_as_of_date`, message: "must be a non-empty string or null" });
  }
  if (!(value.uncertainty_type === null || isNonEmptyString(value.uncertainty_type))) {
    issues.push({ path: `${path}.uncertainty_type`, message: "must be a non-empty string or null" });
  }

  if (value.context_type !== "contextual_indicator") {
    issues.push({ path: `${path}.context_type`, message: "must be contextual_indicator" });
  }
  if (!oneOf(value.state, dataStates)) {
    issues.push({ path: `${path}.state`, message: "invalid data state" });
  }
  if (value.release_status !== "preliminary" && value.release_status !== "reviewed_released") {
    issues.push({ path: `${path}.release_status`, message: "must be preliminary or reviewed_released" });
  }

  if (!Array.isArray(value.limitations) || value.limitations.some(item => !isNonEmptyString(item))) {
    issues.push({ path: `${path}.limitations`, message: "must be an array of non-empty strings" });
  }
  if (!Array.isArray(value.prohibited_interpretation) ||
      value.prohibited_interpretation.length === 0 ||
      value.prohibited_interpretation.some(item => !isNonEmptyString(item))) {
    issues.push({ path: `${path}.prohibited_interpretation`, message: "must contain at least one non-empty string" });
  }

  if (value.source_agency === "U.S. Census Bureau") {
    if (value.margin_of_error === null) {
      issues.push({ path: `${path}.margin_of_error`, message: "ACS profile percentages must preserve the published MOE" });
    }
    if (value.confidence_level !== 0.9) {
      issues.push({ path: `${path}.confidence_level`, message: "ACS profile MOE confidence level must remain 0.9" });
    }
    if (value.uncertainty_type !== "published_90_percent_margin_of_error") {
      issues.push({ path: `${path}.uncertainty_type`, message: "ACS uncertainty must be the published 90% margin of error" });
    }
  }

  return issues;
}

export function validateLocalContextArtifact(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) return [{ path: "local_artifact", message: "must be an object" }];
  const issues: ValidationIssue[] = [];
  const manifest = value.manifest;
  const geography = value.geography;

  if (!isRecord(manifest)) {
    issues.push({ path: "local_artifact.manifest", message: "must be an object" });
  } else {
    if (manifest.artifact_family !== "local_context") {
      issues.push({ path: "local_artifact.manifest.artifact_family", message: "must be local_context" });
    }
    for (const key of [
      "artifact_version", "generated_at", "code_commit", "run_id",
      "national_meps_artifact_version"
    ]) {
      if (!isNonEmptyString(manifest[key])) {
        issues.push({ path: `local_artifact.manifest.${key}`, message: "must be a non-empty string" });
      }
    }
    if (manifest.release_status !== "preliminary" && manifest.release_status !== "reviewed_released") {
      issues.push({ path: "local_artifact.manifest.release_status", message: "invalid local release status" });
    }
    if (manifest.national_meps_burden_unchanged !== true) {
      issues.push({
        path: "local_artifact.manifest.national_meps_burden_unchanged",
        message: "must be true"
      });
    }
  }

  if (!isRecord(geography)) {
    issues.push({ path: "local_artifact.geography", message: "must be an object" });
  } else {
    if (!isNonEmptyString(geography.geography_name)) {
      issues.push({ path: "local_artifact.geography.geography_name", message: "must be a non-empty string" });
    }
    if (geography.geography_type !== "state" && geography.geography_type !== "county") {
      issues.push({ path: "local_artifact.geography.geography_type", message: "must be state or county" });
    }
    if (typeof geography.state_fips !== "string" || !/^\d{2}$/.test(geography.state_fips)) {
      issues.push({ path: "local_artifact.geography.state_fips", message: "must be a two-digit FIPS code" });
    }
    if (geography.geography_type === "state" && geography.county_fips !== null) {
      issues.push({ path: "local_artifact.geography.county_fips", message: "must be null for state geography" });
    }
    if (geography.geography_type === "county" &&
        (typeof geography.county_fips !== "string" || !/^\d{5}$/.test(geography.county_fips))) {
      issues.push({ path: "local_artifact.geography.county_fips", message: "must be a five-digit FIPS code" });
    }
  }

  if (!Array.isArray(value.sources) || value.sources.length === 0) {
    issues.push({ path: "local_artifact.sources", message: "must contain at least one source" });
  }
  const sourceRefs = new Set<string>();
  if (Array.isArray(value.sources)) {
    value.sources.forEach((source, index) => {
      const sourcePath = `local_artifact.sources[${index}]`;
      if (!isRecord(source)) {
        issues.push({ path: sourcePath, message: "must be an object" });
        return;
      }
      for (const key of [
        "source_ref", "source_agency", "source_name", "source_locator",
        "source_release_vintage", "retrieved_at"
      ]) {
        if (!isNonEmptyString(source[key])) {
          issues.push({ path: `${sourcePath}.${key}`, message: "must be a non-empty string" });
        }
      }
      if (isNonEmptyString(source.source_ref)) sourceRefs.add(source.source_ref);
      if (!(source.byte_size === null ||
            (typeof source.byte_size === "number" && Number.isFinite(source.byte_size) && source.byte_size >= 0))) {
        issues.push({ path: `${sourcePath}.byte_size`, message: "must be a non-negative finite number or null" });
      }
      if (!(source.sha256 === null || (typeof source.sha256 === "string" && /^[a-f0-9]{64}$/.test(source.sha256)))) {
        issues.push({ path: `${sourcePath}.sha256`, message: "must be a lowercase SHA-256 string or null" });
      }
      if (source.source_ref === "acs-2024-5year-profile") {
        if (!(typeof source.byte_size === "number" && Number.isFinite(source.byte_size) && source.byte_size > 0)) {
          issues.push({
            path: `${sourcePath}.byte_size`,
            message: "ACS source snapshots must have a positive deterministic canonical byte size"
          });
        }
        if (!(typeof source.sha256 === "string" && /^[a-f0-9]{64}$/.test(source.sha256))) {
          issues.push({
            path: `${sourcePath}.sha256`,
            message: "ACS source snapshots must have a deterministic SHA-256"
          });
        }
      }
    });
  }

  if (!Array.isArray(value.indicators) || value.indicators.length === 0) {
    issues.push({ path: "local_artifact.indicators", message: "must contain at least one indicator" });
  } else {
    value.indicators.forEach((record, index) => {
      const recordPath = `local_artifact.indicators[${index}]`;
      issues.push(...validateLocalContextRecord(record, recordPath));
      if (!isRecord(record)) return;

      if (isRecord(manifest) &&
          (manifest.release_status === "preliminary" || manifest.release_status === "reviewed_released") &&
          record.release_status !== manifest.release_status) {
        issues.push({ path: `${recordPath}.release_status`, message: "must match manifest release_status" });
      }
      if (isRecord(geography)) {
        for (const key of ["geography_name", "geography_type", "state_fips", "county_fips"]) {
          if (record[key] !== geography[key]) {
            issues.push({ path: `${recordPath}.${key}`, message: "must match local_artifact.geography" });
          }
        }
      }
      if (isNonEmptyString(record.source_ref) && !sourceRefs.has(record.source_ref)) {
        issues.push({ path: `${recordPath}.source_ref`, message: "must reference local_artifact.sources" });
      }
    });
  }

  return issues;
}

export function assertValidLocalContextArtifact(value: unknown): asserts value is LocalContextArtifact {
  const issues = validateLocalContextArtifact(value);
  if (issues.length > 0) {
    throw new Error(
      `Invalid Diagnostic Odyssey local-context artifact:\n${issues.map(i => `- ${i.path}: ${i.message}`).join("\n")}`
    );
  }
}

export function canLoadReviewedLocalContextArtifact(
  artifact: unknown
): artifact is LocalContextArtifact {
  if (validateLocalContextArtifact(artifact).length > 0) return false;
  const reviewed = artifact as LocalContextArtifact;
  return reviewed.manifest.release_status === "reviewed_released" &&
    reviewed.indicators.length > 0 &&
    reviewed.indicators.every(record => record.release_status === "reviewed_released");
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

export function validateDataRequest(
  value: unknown,
  path = "data_request"
): ValidationIssue[] {
  if (!isRecord(value)) return [{ path, message: "must be an object" }];
  const issues: ValidationIssue[] = [];

  for (const key of [
    "request_id",
    "target_question",
    "pathway_step",
    "likely_source_owner",
    "granularity_time_window",
    "rationale",
    "feasibility_privacy_notes"
  ]) {
    if (!isNonEmptyString(value[key])) {
      issues.push({ path: `${path}.${key}`, message: "must be a non-empty string" });
    }
  }

  if (
    value.target_mechanism !== undefined &&
    value.target_mechanism !== null &&
    !isNonEmptyString(value.target_mechanism)
  ) {
    issues.push({
      path: `${path}.target_mechanism`,
      message: "must be null or a non-empty string"
    });
  }

  if (
    !Array.isArray(value.fields_needed) ||
    value.fields_needed.some(item => !isNonEmptyString(item))
  ) {
    issues.push({
      path: `${path}.fields_needed`,
      message: "must be an array of non-empty strings"
    });
  }

  return issues;
}

export function validateArtifactBundle(value: unknown): ValidationIssue[] {
  if (!isRecord(value)) return [{ path: "artifact", message: "must be an object" }];
  const issues: ValidationIssue[] = [];

  const manifest = value.manifest;
  const context = value.context;

  if (!isRecord(manifest)) {
    issues.push({ path: "artifact.manifest", message: "must be an object" });
  } else {
    for (const key of ["artifact_version", "generated_at", "code_commit", "run_id"]) {
      if (!isNonEmptyString(manifest[key])) {
        issues.push({ path: `artifact.manifest.${key}`, message: "must be a non-empty string" });
      }
    }
    if (!oneOf(manifest.display_status, displayStatuses)) {
      issues.push({ path: "artifact.manifest.display_status", message: "invalid display status" });
    }
    if (!Array.isArray(manifest.dataset_releases) ||
        manifest.dataset_releases.length === 0 ||
        manifest.dataset_releases.some(item => !isNonEmptyString(item))) {
      issues.push({
        path: "artifact.manifest.dataset_releases",
        message: "must contain at least one non-empty dataset release"
      });
    }
  }

  if (!isRecord(context)) {
    issues.push({ path: "artifact.context", message: "must be an object" });
  } else {
    for (const key of ["condition_id", "cohort_id", "age_range", "geography_scope", "artifact_version"]) {
      if (!isNonEmptyString(context[key])) {
        issues.push({ path: `artifact.context.${key}`, message: "must be a non-empty string" });
      }
    }
    if (typeof context.evidence_year !== "number" || !Number.isFinite(context.evidence_year)) {
      issues.push({ path: "artifact.context.evidence_year", message: "must be a finite number" });
    }
    if (isRecord(manifest) &&
        isNonEmptyString(manifest.artifact_version) &&
        context.artifact_version !== manifest.artifact_version) {
      issues.push({
        path: "artifact.context.artifact_version",
        message: "must match artifact.manifest.artifact_version"
      });
    }
  }

  if (!Array.isArray(value.sources) || value.sources.length === 0) {
    issues.push({ path: "artifact.sources", message: "must contain at least one source record" });
  } else {
    value.sources.forEach((source, index) => {
      const path = `artifact.sources[${index}]`;
      if (!isRecord(source)) {
        issues.push({ path, message: "must be an object" });
        return;
      }
      for (const key of ["source_ref", "source_name", "locator"]) {
        if (!isNonEmptyString(source[key])) {
          issues.push({ path: `${path}.${key}`, message: "must be a non-empty string" });
        }
      }
      if (typeof source.official_url !== "string") {
        issues.push({ path: `${path}.official_url`, message: "must be a string" });
      }
      if (typeof source.release_year !== "number" || !Number.isFinite(source.release_year)) {
        issues.push({ path: `${path}.release_year`, message: "must be a finite number" });
      }
    });
  }

  const sourceRefs = new Set(
    Array.isArray(value.sources)
      ? value.sources
          .filter(isRecord)
          .map(source => source.source_ref)
          .filter(isNonEmptyString)
      : []
  );

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
          const estimatePath = `artifact.burden_domains[${domainIndex}].measures[${estimateIndex}]`;
          issues.push(...validateEstimate(estimate, estimatePath));
          if (isRecord(estimate)) {
            if (isRecord(manifest) &&
                isNonEmptyString(manifest.artifact_version) &&
                estimate.artifact_version !== manifest.artifact_version) {
              issues.push({
                path: `${estimatePath}.artifact_version`,
                message: "must match artifact.manifest.artifact_version"
              });
            }
            if (isNonEmptyString(estimate.source_ref) && !sourceRefs.has(estimate.source_ref)) {
              issues.push({
                path: `${estimatePath}.source_ref`,
                message: "must reference an artifact.sources entry"
              });
            }
          }
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

  if (!Array.isArray(value.data_requests)) {
    issues.push({ path: "artifact.data_requests", message: "must be an array" });
  } else {
    value.data_requests.forEach((request, index) => {
      issues.push(...validateDataRequest(request, `artifact.data_requests[${index}]`));
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

export const canDisplayDistributionSummary = (estimate: Estimate): boolean =>
  canExportEstimate(estimate) &&
  estimate.distribution_summary !== undefined &&
  validateEstimate(estimate).length === 0;
