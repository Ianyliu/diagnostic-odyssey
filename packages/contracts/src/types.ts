import type { EvidenceType, ReleaseStatus, DisplayStatus, AdmissibilityStatus, DataState } from "./constants.ts";

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

/** Optional identity only. Guidance text is resolved from a separately admitted registry. */
export interface AcquisitionHintReference {
  schema_version: "1";
  hint_id: "ACQ26-TIMING-01" | "ACQ26-CAPACITY-01";
  hint_version: "2";
  registry_sha256: string;
  policy_sha256: string;
  source_index_sha256: string;
  review_sha256: string;
  request_fingerprint: string;
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
  acquisition_hint?: AcquisitionHintReference;
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
