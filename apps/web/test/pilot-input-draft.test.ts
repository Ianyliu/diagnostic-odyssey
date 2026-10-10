import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { Scenario, ScenarioResult } from "@diagnostic-odyssey/contracts";
import { buildSensitivityValues } from "../src/data/decisionVisuals.ts";
import {
  createPilotInputDraft,
  evaluatePilotInputDraft,
  formatPilotInputHelper,
  formatPilotResultAnnouncement
} from "../src/data/pilotInputDraft.ts";

const scenario: Scenario = {
  scenario_id: "test",
  eligible_population: 12000,
  reach: 0.25,
  capacity: 3000,
  baseline_window_months: 12,
  alternative_window_months: 6,
  horizon_months: 12,
  fixed_cost: 300000,
  per_participant_cost: 300,
  target_pathway_step: "recognition-to-referral",
  mechanism: "navigation-support",
  assumption_refs: [],
  artifact_version: "test"
};

const pilotSource = readFileSync(
  fileURLToPath(new URL("../src/pages/PilotPage.tsx", import.meta.url)),
  "utf8"
);

test("blank draft is invalid and never becomes explicit zero", () => {
  const draft = createPilotInputDraft(scenario);
  draft.eligible_population = "";
  const result = evaluatePilotInputDraft(draft, scenario);

  assert.equal(result.candidate, null);
  assert.equal(result.errors.eligible_population, "Enter a value.");
  assert.equal(scenario.eligible_population, 12000);
});

test("incomplete numeric edit states remain local drafts", () => {
  for (const raw of ["-", "1."]) {
    const draft = createPilotInputDraft(scenario);
    draft.eligible_population = raw;
    const result = evaluatePilotInputDraft(draft, scenario);
    assert.equal(result.candidate, null);
    assert.equal(scenario.eligible_population, 12000);
  }
});

test("explicit zero commits wherever the scenario contract permits zero", () => {
  const eligibleDraft = createPilotInputDraft(scenario);
  eligibleDraft.eligible_population = "0";
  const eligible = evaluatePilotInputDraft(eligibleDraft, scenario);
  assert.equal(eligible.candidate?.eligible_population, 0);

  const reachDraft = createPilotInputDraft(scenario);
  reachDraft.reach = "0";
  const reach = evaluatePilotInputDraft(reachDraft, scenario);
  assert.equal(reach.candidate?.reach, 0);
});

test("negative capacity and reach above 100 percent are rejected through contract validation", () => {
  const negative = createPilotInputDraft(scenario);
  negative.capacity = "-1";
  const negativeResult = evaluatePilotInputDraft(negative, scenario);
  assert.equal(negativeResult.candidate, null);
  assert.match(negativeResult.errors.capacity ?? "", /non-negative/i);

  const reach = createPilotInputDraft(scenario);
  reach.reach = "101";
  const reachResult = evaluatePilotInputDraft(reach, scenario);
  assert.equal(reachResult.candidate, null);
  assert.match(reachResult.errors.reach ?? "", /0 to 100/);
});

test("reach preserves exact decimal intent without whole-percent rounding", () => {
  const draft = createPilotInputDraft(scenario);
  draft.reach = "25.1234567";
  const result = evaluatePilotInputDraft(draft, scenario);
  assert.ok(result.candidate);
  assert.equal(result.candidate.reach, 0.251234567);
  assert.equal(
    createPilotInputDraft({...scenario, reach: 0.251234567}).reach,
    "25.1234567"
  );
});

test("reach Scenario-to-draft conversion avoids binary floating-point garbage", () => {
  const cases = [
    [0, "0"],
    [0.07, "7"],
    [0.29, "29"],
    [0.25, "25"],
    [0.251234567, "25.1234567"],
    [0.0000004, "0.00004"],
    [0.9999996, "99.99996"],
    [1, "100"]
  ] as const;

  for (const [reach, expectedDraft] of cases) {
    assert.equal(createPilotInputDraft({...scenario, reach}).reach, expectedDraft);
  }

  const drafts = cases.map(([reach]) =>
    createPilotInputDraft({...scenario, reach}).reach
  );
  for (const garbage of [
    "28.999999999999996",
    "7.000000000000001",
    "25.123456700000002",
    "0.000039999999999999996"
  ]) {
    assert.ok(!drafts.includes(garbage));
  }
});

