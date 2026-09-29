import assert from "node:assert/strict";
import test from "node:test";
import type { EvidenceRecord, Scenario } from "@diagnostic-odyssey/contracts";
import {
  getEvidenceParameterReadiness,
  getNationalBurdenReadiness
} from "../src/data/workspaceReadiness.ts";

const scenario: Scenario = {
  scenario_id: "readiness-check",
  eligible_population: 100,
  reach: 0.5,
  capacity: 50,
  baseline_window_months: 12,
  alternative_window_months: 6,
  horizon_months: 12,
  fixed_cost: 100,
  per_participant_cost: 10,
  target_pathway_step: "recognition-to-referral",
  mechanism: "navigation-support",
  assumption_refs: [],
  artifact_version: "test"
};

const evidence: EvidenceRecord = {
  evidence_id: "readiness-evidence",
  source: "Test source",
  locator: "test",
  population: "Test population",
  condition_definition: "Test definition",
  outcome: "Test outcome",
  effect_or_parameter: null,
  uncertainty: null,
  system_boundary: "Test boundary",
  pathway_step: "recognition-to-referral",
  target_mechanism: "navigation-support",
  geography: "United States",
  payer: "all",
  year: 2026,
  limitations: [],
  reviewer_status: "approved",
  admissibility_status: "supported_with_bounds",
  allowed_use: "Bounded planning use"
};

test("burden status does not claim review when no finding passes the release gate", () => {
  assert.equal(getNationalBurdenReadiness(0).tone, "unavailable");
  assert.match(getNationalBurdenReadiness(0).briefStatus, /No released/);
  assert.equal(getNationalBurdenReadiness(21).tone, "reviewed");
});

test("Brief evidence readiness keeps approval and scenario eligibility distinct", () => {
  assert.equal(getEvidenceParameterReadiness([], scenario).tone, "unavailable");
  assert.equal(getEvidenceParameterReadiness([{ ...evidence, reviewer_status: "pending" }], scenario).tone, "unavailable");
  assert.match(getEvidenceParameterReadiness([evidence], null).status, /scenario not checked/);
  assert.match(getEvidenceParameterReadiness([{ ...evidence, admissibility_status: "limited_use" }], scenario).status, /No eligible/);
  assert.match(getEvidenceParameterReadiness([evidence], { ...scenario, mechanism: "diagnostic-assessment" }).status, /No eligible/);
  assert.equal(getEvidenceParameterReadiness([evidence], scenario).status, "1 eligible for bounded use");
  assert.equal(getEvidenceParameterReadiness([evidence], scenario).tone, "neutral");
});
