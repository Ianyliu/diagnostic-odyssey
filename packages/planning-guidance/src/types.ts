export const VERSION = "pg.v1" as const;
export type Id = string;
export type Digest = string;
/** All eight dimensions must be explicitly adjudicated; no implicit wildcard/transfer. */
export type Context = {
  condition_id: Id; cohort_id: Id; population_id: Id; setting_id: Id; payer_id: Id;
  geography_id: Id; pathway_step_id: Id; mechanism_id: Id;
};
export type NumericRecord = {
  id: Id; source_id: Id; value: number; unit_code: Id;
  role: "national_reviewed"|"local_context"|"analyst_assumption"|"deterministic_planning_result";
};
export type AllowedUse = "planning_option_to_investigate"|"background_context_only";
export type Reference = {
  id: Id; claim_code: Id; context_key: string;
  allowed_use: AllowedUse; applicability_decision_id: Id;
};
export type Hint = {id: Id; template_id: Id; context_key: string};
export type PlanningGuidanceInputV1 = {
  schema_version: typeof VERSION;
  captured_at: string; // audit only; deliberately excluded from canonical content
  versions: {
    national_release_id: Id; national_release_sha256: Digest;
    brief_version: Id; brief_content_sha256: Digest;
    scenario_revision: Id; scenario_content_sha256: Digest;
    local_release_id: Id|null; local_release_sha256: Digest|null;
    request_policy_id: Id; request_policy_sha256: Digest;
  };
  context: Context;
  national_estimate_count: 21;
  national_findings: (NumericRecord & {role:"national_reviewed"; estimate_id:Id; uncertainty_kind:"iqr"|"confidence_interval"|"none"; lower:number|null; upper:number|null})[];
  selected_local_context: (NumericRecord & {role:"local_context"; vintage_id:Id})[];
  scenario_assumptions: (NumericRecord & {role:"analyst_assumption"})[];
  deterministic_results: (NumericRecord & {role:"deterministic_planning_result"; metric_code:"person_months"|"planning_count"|"resource_units"})[];
  warnings: {id:Id; code:Id}[];
  gaps: {id:Id; pathway_step_id:Id; mechanism_id:Id}[];
  request_templates: {id:Id; gap_id:Id; field_codes:Id[]; owner_code:Id; granularity_code:Id; window_code:Id; privacy_code:Id}[];
  narrative_admission: {
    release_sha256:Digest|null; review_sha256:Digest|null; applicability_sha256:Digest|null;
    applicability_policy_version:Id|null; applicability_policy_sha256:Digest|null;
    references:Reference[];
  };
  hint_admission: {release_sha256:Digest|null; policy_sha256:Digest|null; hints:Hint[]};
};
/** A separate trusted application verifier must authenticate immutable release and review bytes,
 * external reviewer decisions and exact applicability-policy context; typing/hash shape does not authenticate.
 */
export type VerifiedAuthority = {
  narrative:null|{
    release_sha256:Digest; review_sha256:Digest; applicability_sha256:Digest;
    applicability_policy_version:Id; applicability_policy_sha256:Digest;
    references:Reference[];
  };
  hints:null|{release_sha256:Digest; policy_sha256:Digest; hints:Hint[]};
};
export type ModelEgressV1 = {
  schema_version:typeof VERSION; snapshot_fingerprint:string; context:Context;
  finding_ids:Id[]; local_ids:Id[]; assumption_ids:Id[]; result_ids:Id[];
  warning_ids:Id[]; gap_ids:Id[]; template_ids:Id[];
  references:{id:Id;claim_code:Id}[]; hint_ids:Id[];
};
/** Warnings are NOT model-selectable; the trusted app always injects all warnings. */
export type ModelCandidateV1 = {
  schema_version:typeof VERSION; snapshot_fingerprint:string;
  finding_ids:Id[]; options:{reference_id:Id;claim_code:Id}[];
  requests:{template_id:Id;gap_id:Id;hint_id:Id|null}[];
};
export type PlanningGuidanceOutputV1 = {
  schema_version:typeof VERSION; snapshot_fingerprint:string;
  generation:{state:"available"|"unavailable"|"invalid"|"stale";id:Id|null;at:string|null};
  sections:{
    findings:"available"|"insufficient_evidence"|"unavailable";
    interventions:"available"|"insufficient_evidence"|"unavailable";
    requests:"available"|"insufficient_evidence"|"unavailable";
  };
  supported_findings:PlanningGuidanceInputV1["national_findings"];
  intervention_options:{
    proposal_id:string;reference_id:Id;claim_code:Id;release_sha256:Digest;
    applicability_decision_id:Id;applicability_policy_sha256:Digest;
    disposition:"pending";
  }[];
  draft_requests:{
    proposal_id:string;template:PlanningGuidanceInputV1["request_templates"][number];
    hint_id:Id|null;disposition:"pending";
  }[];
  warnings:PlanningGuidanceInputV1["warnings"];
  boundary:"AI_assisted_draft_independently_verify"|"no_model_execution";
};