test("reach Scenario-to-draft-to-Scenario round trip is strict", () => {
  for (const reach of [
    0,
    0.07,
    0.29,
    0.25,
    0.251234567,
    0.0000004,
    0.9999996,
    1
  ]) {
    const source = {...scenario, reach};
    const draft = createPilotInputDraft(source);
    const evaluated = evaluatePilotInputDraft(draft, source);
    assert.equal(evaluated.candidate?.reach, reach);
  }
});

test("reach draft decimal shifting supports scientific notation without binary scaling", () => {
  const twentyNine = createPilotInputDraft(scenario);
  twentyNine.reach = "2.9e1";
  assert.equal(evaluatePilotInputDraft(twentyNine, scenario).candidate?.reach, 0.29);

  const tiny = createPilotInputDraft(scenario);
  tiny.reach = "4e-5";
  assert.equal(evaluatePilotInputDraft(tiny, scenario).candidate?.reach, 0.0000004);
});

test("cross-field recovery constructs the candidate from all current drafts", () => {
  const draft = createPilotInputDraft(scenario);
  draft.baseline_window_months = "5";

  const invalid = evaluatePilotInputDraft(draft, scenario);
  assert.equal(invalid.candidate, null);
  assert.match(
    invalid.errors.alternative_window_months ?? "",
    /cannot exceed baseline recognition window/i
  );

  draft.alternative_window_months = "4";
  const recovered = evaluatePilotInputDraft(draft, scenario);
  assert.ok(recovered.candidate);
  assert.equal(recovered.candidate.baseline_window_months, 5);
  assert.equal(recovered.candidate.alternative_window_months, 4);
});

test("invalid draft evaluation never mutates the committed scenario object", () => {
  const before = structuredClone(scenario);
  const draft = createPilotInputDraft(scenario);
  draft.capacity = "-1";
  evaluatePilotInputDraft(draft, scenario);
  assert.deepEqual(scenario, before);
});

test("large-number helpers are readable presentation without changing stored precision", () => {
  assert.equal(formatPilotInputHelper("eligible_population", "12000"), "12,000 people");
  assert.equal(formatPilotInputHelper("capacity", "3000"), "3,000 participants capacity");
  assert.equal(formatPilotInputHelper("fixed_cost", "300000"), "$300,000");
  assert.equal(formatPilotInputHelper("per_participant_cost", "300"), "$300 per participant");
  assert.equal(formatPilotInputHelper("reach", "25.1"), "25.1% intended reach");
  assert.equal(formatPilotInputHelper("alternative_window_months", "6"), "6 months");
});

test("invalid drafts pause sensitivity and the Pilot Brief action while keeping last-valid results explicit", () => {
  assert.match(pilotSource, /Draft not applied/);
  assert.match(
    pilotSource,
    /Fix the Pilot planner inputs before running sensitivity analysis or creating data requests\./
  );
  assert.match(
    pilotSource,
    /Apply valid planning inputs before continuing from this draft\./
  );
  assert.match(
    pilotSource,
    /invalidDraft \? <section id="sensitivity"[\s\S]*?: <SensitivityExplorer/
  );
  assert.match(pilotSource, /disabled>Preview Planning Brief<\/button>/);
});

test("Pilot numeric fields expose stable labels, invalid state, descriptions, and polite validation updates", () => {
  assert.match(pilotSource, /htmlFor=\{inputId\}/);
  assert.match(pilotSource, /id=\{inputId\}/);
  assert.match(pilotSource, /inputMode="decimal"/);
  assert.match(pilotSource, /aria-invalid=\{Boolean\(error\)\}/);
  assert.match(pilotSource, /aria-describedby=\{helperId \+ " " \+ errorId\}/);
  assert.match(pilotSource, /className="field-error" aria-live="polite"/);
});

