import type {
  PlanningGuidanceInputV1,
  VerifiedAuthority,
  ModelCandidateV1,
} from "../../packages/planning-guidance/src/types.ts";
import {fingerprint} from "../../packages/planning-guidance/src/index.ts";

const hex = "a".repeat(64);

export function createSyntheticFixture(): {
  input: PlanningGuidanceInputV1;
  authority: VerifiedAuthority;
  snapshotFingerprint: string;
  expectedCandidate: ModelCandidateV1;
} {
  const context = {
    condition_id: "long_covid",
    cohort_id: "adult",
    population_id: "adults",
    setting_id: "outpatient",
    payer_id: "all_payers",
    geography_id: "national",
    pathway_step_id: "referral",
    mechanism_id: "delay",
  };

  const key = [
    context.condition_id,
    context.cohort_id,
    context.population_id,
    context.setting_id,
    context.payer_id,
    context.geography_id,
    context.pathway_step_id,
    context.mechanism_id,
  ].join("|");

  const eligibleRef = {
    id: "ref_intervention_01",
    claim_code: "expedited_referral_protocol",
    context_key: key,
    allowed_use: "planning_option_to_investigate" as const,
    applicability_decision_id: "decision_01",
  };

  const backgroundRef = {
    id: "ref_background_01",
    claim_code: "epidemiology_background",
    context_key: key,
    allowed_use: "background_context_only" as const,
    applicability_decision_id: "decision_02",
  };

  const hint01 = {
    id: "hint_01",
    template_id: "template_referral_01",
    context_key: key,
  };

  const authority: VerifiedAuthority = {
    narrative: {
      release_sha256: hex,
      review_sha256: hex,
      applicability_sha256: hex,
      applicability_policy_version: "policy_v1",
      applicability_policy_sha256: hex,
      references: [eligibleRef, backgroundRef],
    },
    hints: {
      release_sha256: hex,
      policy_sha256: hex,
      hints: [hint01],
    },
  };

  const input: PlanningGuidanceInputV1 = {
    schema_version: "pg.v1",
    captured_at: "2026-10-21T10:00:00Z",
    versions: {
      national_release_id: "MEPS2024",
      national_release_sha256: hex,
      brief_version: "brief_v1",
      brief_content_sha256: hex,
      scenario_revision: "scenario_v1",
      scenario_content_sha256: hex,
      local_release_id: null,
      local_release_sha256: null,
      request_policy_id: "policy_req_v1",
      request_policy_sha256: hex,
    },
    context,
    national_estimate_count: 21,
    national_findings: [
      {
        id: "finding_meps_01",
        source_id: "MEPS",
        estimate_id: "MEPS-EST-1",
        value: 12.5,
        unit_code: "persons",
        role: "national_reviewed",
        uncertainty_kind: "confidence_interval",
        lower: 10.0,
        upper: 15.0,
      },
      {
        id: "finding_meps_02",
        source_id: "MEPS",
        estimate_id: "MEPS-EST-2",
        value: 45.0,
        unit_code: "days",
        role: "national_reviewed",
        uncertainty_kind: "confidence_interval",
        lower: 38.0,
        upper: 52.0,
      },
    ],
    selected_local_context: [],
    scenario_assumptions: [
      {
        id: "assumption_01",
        source_id: "analyst",
        value: 0.15,
        unit_code: "fraction",
        role: "analyst_assumption",
      },
    ],
    deterministic_results: [
      {
        id: "result_01",
        source_id: "engine",
        value: 350,
        unit_code: "person_months",
        role: "deterministic_planning_result",
        metric_code: "person_months",
      },
    ],
    warnings: [
      {id: "warn_planning_not_effect", code: "planning_not_effect"},
      {id: "warn_observational_data", code: "observational_data"},
    ],
    gaps: [
      {
        id: "gap_referral_delay",
        pathway_step_id: "referral",
        mechanism_id: "delay",
      },
    ],
    request_templates: [
      {
        id: "template_referral_01",
        gap_id: "gap_referral_delay",
        field_codes: ["referral_date", "wait_time_days"],
        owner_code: "clinic",
        granularity_code: "aggregate",
        window_code: "monthly",
        privacy_code: "aggregate_only",
      },
    ],
    narrative_admission: {
      release_sha256: hex,
      review_sha256: hex,
      applicability_sha256: hex,
      applicability_policy_version: "policy_v1",
      applicability_policy_sha256: hex,
      references: [eligibleRef, backgroundRef],
    },
    hint_admission: {
      release_sha256: hex,
      policy_sha256: hex,
      hints: [hint01],
    },
  };

  const snapshotFingerprint = fingerprint(input, authority);

  const expectedCandidate: ModelCandidateV1 = {
    schema_version: "pg.v1",
    snapshot_fingerprint: snapshotFingerprint,
    finding_ids: ["finding_meps_01"],
    options: [
      {
        reference_id: "ref_intervention_01",
        claim_code: "expedited_referral_protocol",
      },
    ],
    requests: [
      {
        template_id: "template_referral_01",
        gap_id: "gap_referral_delay",
        hint_id: "hint_01",
      },
    ],
  };

  return {
    input,
    authority,
    snapshotFingerprint,
    expectedCandidate,
  };
}
