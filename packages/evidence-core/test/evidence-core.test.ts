import assert from "node:assert/strict";
import test from "node:test";
import { canDriveScenarioParameter } from "../src/index.ts";
import type { EvidenceRecord, Scenario } from "@diagnostic-odyssey/contracts";

const scenario: Scenario = {
  scenario_id:"s", eligible_population:100, reach:0.5, capacity:50,
  baseline_window_months:12, alternative_window_months:6, horizon_months:12,
  fixed_cost:0, per_participant_cost:0,
  target_pathway_step:"recognition-to-referral", mechanism:"navigation-support",
  assumption_refs:[], artifact_version:"v1"
};
const evidence: EvidenceRecord = {
  evidence_id:"e", source:"paper", locator:"table 2", population:"adults",
  condition_definition:"condition", outcome:"referral", effect_or_parameter:"range",
  uncertainty:null, system_boundary:"care pathway",
  pathway_step:"recognition-to-referral", target_mechanism:"navigation-support",
  geography:"US", payer:"all", year:2025, limitations:[],
  reviewer_status:"approved", admissibility_status:"supported_with_bounds",
  allowed_use:"bounded planning parameter"
};
test("reviewed step-specific evidence can drive a matching scenario parameter", () => {
  assert.equal(canDriveScenarioParameter(evidence, scenario).allowed, true);
});
test("mismatched mechanism is blocked", () => {
  assert.equal(canDriveScenarioParameter({...evidence,target_mechanism:"telehealth"}, scenario).allowed, false);
});
