import assert from "node:assert/strict";
import test from "node:test";
import { canDriveScenarioParameter, evidenceClaimLabel } from "../src/index.ts";
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

for (const reviewer_status of ["draft", "needs_review", "rejected"] as const) {
  test(`unapproved ${reviewer_status} evidence cannot drive scenario parameters`, () => {
    assert.deepEqual(canDriveScenarioParameter({...evidence, reviewer_status}, scenario), {
      allowed: false,
      reason: "Evidence has not been approved by a human reviewer."
    });
  });
}

for (const admissibility_status of ["limited_use", "insufficient"] as const) {
  test(`${admissibility_status} evidence cannot drive quantitative scenario parameters`, () => {
    assert.deepEqual(canDriveScenarioParameter({...evidence, admissibility_status}, scenario), {
      allowed: false,
      reason: "Admissibility does not permit quantitative scenario use."
    });
  });
}

for (const pathway_step of [undefined, null, "", "different-step"]) {
  test(`missing or mismatched pathway step ${String(pathway_step)} is blocked`, () => {
    const record = {...evidence};
    if (pathway_step === undefined) delete record.pathway_step;
    else record.pathway_step = pathway_step;
    assert.deepEqual(canDriveScenarioParameter(record, scenario), {
      allowed: false,
      reason: "Evidence does not support the scenario target pathway step."
    });
  });
}

for (const target_mechanism of [undefined, null, "", "telehealth"]) {
  test(`missing or mismatched mechanism ${String(target_mechanism)} is blocked`, () => {
    const record = {...evidence};
    if (target_mechanism === undefined) delete record.target_mechanism;
    else record.target_mechanism = target_mechanism;
    assert.deepEqual(canDriveScenarioParameter(record, scenario), {
      allowed: false,
      reason: "Evidence does not support the scenario target mechanism."
    });
  });
}

for (const admissibility_status of ["supported", "supported_with_bounds"] as const) {
  test(`${admissibility_status} reviewed evidence permits exact bounded step and mechanism use`, () => {
    assert.deepEqual(canDriveScenarioParameter({...evidence, admissibility_status}, scenario), {
      allowed: true,
      reason: "Reviewed evidence is admissible for this bounded step/mechanism use."
    });
  });
}

test("all governed admissibility states have a human-readable claim label", () => {
  const labels = {
    supported: "Supported",
    supported_with_bounds: "Supported with bounds",
    limited_use: "Limited use",
    insufficient: "Insufficient evidence"
  } as const;
  for (const admissibility_status of Object.keys(labels) as Array<keyof typeof labels>) {
    assert.equal(evidenceClaimLabel({...evidence, admissibility_status}), labels[admissibility_status]);
  }
});