test("result live announcement is concise, applied-result based, and avoids forecast or savings wording", () => {
  const result: ScenarioResult = {
    scenario_id: "test",
    intended_reach: 3000,
    reached_participants: 3000,
    capacity_gap: 0,
    baseline_person_months: 36000,
    alternative_person_months: 18000,
    difference_person_months: 18000,
    fixed_program_cost: 300000,
    variable_program_cost: 900000,
    program_resource_requirement: 1200000,
    target_pathway_step: "recognition-to-referral",
    target_mechanism: "navigation-support"
  };
  const announcement = formatPilotResultAnnouncement(result);

  assert.equal(
    announcement,
    "Planning results updated. Reached participants 3,000. Capacity gap 0. Program-resource requirement $1,200,000."
  );
  assert.doesNotMatch(announcement, /forecast/i);
  assert.doesNotMatch(announcement, /savings/i);
  assert.match(pilotSource, /aria-live="polite" aria-atomic="true"/);
  assert.match(pilotSource, /useRef\(getPilotResultSignature\(scenarioResult\)\)/);
});

test("exact sensitivity-current regressions remain intact for precise reach and zero capacity", () => {
  const precise = buildSensitivityValues({...scenario, reach: 0.251234567}, "reach");
  assert.ok(precise.includes(0.251234567));

  const nearZero = buildSensitivityValues({...scenario, reach: 0.0000004}, "reach");
  assert.ok(nearZero.includes(0));
  assert.ok(nearZero.includes(0.0000004));

  const nearOne = buildSensitivityValues({...scenario, reach: 0.9999996}, "reach");
  assert.ok(nearOne.includes(0.9999996));
  assert.ok(nearOne.includes(1));
  assert.notEqual(0.9999996, 1);

  const zeroCapacity = buildSensitivityValues({...scenario, capacity: 0}, "capacity");
  assert.ok(zeroCapacity.includes(0));
});

test("extreme exponents and overlong numbers are bounded and cannot silently become zero", () => {
  for (const raw of ["1e-999999999", "1e999999999", "1e-324", "1".repeat(1025)]) {
    const draft = createPilotInputDraft(scenario);
    draft.reach = raw;
    const result = evaluatePilotInputDraft(draft, scenario);
    assert.equal(result.candidate, null, raw.slice(0, 20));
    assert.ok(result.errors.reach);
    assert.equal(scenario.reach, 0.25);
    assert.equal(formatPilotInputHelper("reach", raw), null);
  }
});

test("percentage conversion rejects underflow but preserves exact zero and representable subnormals", () => {
  const draft = createPilotInputDraft(scenario);
  draft.reach = "5e-324";
  assert.equal(evaluatePilotInputDraft(draft, scenario).candidate, null);
  assert.match(evaluatePilotInputDraft(draft, scenario).errors.reach ?? "", /too small/);
  for (const raw of ["0", "0e-999999999", "0e999999999"]) {
    draft.reach = raw;
    assert.equal(evaluatePilotInputDraft(draft, scenario).candidate?.reach, 0);
  }
  const subnormal = {...scenario, reach: Number.MIN_VALUE};
  assert.equal(evaluatePilotInputDraft(createPilotInputDraft(subnormal), subnormal).candidate?.reach, Number.MIN_VALUE);
});

test("overflowing draft calculations retain the last applied scenario and offer corrective guidance", () => {
  const applied = structuredClone(scenario);
  const draft = createPilotInputDraft(applied);
  draft.per_participant_cost = "1e308";
  const evaluation = evaluatePilotInputDraft(draft, applied);
  assert.equal(evaluation.candidate, null);
  assert.match(evaluation.formError ?? "", /Reduce population, recognition windows, or program costs/);
  assert.deepEqual(applied, scenario);
  draft.per_participant_cost = "0";
  assert.equal(evaluatePilotInputDraft(draft, applied).candidate?.per_participant_cost, 0);
});
