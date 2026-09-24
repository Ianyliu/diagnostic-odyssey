import type { DataRequest, Scenario } from "@diagnostic-odyssey/contracts";
import type { SensitivityField } from "./decisionVisuals";

export function sensitivityDataRequestId(field: SensitivityField): string {
  return `session.sensitivity.${field}`;
}

export function createSensitivityDataRequest(
  scenario: Scenario,
  field: SensitivityField
): DataRequest {
  if (field === "capacity") {
    return {
      request_id: sensitivityDataRequestId(field),
      target_question: "What provider/program capacity is actually available for the proposed recognition-to-referral pilot?",
      pathway_step: scenario.target_pathway_step,
      fields_needed: [
        "staffed program capacity",
        "available appointment or navigation slots",
        "specialty/service type",
        "catchment geography",
        "wait time",
        "staffing FTE",
        "capacity time window"
      ],
      likely_source_owner: "Program operations, provider network, or participating health system",
      granularity_time_window: `Program/site level during the ${scenario.horizon_months}-month planning horizon`,
      rationale: `The current scenario assumes capacity of ${Math.round(scenario.capacity).toLocaleString()} participants. One-way sensitivity shows capacity directly changes the modeled capacity gap, so local capacity should be verified before operational planning.`,
      feasibility_privacy_notes: "Prefer aggregate operational capacity and scheduling data. Individual identifiers are not required for this planning question."
    };
  }

  if (field === "reach") {
    return {
      request_id: sensitivityDataRequestId(field),
      target_question: "What share of the eligible population can the pilot realistically identify, contact, and enroll?",
      pathway_step: scenario.target_pathway_step,
      fields_needed: [
        "eligible population denominator",
        "people identified for outreach",
        "people successfully contacted",
        "people offered navigation",
        "people enrolled or accepting navigation",
        "referral completion status"
      ],
      likely_source_owner: "Program operations, outreach partner, or participating payer/health system",
      granularity_time_window: `Monthly or quarterly during the ${scenario.horizon_months}-month planning horizon`,
      rationale: `The current scenario assumes intended reach of ${(scenario.reach * 100).toFixed(0)}%. One-way sensitivity shows reach changes intended demand and may create or remove a capacity gap.`,
      feasibility_privacy_notes: "Aggregate funnel counts are sufficient for initial planning. Any record linkage should use the minimum necessary data and an approved governance process."
    };
  }

  return {
    request_id: sensitivityDataRequestId(field),
    target_question: "What recognition-to-referral timing is observed now, and what timing is operationally feasible under the proposed navigation workflow?",
    pathway_step: scenario.target_pathway_step,
    fields_needed: [
      "recognition or qualifying milestone date",
      "referral date",
      "scheduled appointment date",
      "completed appointment date",
      "cancellation or no-show indicator",
      "specialty/service type"
    ],
    likely_source_owner: "Participating health system, referral/navigation program, or payer care-management team",
    granularity_time_window: `Episode-level timing summarized over the ${scenario.horizon_months}-month planning horizon`,
    rationale: `The current planning scenario uses a ${scenario.alternative_window_months}-month recognition window versus a ${scenario.baseline_window_months}-month baseline assumption. These are planning assumptions, not observed intervention effects, and should be checked against operational timing data.`,
    feasibility_privacy_notes: "Use de-identified or aggregate interval summaries when possible. Timing data can improve planning but do not by themselves establish a causal intervention effect."
  };
}
