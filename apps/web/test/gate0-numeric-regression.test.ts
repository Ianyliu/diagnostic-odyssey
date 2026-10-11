import assert from "node:assert/strict";
import test from "node:test";
import { createPlanningScenarioDefaults } from "../src/data/planningScenarioDefaults.ts";
import { createPilotInputDraft, evaluatePilotInputDraft } from "../src/data/pilotInputDraft.ts";
import { formatPlanningNumber, formatPlanningCurrency } from "../src/data/planningNumberFormatting.ts";

test("underflow and scaled underflow retain the applied scenario without allocating exponent-sized strings", () => {
  const scenario = createPlanningScenarioDefaults();
  const original = structuredClone(scenario);
  for (const reach of ["1e-1000000000", "5e-324"]) {
    const result = evaluatePilotInputDraft({...createPilotInputDraft(scenario), reach}, scenario);
    assert.equal(result.candidate, null);
    assert.match(result.errors.reach ?? "", /too small/);
    assert.deepEqual(scenario, original);
  }
  const zero = evaluatePilotInputDraft({...createPilotInputDraft(scenario), reach: "0e-1000000000"}, scenario);
  assert.equal(zero.candidate?.reach, 0);
});

test("finite input combinations with non-finite arithmetic are not applied", () => {
  const scenario = createPlanningScenarioDefaults();
  for (const changes of [{fixed_cost:"1e308",per_participant_cost:"1e308"},{eligible_population:"1e308",capacity:"1e308",reach:"100"}]) {
    const result = evaluatePilotInputDraft({...createPilotInputDraft(scenario), ...changes}, scenario);
    assert.equal(result.candidate, null);
    assert.match(result.formError ?? "", /numeric range/);
  }
  const large = evaluatePilotInputDraft({...createPilotInputDraft(scenario), fixed_cost:"1e308"}, scenario);
  assert.equal(large.candidate?.fixed_cost, 1e308);
});

test("large planning labels stay compact and preserve numeric round trips", () => {
  for (const value of [1e308, Number.MAX_VALUE]) {
    const number = formatPlanningNumber(value);
    const currency = formatPlanningCurrency(value);
    assert.ok(number.length < 25);
    assert.equal(Number(number), value);
    assert.equal(Number(currency.slice(1)), value);
  }
  assert.equal(formatPlanningNumber(3000), "3,000");
  assert.equal(formatPlanningCurrency(1200000), "$1,200,000");
  assert.throws(() => formatPlanningNumber(Infinity));
});
