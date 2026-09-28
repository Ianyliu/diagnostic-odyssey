export type LinkedConditionReliabilityStatus = "not_adjudicated";

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
const candidateIdSet = new Set<string>(linkedConditionCandidateIds);
const sourceRefSet = new Set<string>(linkedConditionCandidateSourceRefs);

const supportKeys = [
  "label",
  "unweighted_person_n",
  "represented_strata_n",
  "represented_stratum_psu_pairs_n",
  "represented_singleton_strata_l"
] as const;